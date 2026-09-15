import type { ViolationType } from "../constants";
import { prisma } from "../prisma";
import { generateRandomSeed, seededShuffle } from "../utils/shuffle";

export class ExamRuleError extends Error {}

/**
 * Starts (or resumes) an attempt and returns the exam paper with question
 * and option order shuffled per-student using the attempt's random seed.
 * Correct answers / answerKey are always stripped before returning to the client.
 */
export async function startOrResumeAttempt(examId: string, studentId: string) {
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    include: { questions: { include: { options: true } } },
  });
  if (!exam) throw new ExamRuleError("Exam not found");
  if (exam.status !== "OPEN") throw new ExamRuleError("Exam is not currently open");

  const now = new Date();
  if (exam.opensAt && now < exam.opensAt) throw new ExamRuleError("Exam has not opened yet");
  if (exam.closesAt && now > exam.closesAt) throw new ExamRuleError("Exam has closed");

  let attempt = await prisma.examAttempt.findFirst({
    where: { examId, studentId, status: "IN_PROGRESS" },
  });

  if (!attempt) {
    const attemptCount = await prisma.examAttempt.count({ where: { examId, studentId } });
    if (attemptCount >= exam.maxAttempts) {
      throw new ExamRuleError("No attempts remaining for this exam");
    }
    attempt = await prisma.examAttempt.create({
      data: { examId, studentId, randomSeed: generateRandomSeed() },
    });
  }

  const questionOrder = exam.shuffleQuestions
    ? seededShuffle(exam.questions, attempt.randomSeed)
    : exam.questions;

  const paper = questionOrder.map((q) => {
    const optionOrder = exam.shuffleOptions ? seededShuffle(q.options, `${attempt!.randomSeed}:${q.id}`) : q.options;
    return {
      id: q.id,
      type: q.type,
      prompt: q.prompt,
      points: q.points,
      options: optionOrder.map((o) => ({ id: o.id, label: o.label })), // isCorrect stripped
    };
  });

  return {
    attemptId: attempt.id,
    startedAt: attempt.startedAt,
    durationMinutes: exam.durationMinutes,
    security: {
      requireFullscreen: exam.requireFullscreen,
      blockClipboard: exam.blockClipboard,
      blockContextMenu: exam.blockContextMenu,
      maxViolations: exam.maxViolations,
    },
    questions: paper,
  };
}

export async function saveAnswer(
  attemptId: string,
  studentId: string,
  questionId: string,
  payload: { selectedOptionIds?: string[]; textAnswer?: string }
) {
  const attempt = await requireOwnedInProgressAttempt(attemptId, studentId);

  const selectedOptionIds = JSON.stringify(payload.selectedOptionIds ?? []);

  await prisma.examAnswer.upsert({
    where: { attemptId_questionId: { attemptId: attempt.id, questionId } },
    create: {
      attemptId: attempt.id,
      questionId,
      selectedOptionIds,
      textAnswer: payload.textAnswer,
    },
    update: {
      selectedOptionIds,
      textAnswer: payload.textAnswer,
      answeredAt: new Date(),
    },
  });
}

/**
 * Logs a proctoring violation. If the exam's configured threshold is
 * reached, the attempt is force-submitted (graded as-is) and the caller is
 * told so the client can lock the UI immediately.
 */
export async function recordViolation(
  attemptId: string,
  studentId: string,
  type: ViolationType,
  detail?: Record<string, unknown>
) {
  const attempt = await requireOwnedInProgressAttempt(attemptId, studentId);
  const exam = await prisma.exam.findUniqueOrThrow({ where: { id: attempt.examId } });

  await prisma.examViolationLog.create({
    data: { attemptId: attempt.id, type, detail: detail ? JSON.stringify(detail) : null },
  });

  const updated = await prisma.examAttempt.update({
    where: { id: attempt.id },
    data: { violationCount: { increment: 1 } },
  });

  const forceSubmit = updated.violationCount >= exam.maxViolations;
  if (forceSubmit) {
    await gradeAndSubmit(attempt.id, "AUTO_SUBMITTED");
  }

  return { violationCount: updated.violationCount, maxViolations: exam.maxViolations, forceSubmit };
}

export async function submitAttempt(attemptId: string, studentId: string) {
  await requireOwnedInProgressAttempt(attemptId, studentId);
  return gradeAndSubmit(attemptId, "SUBMITTED");
}

async function gradeAndSubmit(attemptId: string, status: "SUBMITTED" | "AUTO_SUBMITTED") {
  const attempt = await prisma.examAttempt.findUniqueOrThrow({
    where: { id: attemptId },
    include: {
      answers: true,
      exam: { include: { questions: { include: { options: true } } } },
    },
  });

  let earned = 0;
  let total = 0;

  for (const question of attempt.exam.questions) {
    total += question.points;
    const answer = attempt.answers.find((a) => a.questionId === question.id);
    if (!answer) continue;

    let correct = false;
    if (question.type === "SHORT_ANSWER") {
      correct =
        !!answer.textAnswer &&
        !!question.answerKey &&
        normalize(answer.textAnswer) === normalize(question.answerKey);
    } else {
      const correctIds = question.options.filter((o) => o.isCorrect).map((o) => o.id).sort();
      const selected = (JSON.parse(answer.selectedOptionIds) as string[]).sort();
      correct = correctIds.length === selected.length && correctIds.every((id, i) => id === selected[i]);
    }

    const pointsAwarded = correct ? question.points : 0;
    earned += pointsAwarded;

    await prisma.examAnswer.update({
      where: { id: answer.id },
      data: { isCorrect: correct, pointsAwarded },
    });
  }

  const scorePercent = total > 0 ? Math.round((earned / total) * 10000) / 100 : 0;
  const passed = scorePercent >= attempt.exam.passScorePercent;

  return prisma.examAttempt.update({
    where: { id: attemptId },
    data: {
      status,
      submittedAt: new Date(),
      scorePoints: earned,
      scorePercent,
      passed,
    },
  });
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

async function requireOwnedInProgressAttempt(attemptId: string, studentId: string) {
  const attempt = await prisma.examAttempt.findUnique({ where: { id: attemptId } });
  if (!attempt || attempt.studentId !== studentId) throw new ExamRuleError("Attempt not found");
  if (attempt.status !== "IN_PROGRESS") throw new ExamRuleError("Attempt is no longer in progress");
  return attempt;
}
