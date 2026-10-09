import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../prisma";
import { byThaiName, generateAccessCode } from "../utils/roster";

/**
 * The class lists, one per room, ก–ฮ — with each student's access code, for
 * printing the sign-in sheet and the code slips handed out after signing.
 */
export async function getRoster(_req: Request, res: Response) {
  const students = await prisma.user.findMany({
    where: { role: "STUDENT", section: { not: null } },
    select: { id: true, firstName: true, lastName: true, fullName: true, studentCode: true, section: true, accessCode: true },
  });
  const sections = [...new Set(students.map((s) => s.section!))].sort();
  return res.json({
    sections: sections.map((name) => ({
      name,
      students: students
        .filter((s) => s.section === name)
        .sort(byThaiName)
        .map((s, i) => ({
          id: s.id,
          seatNumber: i + 1,
          studentCode: s.studentCode,
          fullName: s.fullName,
          accessCode: s.accessCode,
        })),
    })),
  });
}

async function issueCode(studentId: string) {
  const accessCode = generateAccessCode();
  await prisma.user.update({
    where: { id: studentId },
    data: { accessCode, passwordHash: await bcrypt.hash(accessCode, 10) },
  });
  return accessCode;
}

/** New code for one student (e.g. a lost slip); the old one stops working at once. */
export async function regenerateCode(req: Request, res: Response) {
  const student = await prisma.user.findFirst({ where: { id: req.params.studentId, role: "STUDENT" } });
  if (!student) return res.status(404).json({ error: "ไม่พบนักศึกษา" });
  const accessCode = await issueCode(student.id);
  await prisma.auditLog.create({
    data: { actorId: req.user!.id, action: "STUDENT_CODE_RESET", entity: "User", entityId: student.id },
  });
  return res.json({ accessCode });
}

/**
 * New codes for a whole room — before each exam, so slips handed out last
 * time (or to someone who then left) no longer get anyone in.
 */
export async function regenerateSectionCodes(req: Request, res: Response) {
  const { section } = z.object({ section: z.string().min(1) }).parse(req.body);
  const students = await prisma.user.findMany({ where: { role: "STUDENT", section }, select: { id: true } });
  for (const s of students) await issueCode(s.id);
  await prisma.auditLog.create({
    data: {
      actorId: req.user!.id,
      action: "SECTION_CODES_RESET",
      entity: "Section",
      metadata: JSON.stringify({ section, count: students.length }),
    },
  });
  return res.json({ count: students.length });
}
