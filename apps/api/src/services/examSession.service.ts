import type { ViolationType } from "../constants";
import { prisma } from "../prisma";
import { byThaiName } from "../utils/roster";
import { generateRandomSeed, seededShuffle } from "../utils/shuffle";

export class ExamRuleError extends Error {}

/** Network latency allowance when saving an answer right at the per-question deadline. */
const ANSWER_GRACE_MS = 3000;

type AttemptRow = NonNullable<Awaited<ReturnType<typeof prisma.examAttempt.findUnique>>>;
type TimedExam = { timePerQuestionSeconds: number | null; durationMinutes: number };

/** Epoch ms when an attempt on an exam without per-question limits runs out of time. */
function overallDeadline(attempt: AttemptRow, exam: TimedExam) {
  return attempt.startedAt.getTime() + exam.durationMinutes * 60_000 + attempt.extraTimeSeconds * 1000;
}

/** Whole-exam time remaining; null on exams timed per question. */
function overallSecondsLeft(attempt: AttemptRow, exam: TimedExam): number | null {
  if (exam.timePerQuestionSeconds) return null;
  return Math.max(0, Math.ceil((overallDeadline(attempt, exam) - Date.now()) / 1000));
}

/**
 * Applies the exam's time limits as of now and returns the up-to-date attempt.
 *
 * Per-question exams: if the current question's time ran out (e.g. the student
 * refreshed or closed the browser), the attempt skips ahead by however many
 * limits have elapsed; running past the last question submits the attempt.
 *
 * Other exams: once the whole-exam time (plus any proctor-granted extra time)
 * is up, the attempt is submitted with what has been answered.
 */
async function applyQuestionTimeout(attempt: AttemptRow, exam: TimedExam, totalQuestions: number) {
  if (!exam.timePerQuestionSeconds) {
    if (Date.now() > overallDeadline(attempt, exam) + ANSWER_GRACE_MS) {
      return gradeAndSubmit(attempt.id, "SUBMITTED", "TIMEOUT");
    }
    return attempt;
  }
  if (!attempt.currentQuestionStartedAt) return attempt;
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

type DealtExam = {
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  questions: Array<{
    id: string;
    type: string;
    prompt: string;
    points: number;
    options: Array<{ id: string; label: string; code: string | null; order: number; isCorrect: boolean }>;
  }>;
};

/**
 * One student's paper, as dealt by their attempt's seed: question order and,
 * for answer-bank questions, the bank laid out like the paper's Option Bank
 * table with the paper's codes in the paper's sequence (A, B, C… / A01, A02…)
 * but the answers behind the codes dealt per student — so "W" on one screen
 * means something else on the next and copying a neighbour's code is no use.
 * Grading goes by the option chosen, never by its code. Options keep isCorrect;
 * callers sending this to a student must strip it.
 */
function dealPaper(exam: DealtExam, seed: string) {
  const questionOrder = exam.shuffleQuestions ? seededShuffle(exam.questions, seed) : exam.questions;

  const bankRank = new Map<number, number>();
  if (exam.shuffleOptions) {
    const bankOrders = [...new Set(exam.questions.filter((q) => q.type === "FILL_IN_BANK").flatMap((q) => q.options.map((o) => o.order)))];
    seededShuffle(bankOrders.sort((a, b) => a - b), `${seed}:bank`).forEach((order, i) => bankRank.set(order, i));
  }

  return questionOrder.map((q) => {
    const optionOrder =
      q.type === "FILL_IN_BANK"
        ? exam.shuffleOptions
          ? [...q.options].sort((a, b) => (bankRank.get(a.order) ?? 0) - (bankRank.get(b.order) ?? 0))
          : q.options
        : exam.shuffleOptions
          ? seededShuffle(q.options, `${seed}:${q.id}`)
          : q.options;
    // The paper's codes in paper order; position i of this student's table gets code i.
    const paperCodes = [...q.options].sort((a, b) => a.order - b.order).map((o) => o.code);
    return {
      id: q.id,
      type: q.type,
      prompt: q.prompt,
      points: q.points,
      options: optionOrder.map((o, i) => ({
        id: o.id,
        label: o.label,
        code: q.type === "FILL_IN_BANK" ? paperCodes[i] : o.code,
        isCorrect: o.isCorrect,
      })),
    };
  });
}

/**
 * For staff: one attempt's answers, question by question in the order the
 * student saw them, with the code they wrote, its words, and the right answer.
 */
export async function getAttemptAnswerSheet(attemptId: string) {
  const attempt = await prisma.examAttempt.findUnique({
    where: { id: attemptId },
    include: {
      answers: true,
      student: { select: { fullName: true, studentCode: true, section: true } },
      exam: {
        include: {
          questions: {
            include: { options: { orderBy: [{ order: "asc" }, { id: "asc" }] } },
            orderBy: [{ order: "asc" }, { id: "asc" }],
          },
        },
      },
    },
  });
  if (!attempt) throw new ExamRuleError("Attempt not found");

  const rows = dealPaper(attempt.exam, attempt.randomSeed).map((q, i) => {
    const answer = attempt.answers.find((a) => a.questionId === q.id);
    const chosenId = answer ? (JSON.parse(answer.selectedOptionIds) as string[])[0] : undefined;
    const chosen = q.options.find((o) => o.id === chosenId) ?? null;
    const correct = q.options.find((o) => o.isCorrect) ?? null;
    return {
      number: i + 1,
      // Number of the question on the teacher's paper.
      paperNumber: attempt.exam.questions.find((x) => x.id === q.id)?.order ?? null,
      prompt: q.prompt,
      chosen: chosen && { code: chosen.code, label: chosen.label },
      correct: correct && { code: correct.code, label: correct.label },
      isCorrect: chosen ? chosen.isCorrect : null,
    };
  });

  return {
    student: attempt.student,
    examTitle: attempt.exam.title,
    status: attempt.status,
    scorePoints: attempt.scorePoints,
    total: rows.length,
    answered: rows.filter((r) => r.chosen).length,
    rows,
  };
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
  // Only students on the course's class list sit its exams (no self-registered walk-ins).
  const enrolled = await prisma.enrollment.count({ where: { courseId: exam.courseId, studentId, status: "ACTIVE" } });
  if (!enrolled) throw new ExamRuleError("คุณไม่มีรายชื่อในรายวิชานี้ กรุณาติดต่ออาจารย์ผู้คุมสอบ");
  if (exam.status !== "OPEN") throw new ExamRuleError("ห้องสอบยังไม่เปิด กรุณารอผู้คุมสอบเปิดห้อง");

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

  const paper = dealPaper(exam, attempt.randomSeed).map((q) => ({
    ...q,
    options: q.options.map(({ id, label, code }) => ({ id, label, code })), // isCorrect stripped
  }));

  // Saved answers, so a refresh (or flipping back on the paper) shows what was written.
  const saved = await prisma.examAnswer.findMany({
    where: { attemptId: attempt.id },
    select: { questionId: true, selectedOptionIds: true, textAnswer: true },
  });
  const answers = Object.fromEntries(
    saved.map((a) => [
      a.questionId,
      { selectedOptionIds: JSON.parse(a.selectedOptionIds) as string[], textAnswer: a.textAnswer ?? undefined },
    ])
  );

  const student = await prisma.user.findUniqueOrThrow({
    where: { id: studentId },
    select: { fullName: true, studentCode: true, section: true },
  });
  // "เลขที่" on the paper: position on the room's ก–ฮ class list, as on the sign-in sheet.
  const classList = await prisma.user.findMany({
    where: { role: "STUDENT", section: student.section, enrollments: { some: { courseId: exam.courseId } } },
    select: { id: true, firstName: true, lastName: true },
  });
  const seatIndex = classList.sort(byThaiName).findIndex((s) => s.id === studentId);

  return {
    attemptId: attempt.id,
    examTitle: exam.title,
    examDescription: exam.description,
    student: {
      fullName: student.fullName,
      studentCode: student.studentCode,
      section: student.section,
      seatNumber: seatIndex >= 0 ? seatIndex + 1 : null,
    },
    startedAt: attempt.startedAt,
    durationMinutes: exam.durationMinutes,
    secondsLeft: overallSecondsLeft(attempt, exam),
    answers,
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
    const current = await applyQuestionTimeout(attempt, exam, 0);
    if (current.status !== "IN_PROGRESS") throw new ExamRuleError("หมดเวลาทำข้อสอบแล้ว ระบบส่งคำตอบให้อัตโนมัติ");
    const question = await prisma.question.findFirst({ where: { id: questionId, examId: exam.id }, select: { type: true } });
    if (!question) throw new ExamRuleError("Question not found");
    // A blank on the paper is final once written: the student confirms it, then it locks.
    if (question.type === "FILL_IN_BANK") {
      const existing = await prisma.examAnswer.findUnique({
        where: { attemptId_questionId: { attemptId: attempt.id, questionId } },
        select: { selectedOptionIds: true },
      });
      if (existing && (JSON.parse(existing.selectedOptionIds) as string[]).length > 0) {
        throw new ExamRuleError("ข้อนี้ตอบไปแล้ว แก้ไขไม่ได้");
      }
      if (!payload.selectedOptionIds?.length) throw new ExamRuleError("ยังไม่ได้เลือกคำตอบ");
    }
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
  const attempt = await requireOwnedInProgressAttempt(attemptId, studentId);
  const exam = await prisma.exam.findUniqueOrThrow({ where: { id: attempt.examId } });
  // Students hand in only a complete paper — unless time is up, when what they have is taken.
  const timeUp = !exam.timePerQuestionSeconds && Date.now() >= overallDeadline(attempt, exam) - ANSWER_GRACE_MS;
  if (!exam.timePerQuestionSeconds && !timeUp) {
    const [total, answers] = await Promise.all([
      prisma.question.count({ where: { examId: exam.id } }),
      prisma.examAnswer.findMany({ where: { attemptId }, select: { selectedOptionIds: true, textAnswer: true } }),
    ]);
    const answered = answers.filter((a) => (JSON.parse(a.selectedOptionIds) as string[]).length > 0 || a.textAnswer?.trim()).length;
    if (answered < total) throw new ExamRuleError(`ยังตอบไม่ครบ เหลืออีก ${total - answered} ข้อ ต้องตอบให้ครบทุกข้อก่อนส่ง`);
  }
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
 * Moves the attempt to another question. On per-question timed exams only
 * forward by exactly one step is allowed; a request for a question the server
 * has already moved past (e.g. the timer expired on both sides) is a no-op.
 * Other exams flip freely, like a paper booklet — the index only records where
 * the student is looking. Returns the authoritative state.
 */
export async function updateProgress(attemptId: string, studentId: string, requestedIndex: number) {
  let attempt = await requireOwnedInProgressAttempt(attemptId, studentId);
  const exam = await prisma.exam.findUniqueOrThrow({ where: { id: attempt.examId } });
  const totalQuestions = await prisma.question.count({ where: { examId: exam.id } });

  attempt = await applyQuestionTimeout(attempt, exam, totalQuestions);
  if (attempt.status !== "IN_PROGRESS") {
    throw new ExamRuleError("หมดเวลาทำข้อสอบแล้ว ระบบส่งคำตอบให้อัตโนมัติ");
  }

  if (!exam.timePerQuestionSeconds) {
    if (requestedIndex >= totalQuestions) throw new ExamRuleError("Question not found");
    if (requestedIndex !== attempt.currentQuestionIndex) {
      attempt = await prisma.examAttempt.update({
        where: { id: attempt.id },
        data: { currentQuestionIndex: requestedIndex },
      });
    }
  } else if (requestedIndex === attempt.currentQuestionIndex + 1 && requestedIndex < totalQuestions) {
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
    secondsLeft: attempt.status === "IN_PROGRESS" ? overallSecondsLeft(attempt, exam) : null,
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

  // The course's class list, room by room, ก–ฮ within a room (the sign-in sheet order).
  const studentSelect = {
    id: true,
    fullName: true,
    firstName: true,
    lastName: true,
    email: true,
    studentCode: true,
    section: true,
    faculty: true,
    major: true,
    avatarUrl: true,
  } as const;
  const enrolledStudents = await prisma.enrollment.findMany({
    where: { courseId: exam.courseId },
    select: { student: { select: studentSelect } },
  });
  const sectionRank = (s: string | null) => (s ? s : "￿");
  const studentsList = (
    enrolledStudents.length > 0
      ? enrolledStudents.map((e) => e.student)
      : await prisma.user.findMany({ where: { role: "STUDENT" }, select: studentSelect })
  ).sort((a, b) => sectionRank(a.section).localeCompare(sectionRank(b.section)) || byThaiName(a, b));
  const seatInSection = new Map<string, number>();
  const perSection = new Map<string, number>();
  for (const s of studentsList) {
    const n = (perSection.get(s.section ?? "") ?? 0) + 1;
    perSection.set(s.section ?? "", n);
    seatInSection.set(s.id, n);
  }

  // Close out attempts whose time ran out while nobody had the exam open
  // (e.g. the student closed the browser), so the monitor doesn't show them running forever.
  const running = await prisma.examAttempt.findMany({ where: { examId, status: "IN_PROGRESS" } });
  for (const a of running) await applyQuestionTimeout(a, exam, exam.questions.length);

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
      section: student.section,
      seatNumber: seatInSection.get(student.id) ?? null,
      faculty: student.faculty || "-",
      major: student.major || "-",
      avatarUrl: student.avatarUrl,
      status: attempt ? attempt.status : "NOT_STARTED",
      attemptCount: attemptCountByStudent.get(student.id) ?? 0,
      endedReason: attempt?.endedReason ?? null,
      questionSecondsLeft:
        attempt && attempt.status === "IN_PROGRESS" ? questionSecondsLeft(attempt, exam) : null,
      secondsLeft: attempt && attempt.status === "IN_PROGRESS" ? overallSecondsLeft(attempt, exam) : null,
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
