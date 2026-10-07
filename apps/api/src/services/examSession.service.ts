import type { ViolationType } from "../constants";
import { prisma } from "../prisma";
import { generateRandomSeed, seededShuffle } from "../utils/shuffle";

export class ExamRuleError extends Error {}

/** Network latency allowance when saving an answer right at the per-question deadline. */
const ANSWER_GRACE_MS = 3000;

type AttemptRow = NonNullable<Awaited<ReturnType<typeof prisma.examAttempt.findUnique>>>;
type TimedExam = { timePerQuestionSeconds: number | null };

/**
 * Applies the per-question time limit as of now: if the current question's time
 * ran out (e.g. the student refreshed or closed the browser), the attempt skips
 * ahead by however many limits have elapsed. Running past the last question
 * submits the attempt. Returns the up-to-date attempt.
 */
async function applyQuestionTimeout(attempt: AttemptRow, exam: TimedExam, totalQuestions: number) {
  if (!exam.timePerQuestionSeconds || !attempt.currentQuestionStartedAt) return attempt;
  const limitMs = exam.timePerQuestionSeconds * 1000;
  const elapsed = Date.now() - attempt.currentQuestionStartedAt.getTime();
  const skipped = Math.floor(elapsed / limitMs);
  if (skipped <= 0) return attempt;

  const nextIndex = attempt.currentQuestionIndex + skipped;
  if (nextIndex >= totalQuestions) {
    return gradeAndSubmit(attempt.id, "SUBMITTED", "TIMEOUT");
  }
  return prisma.examAttempt.update({
    where: { id: attempt.id },
    data: {
      currentQuestionIndex: nextIndex,
      currentQuestionStartedAt: new Date(attempt.currentQuestionStartedAt.getTime() + skipped * limitMs),
    },
  });
}

function questionSecondsLeft(attempt: AttemptRow, exam: TimedExam): number | null {
  if (!exam.timePerQuestionSeconds || !attempt.currentQuestionStartedAt) return null;
  const deadline = attempt.currentQuestionStartedAt.getTime() + exam.timePerQuestionSeconds * 1000;
  return Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
}

/** The question order this attempt sees (stable for a given seed). */
async function loadOrderedQuestionIds(examId: string, attempt: AttemptRow, shuffle: boolean) {
  const questions = await prisma.question.findMany({
    where: { examId },
    select: { id: true },
    orderBy: [{ order: "asc" }, { id: "asc" }],
  });
  return (shuffle ? seededShuffle(questions, attempt.randomSeed) : questions).map((q) => q.id);
}

/**
 * Starts (or resumes) an attempt and returns the exam paper with question
 * and option order shuffled per-student using the attempt's random seed.
 * Correct answers / answerKey are always stripped before returning to the client.
 */
export async function startOrResumeAttempt(examId: string, studentId: string) {
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    include: {
      questions: {
        include: { options: { orderBy: [{ order: "asc" }, { id: "asc" }] } },
        orderBy: [{ order: "asc" }, { id: "asc" }],
      },
    },
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
    // maxAttempts <= 0 means unlimited retakes.
    const attemptCount = await prisma.examAttempt.count({ where: { examId, studentId } });
    if (exam.maxAttempts > 0 && attemptCount >= exam.maxAttempts) {
      throw new ExamRuleError("No attempts remaining for this exam");
    }
    attempt = await prisma.examAttempt.create({
      data: {
        examId,
        studentId,
        randomSeed: generateRandomSeed(),
        currentQuestionStartedAt: exam.timePerQuestionSeconds ? new Date() : null,
      },
    });
  } else {
    attempt = await applyQuestionTimeout(attempt, exam, exam.questions.length);
    if (attempt.status !== "IN_PROGRESS") {
      throw new ExamRuleError("หมดเวลาทำข้อสอบแล้ว ระบบส่งคำตอบให้อัตโนมัติ");
    }
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
    examTitle: exam.title,
    startedAt: attempt.startedAt,
    durationMinutes: exam.durationMinutes,
    currentQuestionIndex: attempt.currentQuestionIndex,
    timePerQuestionSeconds: exam.timePerQuestionSeconds,
    questionSecondsLeft: questionSecondsLeft(attempt, exam),
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
  const exam = await prisma.exam.findUniqueOrThrow({ where: { id: attempt.examId } });

  if (exam.timePerQuestionSeconds) {
    // Timed exams: only the question currently on screen accepts answers, and only before its deadline.
    const order = await loadOrderedQuestionIds(exam.id, attempt, exam.shuffleQuestions);
    const deadline =
      (attempt.currentQuestionStartedAt?.getTime() ?? 0) + exam.timePerQuestionSeconds * 1000 + ANSWER_GRACE_MS;
    if (order[attempt.currentQuestionIndex] !== questionId || Date.now() > deadline) {
      await applyQuestionTimeout(attempt, exam, order.length);
      throw new ExamRuleError("ข้อนี้หมดเวลาหรือผ่านไปแล้ว ไม่สามารถแก้คำตอบได้");
    }
  } else {
    const belongs = await prisma.question.count({ where: { id: questionId, examId: exam.id } });
    if (!belongs) throw new ExamRuleError("Question not found");
  }

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

  // The question number comes from the server's record, never from the client.
  const logged = { ...detail, questionIndex: attempt.currentQuestionIndex };
  await prisma.examViolationLog.create({
    data: { attemptId: attempt.id, type, detail: JSON.stringify(logged) },
  });

  const updated = await prisma.examAttempt.update({
    where: { id: attempt.id },
    data: { violationCount: { increment: 1 } },
  });

  const forceSubmit = updated.violationCount >= exam.maxViolations;
  if (forceSubmit) {
    await gradeAndSubmit(attempt.id, "AUTO_SUBMITTED", "VIOLATIONS");
  }

  return { violationCount: updated.violationCount, maxViolations: exam.maxViolations, forceSubmit };
}

export async function submitAttempt(attemptId: string, studentId: string) {
  await requireOwnedInProgressAttempt(attemptId, studentId);
  return gradeAndSubmit(attemptId, "SUBMITTED", "STUDENT");
}

export type EndedReason = "STUDENT" | "TIMEOUT" | "VIOLATIONS" | "ADMIN_FORCED" | "EXAM_CLOSED";

export async function gradeAndSubmit(
  attemptId: string,
  status: "SUBMITTED" | "AUTO_SUBMITTED",
  endedReason: EndedReason
) {
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
      endedReason,
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

/**
 * Moves the attempt to the next question. Only forward by exactly one step is
 * allowed; a request for a question the server has already moved past (e.g.
 * the timer expired on both sides) is a no-op. Returns the authoritative state.
 */
export async function updateProgress(attemptId: string, studentId: string, requestedIndex: number) {
  let attempt = await requireOwnedInProgressAttempt(attemptId, studentId);
  const exam = await prisma.exam.findUniqueOrThrow({ where: { id: attempt.examId } });
  const totalQuestions = await prisma.question.count({ where: { examId: exam.id } });

  attempt = await applyQuestionTimeout(attempt, exam, totalQuestions);
  if (attempt.status !== "IN_PROGRESS") {
    throw new ExamRuleError("หมดเวลาทำข้อสอบแล้ว ระบบส่งคำตอบให้อัตโนมัติ");
  }

  if (requestedIndex === attempt.currentQuestionIndex + 1 && requestedIndex < totalQuestions) {
    attempt = await prisma.examAttempt.update({
      where: { id: attempt.id },
      data: {
        currentQuestionIndex: requestedIndex,
        currentQuestionStartedAt: exam.timePerQuestionSeconds ? new Date() : null,
      },
    });
  } else if (requestedIndex > attempt.currentQuestionIndex) {
    throw new ExamRuleError("ไม่สามารถข้ามข้อได้");
  } else if (requestedIndex < attempt.currentQuestionIndex && exam.timePerQuestionSeconds) {
    // Going back is not allowed on timed exams; report where the student actually is.
  } else if (requestedIndex < attempt.currentQuestionIndex) {
    attempt = await prisma.examAttempt.update({
      where: { id: attempt.id },
      data: { currentQuestionIndex: requestedIndex },
    });
  }

  return {
    currentQuestionIndex: attempt.currentQuestionIndex,
    questionSecondsLeft: questionSecondsLeft(attempt, exam),
  };
}

/**
 * Polled by the student's exam screen so back-office actions take effect
 * within a few seconds: forced submission, added time, and warning messages.
 * Messages are marked seen once delivered. A reset (deleted) attempt surfaces
 * as ExamRuleError("ATTEMPT_RESET").
 */
export async function getLiveState(attemptId: string, studentId: string) {
  let attempt = await prisma.examAttempt.findUnique({ where: { id: attemptId } });
  if (!attempt || attempt.studentId !== studentId) throw new ExamRuleError("ATTEMPT_RESET");
  const exam = await prisma.exam.findUniqueOrThrow({ where: { id: attempt.examId } });

  if (attempt.status === "IN_PROGRESS") {
    const totalQuestions = await prisma.question.count({ where: { examId: exam.id } });
    attempt = await applyQuestionTimeout(attempt, exam, totalQuestions);
  }

  const messages = await prisma.proctorMessage.findMany({
    where: { attemptId, seenAt: null },
    orderBy: { createdAt: "asc" },
    select: { id: true, message: true, createdAt: true },
  });
  if (messages.length > 0) {
    await prisma.proctorMessage.updateMany({
      where: { id: { in: messages.map((m) => m.id) } },
      data: { seenAt: new Date() },
    });
  }

  return {
    status: attempt.status,
    endedReason: attempt.endedReason,
    violationCount: attempt.violationCount,
    maxViolations: exam.maxViolations,
    currentQuestionIndex: attempt.currentQuestionIndex,
    questionSecondsLeft: attempt.status === "IN_PROGRESS" ? questionSecondsLeft(attempt, exam) : null,
    messages,
  };
}

/** The student's most recent finished attempt, for the result page. */
export async function getMyLatestResult(examId: string, studentId: string) {
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    select: { title: true, maxAttempts: true, status: true, _count: { select: { questions: true } } },
  });
  if (!exam) throw new ExamRuleError("Exam not found");
  const [latest, attemptCount] = await Promise.all([
    prisma.examAttempt.findFirst({
      where: { examId, studentId, status: { not: "IN_PROGRESS" } },
      orderBy: { startedAt: "desc" },
    }),
    prisma.examAttempt.count({ where: { examId, studentId } }),
  ]);
  return {
    examTitle: exam.title,
    totalQuestions: exam._count.questions,
    canRetake: exam.status === "OPEN" && (exam.maxAttempts <= 0 || attemptCount < exam.maxAttempts),
    attemptCount,
    latest: latest && {
      status: latest.status,
      endedReason: latest.endedReason,
      scorePoints: latest.scorePoints,
      scorePercent: latest.scorePercent,
      passed: latest.passed,
      violationCount: latest.violationCount,
      submittedAt: latest.submittedAt,
    },
  };
}

function safeJsonParse(val: string | null) {
  if (!val) return null;
  try {
    return JSON.parse(val);
  } catch {
    return val;
  }
}

export async function getLiveProctoringData(examId: string) {
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    include: {
      questions: {
        select: { id: true, prompt: true, order: true },
        orderBy: { order: "asc" },
      },
    },
  });
  if (!exam) throw new ExamRuleError("Exam not found");

  // Get all enrolled students in the course, or all students in the database
  const enrolledStudents = await prisma.enrollment.findMany({
    where: { courseId: exam.courseId },
    include: {
      student: {
        select: {
          id: true,
          fullName: true,
          email: true,
          studentCode: true,
          faculty: true,
          major: true,
          avatarUrl: true,
        },
      },
    },
    orderBy: { student: { studentCode: "asc" } },
  });

  const studentsList =
    enrolledStudents.length > 0
      ? enrolledStudents.map((e) => e.student)
      : await prisma.user.findMany({
          where: { role: "STUDENT" },
          select: {
            id: true,
            fullName: true,
            email: true,
            studentCode: true,
            faculty: true,
            major: true,
            avatarUrl: true,
          },
          orderBy: { studentCode: "asc" },
        });

  // Get all attempts for this exam
  // Oldest first, so the Map below keeps each student's latest attempt.
  const attempts = await prisma.examAttempt.findMany({
    where: { examId },
    orderBy: { startedAt: "asc" },
    include: {
      answers: {
        select: {
          questionId: true,
          isCorrect: true,
          answeredAt: true,
        },
      },
      violations: {
        orderBy: { occurredAt: "desc" },
      },
    },
  });

  const attemptsByStudent = new Map(attempts.map((a) => [a.studentId, a]));
  const attemptCountByStudent = new Map<string, number>();
  for (const a of attempts) attemptCountByStudent.set(a.studentId, (attemptCountByStudent.get(a.studentId) ?? 0) + 1);

  const studentData = studentsList.map((student) => {
    const attempt = attemptsByStudent.get(student.id);

    return {
      studentId: student.id,
      fullName: student.fullName,
      email: student.email,
      studentCode: student.studentCode || "-",
      faculty: student.faculty || "-",
      major: student.major || "-",
      avatarUrl: student.avatarUrl,
      status: attempt ? attempt.status : "NOT_STARTED",
      attemptCount: attemptCountByStudent.get(student.id) ?? 0,
      endedReason: attempt?.endedReason ?? null,
      questionSecondsLeft:
        attempt && attempt.status === "IN_PROGRESS" ? questionSecondsLeft(attempt, exam) : null,
      attemptId: attempt?.id ?? null,
      startedAt: attempt?.startedAt ?? null,
      submittedAt: attempt?.submittedAt ?? null,
      currentQuestionIndex: attempt ? attempt.currentQuestionIndex : 0,
      answeredCount: attempt ? attempt.answers.length : 0,
      totalQuestions: exam.questions.length,
      violationCount: attempt ? attempt.violationCount : 0,
      scorePoints: attempt?.scorePoints ?? null,
      scorePercent: attempt?.scorePercent ?? null,
      passed: attempt?.passed ?? null,
      violations: (attempt?.violations ?? []).map((v) => ({
        id: v.id,
        type: v.type,
        occurredAt: v.occurredAt,
        detail: safeJsonParse(v.detail),
      })),
    };
  });

  // Flat recent violations across students for live ticker/feed
  const recentViolations: Array<{
    id: string;
    studentName: string;
    studentCode: string;
    type: string;
    occurredAt: Date;
    questionNumber: number;
    detail: any;
  }> = [];

  for (const s of studentData) {
    for (const v of s.violations) {
      const qNum =
        v.detail && typeof v.detail.questionIndex === "number"
          ? v.detail.questionIndex + 1
          : s.currentQuestionIndex + 1;

      recentViolations.push({
        id: v.id,
        studentName: s.fullName,
        studentCode: s.studentCode,
        type: v.type,
        occurredAt: v.occurredAt,
        questionNumber: qNum,
        detail: v.detail,
      });
    }
  }

  recentViolations.sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
  );

  return {
    exam: {
      id: exam.id,
      timePerQuestionSeconds: exam.timePerQuestionSeconds,
      title: exam.title,
      totalQuestions: exam.questions.length,
      durationMinutes: exam.durationMinutes,
      maxViolations: exam.maxViolations,
      status: exam.status,
    },
    students: studentData,
    recentViolations: recentViolations.slice(0, 50),
    summary: {
      totalStudents: studentsList.length,
      inProgress: studentData.filter((s) => s.status === "IN_PROGRESS").length,
      submitted: studentData.filter((s) => s.status === "SUBMITTED" || s.status === "AUTO_SUBMITTED").length,
      autoSubmitted: studentData.filter((s) => s.status === "AUTO_SUBMITTED").length,
      notStarted: studentData.filter((s) => s.status === "NOT_STARTED").length,
      violatorCount: studentData.filter((s) => s.violationCount > 0).length,
    },
  };
}
