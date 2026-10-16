import type { Role } from "../constants";
import { prisma } from "../prisma";
import { ExamRuleError, gradeAndSubmit } from "./examSession.service";
import { readSections, writeSections } from "./examRooms";

/**
 * Back-office controls over a running exam. Every action is written to
 * AuditLog so there is a record of who did what to which student.
 */

export interface StaffActor {
  id: string;
  role: Role;
}

/** Teachers may only control exams in courses they teach; admins control everything. */
async function requireExamControl(examId: string, actor: StaffActor) {
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    include: { course: { select: { teacherId: true } } },
  });
  if (!exam) throw new ExamRuleError("Exam not found");
  if (actor.role !== "ADMIN" && exam.course.teacherId !== actor.id) {
    throw new ExamRuleError("คุณไม่มีสิทธิ์ควบคุมข้อสอบนี้");
  }
  return exam;
}

async function requireAttemptControl(attemptId: string, actor: StaffActor) {
  const attempt = await prisma.examAttempt.findUnique({ where: { id: attemptId } });
  if (!attempt) throw new ExamRuleError("Attempt not found");
  // A reset attempt is history: nothing more is done to it.
  if (attempt.archivedAt) throw new ExamRuleError("รอบนี้ถูกรีเซ็ตไปแล้ว");
  const exam = await requireExamControl(attempt.examId, actor);
  return { attempt, exam };
}

/** examId is always recorded, so the exam's history is found by exam. */
function audit(actor: StaffActor, action: string, entity: string, entityId: string, examId: string, metadata?: object) {
  return prisma.auditLog.create({
    data: {
      actorId: actor.id,
      action,
      entity,
      entityId,
      metadata: JSON.stringify({ examId, ...metadata }),
    },
  });
}

/**
 * Opens or closes an exam. Opening may set the time allowed (minutes), asked
 * for in the back office before the room opens. Closing submits every attempt
 * still in progress.
 */
export async function setExamStatus(
  examId: string,
  status: "OPEN" | "CLOSED",
  actor: StaffActor,
  durationMinutes?: number,
  /** Opening: the rooms that sit it (null = every room); left as is when absent. */
  sections?: string[] | null
) {
  const before = await requireExamControl(examId, actor);
  await prisma.exam.update({
    where: { id: examId },
    data: {
      status,
      ...(status === "OPEN" && durationMinutes ? { durationMinutes } : {}),
      ...(status === "OPEN" && sections !== undefined ? { sections: writeSections(sections) } : {}),
    },
  });

  let submitted = 0;
  if (status === "CLOSED") {
    const running = await prisma.examAttempt.findMany({
      where: { examId, status: "IN_PROGRESS", archivedAt: null },
      select: { id: true },
    });
    // A few at a time: a full room closes in seconds without flooding the database.
    for (let i = 0; i < running.length; i += 5) {
      await Promise.all(running.slice(i, i + 5).map((a) => gradeAndSubmit(a.id, "SUBMITTED", "EXAM_CLOSED")));
    }
    submitted = running.length;
  }

  await audit(actor, `EXAM_${status}`, "Exam", examId, examId, {
    submitted,
    ...(status === "OPEN" && durationMinutes ? { durationMinutes, previousMinutes: before.durationMinutes } : {}),
    ...(status === "OPEN" && sections !== undefined ? { sections: sections ?? "ทุกห้อง" } : {}),
  });
  return { status, submitted };
}

/** Exam settings the back office changes outside a sitting: hidden from students, when the marked paper is shown. */
export async function updateExamSettings(
  examId: string,
  settings: {
    isHidden?: boolean;
    reviewMode?: "AFTER_SUBMIT" | "AFTER_CLOSE" | "NEVER";
    durationMinutes?: number;
    /** The rooms that sit the exam; null = every room. */
    sections?: string[] | null;
  },
  actor: StaffActor
) {
  await requireExamControl(examId, actor);
  const { sections, ...rest } = settings;
  const exam = await prisma.exam.update({
    where: { id: examId },
    data: { ...rest, ...(sections !== undefined ? { sections: writeSections(sections) } : {}) },
    select: { id: true, isHidden: true, reviewMode: true, durationMinutes: true, sections: true },
  });
  await audit(actor, "EXAM_SETTINGS", "Exam", examId, examId, settings);
  return { ...exam, sections: readSections(exam.sections) };
}

/**
 * What is open right now, for the back office's front page: every OPEN exam
 * (the teacher's own courses; admins see all) with its rooms and, room by
 * room, how many students are sitting it and how many have handed in.
 */
export async function liveSummary(actor: StaffActor) {
  const exams = await prisma.exam.findMany({
    where: { status: "OPEN", ...(actor.role === "ADMIN" ? {} : { course: { teacherId: actor.id } }) },
    select: { id: true, title: true, courseId: true, sections: true, durationMinutes: true, updatedAt: true, course: { select: { title: true } } },
    orderBy: { title: "asc" },
  });
  return Promise.all(
    exams.map(async (e) => {
      const rooms = readSections(e.sections);
      const [enrolled, attempts] = await Promise.all([
        prisma.enrollment.findMany({ where: { courseId: e.courseId }, select: { student: { select: { id: true, section: true } } } }),
        prisma.examAttempt.findMany({ where: { examId: e.id, archivedAt: null }, select: { studentId: true, status: true }, orderBy: { startedAt: "asc" } }),
      ]);
      // Each student's latest counted sitting.
      const latest = new Map(attempts.map((a) => [a.studentId, a.status]));
      const perRoom = new Map<string, { room: string; students: number; inProgress: number; submitted: number }>();
      for (const { student } of enrolled) {
        const room = student.section ?? "ไม่ระบุห้อง";
        if (rooms && !rooms.includes(room)) continue;
        const r = perRoom.get(room) ?? { room, students: 0, inProgress: 0, submitted: 0 };
        r.students++;
        const s = latest.get(student.id);
        if (s === "IN_PROGRESS") r.inProgress++;
        else if (s) r.submitted++;
        perRoom.set(room, r);
      }
      return {
        id: e.id,
        title: e.title,
        courseId: e.courseId,
        courseTitle: e.course.title,
        sections: rooms,
        durationMinutes: e.durationMinutes,
        rooms: [...perRoom.values()].sort((a, b) => a.room.localeCompare(b.room)),
      };
    })
  );
}

/** The rooms on a course's class list, for choosing which rooms sit an exam. */
export async function courseSections(courseId: string) {
  const rows = await prisma.user.findMany({
    where: { role: "STUDENT", section: { not: null }, enrollments: { some: { courseId } } },
    select: { section: true },
    distinct: ["section"],
  });
  return rows.map((r) => r.section!).sort();
}

/** For writing explanations: each question in the paper's order with its right answer. */
export async function getAnswerKey(examId: string, actor: StaffActor) {
  const exam = await requireExamControl(examId, actor);
  const questions = await prisma.question.findMany({
    where: { examId },
    orderBy: [{ order: "asc" }, { id: "asc" }],
    select: {
      id: true,
      order: true,
      type: true,
      prompt: true,
      answerKey: true,
      explanation: true,
      options: { where: { isCorrect: true }, select: { code: true, label: true } },
    },
  });
  return {
    exam: { id: exam.id, title: exam.title, reviewMode: exam.reviewMode },
    questions: questions.map(({ options, answerKey, ...q }) => ({
      ...q,
      correct: options[0] ? { code: options[0].code, label: options[0].label } : answerKey ? { code: null, label: answerKey } : null,
    })),
  };
}

/** Saves the teacher's explanations (empty text clears one). */
export async function saveExplanations(examId: string, items: Array<{ questionId: string; explanation: string }>, actor: StaffActor) {
  await requireExamControl(examId, actor);
  await prisma.$transaction(
    items.map((i) =>
      prisma.question.updateMany({
        where: { id: i.questionId, examId },
        data: { explanation: i.explanation.trim() || null },
      })
    )
  );
  await audit(actor, "EXAM_EXPLANATIONS", "Exam", examId, examId, { count: items.length });
}

/** Ends one student's attempt now and grades what they have answered. */
export async function forceSubmit(attemptId: string, actor: StaffActor, reason?: string) {
  const { attempt } = await requireAttemptControl(attemptId, actor);
  if (attempt.status !== "IN_PROGRESS") throw new ExamRuleError("ผู้สอบคนนี้ส่งข้อสอบไปแล้ว");
  await gradeAndSubmit(attemptId, "AUTO_SUBMITTED", "ADMIN_FORCED");
  await audit(actor, "ATTEMPT_FORCE_SUBMIT", "ExamAttempt", attemptId, attempt.examId, {
    studentId: attempt.studentId,
    reason: reason ?? null,
  });
}

/**
 * Lets the student start over. The attempt is archived, not deleted: it no
 * longer counts (monitor, result, attempt limit) but stays in the gradebook
 * with its score and answers, so every sitting is on record.
 */
export async function resetAttempt(attemptId: string, actor: StaffActor, reason?: string) {
  const { attempt } = await requireAttemptControl(attemptId, actor);
  await prisma.examAttempt.update({ where: { id: attemptId }, data: { archivedAt: new Date() } });
  await audit(actor, "ATTEMPT_RESET", "ExamAttempt", attemptId, attempt.examId, {
    studentId: attempt.studentId,
    status: attempt.status,
    scorePoints: attempt.scorePoints,
    violationCount: attempt.violationCount,
    reason: reason ?? null,
  });
}

/** Sets the violation counter back to zero. The individual violation logs are kept. */
export async function forgiveViolations(attemptId: string, actor: StaffActor) {
  const { attempt } = await requireAttemptControl(attemptId, actor);
  if (attempt.status !== "IN_PROGRESS") throw new ExamRuleError("ผู้สอบคนนี้ส่งข้อสอบไปแล้ว");
  await prisma.examAttempt.update({ where: { id: attemptId }, data: { violationCount: 0 } });
  await audit(actor, "ATTEMPT_FORGIVE_VIOLATIONS", "ExamAttempt", attemptId, attempt.examId, {
    studentId: attempt.studentId,
    previousCount: attempt.violationCount,
  });
}

/**
 * Gives the student more time: on the current question for per-question timed
 * exams, otherwise on the whole exam.
 */
export async function addQuestionTime(attemptId: string, seconds: number, actor: StaffActor) {
  const { attempt, exam } = await requireAttemptControl(attemptId, actor);
  if (attempt.status !== "IN_PROGRESS") throw new ExamRuleError("ผู้สอบคนนี้ส่งข้อสอบไปแล้ว");
  if (exam.timePerQuestionSeconds) {
    if (!attempt.currentQuestionStartedAt) throw new ExamRuleError("ยังไม่เริ่มจับเวลาข้อปัจจุบัน");
    await prisma.examAttempt.update({
      where: { id: attemptId },
      data: { currentQuestionStartedAt: new Date(attempt.currentQuestionStartedAt.getTime() + seconds * 1000) },
    });
  } else {
    await prisma.examAttempt.update({
      where: { id: attemptId },
      data: { extraTimeSeconds: { increment: seconds } },
    });
  }
  await audit(actor, "ATTEMPT_ADD_TIME", "ExamAttempt", attemptId, attempt.examId, {
    studentId: attempt.studentId,
    seconds,
    questionIndex: attempt.currentQuestionIndex,
  });
}

/** Queues a warning that pops up on the student's exam screen. */
export async function sendMessage(attemptId: string, message: string, actor: StaffActor) {
  const { attempt } = await requireAttemptControl(attemptId, actor);
  if (attempt.status !== "IN_PROGRESS") throw new ExamRuleError("ผู้สอบคนนี้ส่งข้อสอบไปแล้ว");
  await prisma.proctorMessage.create({ data: { attemptId, message } });
  await audit(actor, "ATTEMPT_MESSAGE", "ExamAttempt", attemptId, attempt.examId, { studentId: attempt.studentId, message });
}

/** Recent back-office actions on this exam and its attempts, newest first. */
export async function listExamAuditLog(examId: string, actor: StaffActor) {
  await requireExamControl(examId, actor);
  const logs = await prisma.auditLog.findMany({
    where: { metadata: { contains: `"examId":"${examId}"` } },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { actor: { select: { fullName: true } } },
  });
  return logs.map((l) => ({
    id: l.id,
    action: l.action,
    actorName: l.actor?.fullName ?? "-",
    createdAt: l.createdAt,
    metadata: l.metadata ? JSON.parse(l.metadata) : null,
  }));
}
