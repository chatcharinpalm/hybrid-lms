import type { Role } from "../constants";
import { prisma } from "../prisma";
import { ExamRuleError, gradeAndSubmit } from "./examSession.service";

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
  const exam = await requireExamControl(attempt.examId, actor);
  return { attempt, exam };
}

/** examId is always recorded so the exam's history survives attempts being reset (deleted). */
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

/** Opens or closes an exam. Closing submits every attempt still in progress. */
export async function setExamStatus(examId: string, status: "OPEN" | "CLOSED", actor: StaffActor) {
  await requireExamControl(examId, actor);
  await prisma.exam.update({ where: { id: examId }, data: { status } });

  let submitted = 0;
  if (status === "CLOSED") {
    const running = await prisma.examAttempt.findMany({
      where: { examId, status: "IN_PROGRESS" },
      select: { id: true },
    });
    for (const a of running) {
      await gradeAndSubmit(a.id, "SUBMITTED", "EXAM_CLOSED");
    }
    submitted = running.length;
  }

  await audit(actor, `EXAM_${status}`, "Exam", examId, examId, { submitted });
  return { status, submitted };
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
 * Deletes the attempt (answers, violation logs and messages cascade) so the
 * student can start over. The audit entry keeps a snapshot of what was removed.
 */
export async function resetAttempt(attemptId: string, actor: StaffActor, reason?: string) {
  const { attempt } = await requireAttemptControl(attemptId, actor);
  await prisma.examAttempt.delete({ where: { id: attemptId } });
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

/** Extends the time on the student's current question. */
export async function addQuestionTime(attemptId: string, seconds: number, actor: StaffActor) {
  const { attempt, exam } = await requireAttemptControl(attemptId, actor);
  if (attempt.status !== "IN_PROGRESS") throw new ExamRuleError("ผู้สอบคนนี้ส่งข้อสอบไปแล้ว");
  if (!exam.timePerQuestionSeconds || !attempt.currentQuestionStartedAt) {
    throw new ExamRuleError("ข้อสอบนี้ไม่ได้จำกัดเวลารายข้อ");
  }
  await prisma.examAttempt.update({
    where: { id: attemptId },
    data: { currentQuestionStartedAt: new Date(attempt.currentQuestionStartedAt.getTime() + seconds * 1000) },
  });
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
