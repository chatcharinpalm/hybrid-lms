import { prisma } from "../prisma";
import { byThaiName } from "../utils/roster";
import { drawnCount } from "./draw";
import { readSections } from "./examRooms";
import { ExamRuleError } from "./examSession.service";
import type { StaffActor } from "./proctorControl.service";

/**
 * The course gradebook, for staff only: every student on the class list
 * (room by room, in sign-in-sheet order) against every exam of the course,
 * with every sitting each student made — retakes, remedial re-sits and reset
 * attempts included — so nothing a student scored is ever lost.
 */
export async function getGradebook(courseId: string, actor: StaffActor) {
  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { id: true, title: true, teacherId: true } });
  if (!course) throw new ExamRuleError("ไม่พบรายวิชา");
  if (actor.role !== "ADMIN" && course.teacherId !== actor.id) throw new ExamRuleError("คุณไม่มีสิทธิ์ดูคะแนนของรายวิชานี้");

  const [examRows, enrollments] = await Promise.all([
    prisma.exam.findMany({
      where: { courseId },
      select: {
        id: true,
        title: true,
        status: true,
        isHidden: true,
        passScorePercent: true,
        drawJson: true,
        sections: true,
        questions: { where: { type: { not: "ESSAY" } }, select: { id: true, group: true, order: true } },
      },
    }),
    prisma.enrollment.findMany({
      where: { courseId },
      select: { student: { select: { id: true, fullName: true, firstName: true, lastName: true, studentCode: true, section: true } } },
    }),
  ]);

  // Chapter order, as the papers are numbered.
  const exams = examRows
    .sort((a, b) => a.title.localeCompare(b.title, "th", { numeric: true }))
    .map(({ questions, drawJson, sections, ...e }) => ({
      ...e,
      totalQuestions: drawnCount(questions, drawJson),
      /** Rooms set to sit it; null = every room. */
      sections: readSections(sections),
    }));

  const sectionRank = (s: string | null) => s ?? "￿";
  const list = enrollments
    .map((e) => e.student)
    .sort((a, b) => sectionRank(a.section).localeCompare(sectionRank(b.section)) || byThaiName(a, b));
  const seats = new Map<string, number>();
  const students = list.map((s) => {
    const seatNumber = (seats.get(s.section ?? "") ?? 0) + 1;
    seats.set(s.section ?? "", seatNumber);
    return { id: s.id, fullName: s.fullName, studentCode: s.studentCode, section: s.section, seatNumber };
  });

  const attempts = await prisma.examAttempt.findMany({
    where: { examId: { in: exams.map((e) => e.id) } },
    orderBy: { startedAt: "asc" },
    select: {
      id: true,
      examId: true,
      studentId: true,
      status: true,
      startedAt: true,
      submittedAt: true,
      scorePoints: true,
      scorePercent: true,
      passed: true,
      endedReason: true,
      violationCount: true,
      archivedAt: true,
    },
  });

  return { course: { id: course.id, title: course.title }, exams, students, attempts };
}
