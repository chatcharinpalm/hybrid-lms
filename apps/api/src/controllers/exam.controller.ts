import type { Request, Response } from "express";
import { z } from "zod";
import { VIOLATION_TYPES } from "../constants";
import { prisma } from "../prisma";
import * as examSession from "../services/examSession.service";
import { ExamRuleError } from "../services/examSession.service";
import * as proctorControl from "../services/proctorControl.service";

const createExamSchema = z.object({
  courseId: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().optional(),
  durationMinutes: z.number().int().positive(),
  passScorePercent: z.number().int().min(0).max(100).default(60),
  maxAttempts: z.number().int().positive().default(1),
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

export async function listExamsForCourse(req: Request, res: Response) {
  const exams = await prisma.exam.findMany({
    where: { courseId: req.params.courseId },
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
  textAnswer: z.string().optional(),
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