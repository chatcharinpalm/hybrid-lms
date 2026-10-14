import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import { z } from "zod";
import { VIOLATION_TYPES } from "../constants";
import { prisma } from "../prisma";
import * as examSession from "../services/examSession.service";
import { ExamRuleError } from "../services/examSession.service";
import * as proctorControl from "../services/proctorControl.service";
import { sanitizePaperHtml, type PaperBlock } from "../services/paperDocument";

const createExamSchema = z.object({
  courseId: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().optional(),
  durationMinutes: z.number().int().positive(),
  passScorePercent: z.number().int().min(0).max(100).default(60),
  maxAttempts: z.number().int().min(0).default(0), // 0 = unlimited retakes
  opensAt: z.coerce.date().optional(),
  closesAt: z.coerce.date().optional(),
  requireFullscreen: z.boolean().default(true),
  blockClipboard: z.boolean().default(true),
  blockContextMenu: z.boolean().default(true),
  maxViolations: z.number().int().positive().default(3),
  shuffleQuestions: z.boolean().default(true),
  shuffleOptions: z.boolean().default(true),
  questions: z
    .array(
      z.object({
        type: z.enum(["SINGLE_CHOICE", "MULTIPLE_CHOICE", "SHORT_ANSWER"]),
        prompt: z.string().min(1),
        points: z.number().int().positive().default(1),
        answerKey: z.string().optional(),
        options: z
          .array(z.object({ label: z.string().min(1), isCorrect: z.boolean().default(false) }))
          .optional(),
      })
    )
    .default([]),
});

export async function createExam(req: Request, res: Response) {
  const body = createExamSchema.parse(req.body);

  const exam = await prisma.exam.create({
    data: {
      courseId: body.courseId,
      title: body.title,
      description: body.description,
      durationMinutes: body.durationMinutes,
      passScorePercent: body.passScorePercent,
      maxAttempts: body.maxAttempts,
      opensAt: body.opensAt,
      closesAt: body.closesAt,
      requireFullscreen: body.requireFullscreen,
      blockClipboard: body.blockClipboard,
      blockContextMenu: body.blockContextMenu,
      maxViolations: body.maxViolations,
      shuffleQuestions: body.shuffleQuestions,
      shuffleOptions: body.shuffleOptions,
      questions: {
        create: body.questions.map((q, order) => ({
          type: q.type,
          prompt: q.prompt,
          points: q.points,
          order,
          answerKey: q.answerKey,
          options: q.options
            ? { create: q.options.map((o, oOrder) => ({ ...o, order: oOrder })) }
            : undefined,
        })),
      },
    },
    include: { questions: { include: { options: true } } },
  });

  return res.status(201).json(exam);
}

const importOptionSchema = z.object({
  label: z.string().trim().min(1).max(1000),
  /** Option Bank code as printed ("A01", "W"); absent on choice questions. */
  code: z.string().trim().min(1).max(16).optional(),
  isCorrect: z.boolean(),
});

const importQuestionSchema = z.object({
  /** The client's id for the question; question blocks name it in their slots. */
  key: z.string().min(1).max(40),
  type: z.enum(["SINGLE_CHOICE", "SHORT_ANSWER", "FILL_IN_BANK", "ESSAY"]),
  /** Plain text of the question, for the monitor, answer sheets and Excel. */
  prompt: z.string().trim().min(1).max(5000),
  points: z.number().int().min(0).max(100),
  /** SHORT_ANSWER: accepted answers, "a | b". */
  answerKey: z.string().trim().max(1000).optional(),
  options: z.array(importOptionSchema).max(200).default([]),
});

const importBlockSchema = z.discriminatedUnion("t", [
  z.object({ t: z.literal("html"), html: z.string().max(3_000_000) }),
  z.object({ t: z.literal("bank") }),
  z.object({
    t: z.literal("q"),
    num: z.string().max(20),
    html: z.string().max(3_000_000),
    slots: z.array(z.string()).min(1),
    run: z.number().int().min(0),
    fixedOptions: z.boolean().optional(),
    marker: z.enum(["thai", "lower", "upper", "num"]).optional(),
  }),
]);

const importDocumentSchema = z
  .object({
    courseId: z.string().uuid(),
    title: z.string().trim().min(1).max(300),
    durationMinutes: z.number().int().positive().max(600),
    blocks: z.array(importBlockSchema).min(1).max(2000),
    questions: z.array(importQuestionSchema).min(1).max(500),
  })
  .superRefine((data, ctx) => {
    const issue = (message: string) => ctx.addIssue({ code: "custom", message });
    const keys = new Map(data.questions.map((q, i) => [q.key, i]));
    const slotted = new Set<string>();
    for (const b of data.blocks) {
      if (b.t !== "q") continue;
      for (const s of b.slots) {
        if (!keys.has(s)) issue(`ข้อ ${b.num}: ไม่พบคำถาม ${s}`);
        if (slotted.has(s)) issue(`ข้อ ${b.num}: คำถามซ้ำ`);
        slotted.add(s);
      }
    }
    data.questions.forEach((q, i) => {
      const label = `คำถามที่ ${i + 1}`;
      if (!slotted.has(q.key)) issue(`${label}: ไม่อยู่ในเอกสาร`);
      const correct = q.options.filter((o) => o.isCorrect).length;
      if (q.type === "SINGLE_CHOICE" && (q.options.length < 2 || correct !== 1)) {
        issue(`${label}: ต้องมีตัวเลือกอย่างน้อย 2 ข้อ และเฉลยถูก 1 ข้อ`);
      }
      if (q.type === "FILL_IN_BANK" && (q.options.some((o) => !o.code) || correct !== 1)) {
        issue(`${label}: ต้องมีคลังตัวเลือกพร้อมรหัส และเฉลย 1 รหัส`);
      }
      if (q.type === "SHORT_ANSWER" && !q.answerKey) issue(`${label}: ยังไม่มีเฉลย`);
    });
  });

/**
 * Back office: an exam from the teacher's own document (Word or PDF, read in
 * the browser and checked by the teacher). The document's layout is kept as
 * blocks (services/paperDocument.ts); its questions become ordinary Questions,
 * so grading, the monitor and the Excel export work as for any exam. The
 * room starts closed until a proctor opens it.
 */
export async function importDocumentExam(req: Request, res: Response) {
  const parsed = importDocumentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: [...new Set(parsed.error.issues.map((i) => i.message))].slice(0, 10).join("\n") });
  }
  const data = parsed.data;
  const course = await prisma.course.findUnique({ where: { id: data.courseId }, select: { id: true } });
  if (!course) return res.status(404).json({ error: "ไม่พบรายวิชา" });

  // Ids made here so the whole exam goes in as three bulk inserts (one per
  // table) — a row-by-row nested create takes hundreds of round trips.
  const examId = randomUUID();
  const ids = new Map(data.questions.map((q) => [q.key, randomUUID()]));
  const questions = data.questions.map((q, i) => ({ ...q, id: ids.get(q.key)!, order: i + 1 }));
  const blocks: PaperBlock[] = data.blocks.map((b) => {
    if (b.t === "bank") return b;
    // Slot markers in the html name the client's keys; they become Question ids.
    const html = sanitizePaperHtml(b.html).replace(/data-slot="([^"]+)"/g, (_m, key: string) => `data-slot="${ids.get(key) ?? ""}"`);
    return b.t === "html" ? { t: "html", html } : { ...b, html, slots: b.slots.map((s) => ids.get(s)!) };
  });

  const [exam] = await prisma.$transaction([
    prisma.exam.create({
      data: {
        id: examId,
        courseId: course.id,
        title: data.title,
        description: `จำนวน ${questions.length} ข้อ`,
        durationMinutes: data.durationMinutes,
        timePerQuestionSeconds: null,
        maxAttempts: 0,
        status: "CLOSED",
        passScorePercent: 60,
        requireFullscreen: true,
        blockClipboard: true,
        blockContextMenu: true,
        maxViolations: 3,
        shuffleQuestions: true,
        shuffleOptions: true,
        paperJson: JSON.stringify(blocks),
      },
      select: { id: true, title: true },
    }),
    prisma.question.createMany({
      data: questions.map((q) => ({
        id: q.id,
        examId,
        type: q.type,
        prompt: q.prompt,
        points: q.points,
        order: q.order,
        answerKey: q.type === "SHORT_ANSWER" ? q.answerKey : null,
      })),
    }),
    prisma.questionOption.createMany({
      data: questions.flatMap((q) =>
        q.options.map((o, idx) => ({ questionId: q.id, label: o.label, code: o.code ?? null, isCorrect: o.isCorrect, order: idx }))
      ),
    }),
  ]);

  await prisma.auditLog.create({
    data: {
      actorId: req.user!.id,
      action: "EXAM_IMPORTED",
      entity: "Exam",
      entityId: exam.id,
      metadata: JSON.stringify({ questions: questions.length, blocks: blocks.length }),
    },
  });
  return res.status(201).json(exam);
}

export async function listExamsForCourse(req: Request, res: Response) {
  const staff = req.user?.role === "TEACHER" || req.user?.role === "ADMIN";
  const exams = await prisma.exam.findMany({
    // A hidden course's exams are listed for staff only.
    where: { courseId: req.params.courseId, ...(staff ? {} : { course: { isHidden: false } }) },
    orderBy: { createdAt: "desc" },
  });
  return res.json(exams);
}

export async function publishExam(req: Request, res: Response) {
  const exam = await prisma.exam.update({
    where: { id: req.params.examId },
    data: { status: "OPEN" },
  });
  return res.json(exam);
}

export async function startAttempt(req: Request, res: Response) {
  try {
    const result = await examSession.startOrResumeAttempt(req.params.examId, req.user!.id);
    return res.json(result);
  } catch (err) {
    if (err instanceof ExamRuleError) return res.status(409).json({ error: err.message });
    throw err;
  }
}

const answerSchema = z.object({
  questionId: z.string().uuid(),
  selectedOptionIds: z.array(z.string().uuid()).optional(),
  textAnswer: z.string().max(10000).optional(),
});

export async function saveAnswer(req: Request, res: Response) {
  const body = answerSchema.parse(req.body);
  try {
    await examSession.saveAnswer(req.params.attemptId, req.user!.id, body.questionId, body);
    return res.status(204).send();
  } catch (err) {
    if (err instanceof ExamRuleError) return res.status(409).json({ error: err.message });
    throw err;
  }
}

export async function updateProgress(req: Request, res: Response) {
  const schema = z.object({ currentQuestionIndex: z.number().int().min(0) });
  const body = schema.parse(req.body);
  try {
    const state = await examSession.updateProgress(req.params.attemptId, req.user!.id, body.currentQuestionIndex);
    return res.json(state);
  } catch (err) {
    if (err instanceof ExamRuleError) return res.status(409).json({ error: err.message });
    throw err;
  }
}

const violationSchema = z.object({
  type: z.enum(VIOLATION_TYPES),
  detail: z.record(z.unknown()).optional(),
});

export async function reportViolation(req: Request, res: Response) {
  const body = violationSchema.parse(req.body);
  try {
    const result = await examSession.recordViolation(
      req.params.attemptId,
      req.user!.id,
      body.type,
      body.detail
    );
    return res.json(result);
  } catch (err) {
    if (err instanceof ExamRuleError) return res.status(409).json({ error: err.message });
    throw err;
  }
}

export async function submitAttempt(req: Request, res: Response) {
  try {
    const attempt = await examSession.submitAttempt(req.params.attemptId, req.user!.id);
    return res.json(attempt);
  } catch (err) {
    if (err instanceof ExamRuleError) return res.status(409).json({ error: err.message });
    throw err;
  }
}

export async function getAttemptViolations(req: Request, res: Response) {
  const violations = await prisma.examViolationLog.findMany({
    where: { attemptId: req.params.attemptId },
    orderBy: { occurredAt: "asc" },
  });
  return res.json(
    violations.map((v) => ({ ...v, detail: v.detail ? JSON.parse(v.detail) : null }))
  );
}

export async function getAttemptAnswerSheet(req: Request, res: Response) {
  try {
    return res.json(await examSession.getAttemptAnswerSheet(req.params.attemptId));
  } catch (err) {
    if (err instanceof ExamRuleError) return res.status(404).json({ error: err.message });
    throw err;
  }
}

export async function getLiveProctoring(req: Request, res: Response) {
  try {
    const data = await examSession.getLiveProctoringData(req.params.examId);
    return res.json(data);
  } catch (err) {
    if (err instanceof ExamRuleError) return res.status(404).json({ error: err.message });
    throw err;
  }
}

export async function getLiveState(req: Request, res: Response) {
  try {
    return res.json(await examSession.getLiveState(req.params.attemptId, req.user!.id));
  } catch (err) {
    if (err instanceof ExamRuleError && err.message === "ATTEMPT_RESET") {
      return res.status(410).json({ error: "การสอบของคุณถูกรีเซ็ตโดยผู้คุมสอบ", reset: true });
    }
    if (err instanceof ExamRuleError) return res.status(409).json({ error: err.message });
    throw err;
  }
}

// ── Back-office controls ─────────────────────────────────────

/** Runs a control action, mapping rule violations (not found, no permission, wrong state) to 409. */
async function control(res: Response, action: () => Promise<unknown>) {
  try {
    const result = await action();
    return result === undefined ? res.status(204).send() : res.json(result);
  } catch (err) {
    if (err instanceof ExamRuleError) return res.status(409).json({ error: err.message });
    throw err;
  }
}

const actor = (req: Request) => ({ id: req.user!.id, role: req.user!.role });
const reasonSchema = z.object({ reason: z.string().max(500).optional() });

export async function setExamStatus(req: Request, res: Response) {
  const { status } = z.object({ status: z.enum(["OPEN", "CLOSED"]) }).parse(req.body);
  return control(res, () => proctorControl.setExamStatus(req.params.examId, status, actor(req)));
}

export async function forceSubmitAttempt(req: Request, res: Response) {
  const { reason } = reasonSchema.parse(req.body ?? {});
  return control(res, () => proctorControl.forceSubmit(req.params.attemptId, actor(req), reason));
}

export async function resetAttempt(req: Request, res: Response) {
  const { reason } = reasonSchema.parse(req.body ?? {});
  return control(res, () => proctorControl.resetAttempt(req.params.attemptId, actor(req), reason));
}

export async function forgiveViolations(req: Request, res: Response) {
  return control(res, () => proctorControl.forgiveViolations(req.params.attemptId, actor(req)));
}

export async function addQuestionTime(req: Request, res: Response) {
  const { seconds } = z.object({ seconds: z.number().int().min(10).max(3600) }).parse(req.body);
  return control(res, () => proctorControl.addQuestionTime(req.params.attemptId, seconds, actor(req)));
}

export async function sendProctorMessage(req: Request, res: Response) {
  const { message } = z.object({ message: z.string().trim().min(1).max(500) }).parse(req.body);
  return control(res, () => proctorControl.sendMessage(req.params.attemptId, message, actor(req)));
}

export async function getExamAuditLog(req: Request, res: Response) {
  return control(res, () => proctorControl.listExamAuditLog(req.params.examId, actor(req)));
}
export async function getMyLatestResult(req: Request, res: Response) {
  try {
    return res.json(await examSession.getMyLatestResult(req.params.examId, req.user!.id));
  } catch (err) {
    if (err instanceof ExamRuleError) return res.status(404).json({ error: err.message });
    throw err;
  }
}