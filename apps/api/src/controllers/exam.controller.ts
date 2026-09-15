import type { Request, Response } from "express";
import { z } from "zod";
import { VIOLATION_TYPES } from "../constants";
import { prisma } from "../prisma";
import * as examSession from "../services/examSession.service";
import { ExamRuleError } from "../services/examSession.service";

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
