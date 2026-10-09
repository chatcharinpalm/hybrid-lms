/**
 * Loads the official class list (prisma/data/roster.json, built from
 * "รายชื่อนักศึกษา 3 ห้อง.xlsx") into the exam course and replaces the demo
 * students. Every student gets an access code to sign in with; re-running keeps
 * the codes already issued, so printed slips stay valid.
 *
 *   node -r ts-node/register/transpile-only prisma/seedRoster.ts
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { byThaiName, generateAccessCode, rosterEmail } from "../src/utils/roster";
import { COURSES } from "./data/courses";

const prisma = new PrismaClient();

interface RosterRow {
  section: string;
  studentCode: string;
  prefix: string;
  firstName: string;
  lastName: string;
}

async function main() {
  const roster: RosterRow[] = JSON.parse(readFileSync(path.join(__dirname, "data/roster.json"), "utf8"));
  // Run seedCourses.ts first.
  const courses = await prisma.course.findMany({ where: { code: { in: COURSES.map((c) => c.code) } } });
  if (courses.length !== COURSES.length) throw new Error("Courses missing: run prisma/seedCourses.ts first");

  // The 30 made-up demo students (student01–30@netsechub.dev) go, with their attempts.
  const demo = await prisma.user.deleteMany({
    where: { role: "STUDENT", email: { startsWith: "student", endsWith: "@netsechub.dev" } },
  });
  console.log(`Removed ${demo.count} demo students`);

  const keepIds: string[] = [];
  let created = 0;
  for (const row of roster) {
    const fullName = `${row.prefix}${row.firstName} ${row.lastName}`;
    const existing = await prisma.user.findUnique({ where: { studentCode: row.studentCode } });
    const profile = { firstName: row.firstName, lastName: row.lastName, fullName, section: row.section, role: "STUDENT" };
    let id: string;
    if (existing) {
      const accessCode = existing.accessCode ?? generateAccessCode();
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          ...profile,
          email: rosterEmail(row.studentCode),
          ...(existing.accessCode ? {} : { accessCode, passwordHash: await bcrypt.hash(accessCode, 10) }),
        },
      });
      id = existing.id;
    } else {
      const accessCode = generateAccessCode();
      const user = await prisma.user.create({
        data: {
          ...profile,
          email: rosterEmail(row.studentCode),
          studentCode: row.studentCode,
          accessCode,
          passwordHash: await bcrypt.hash(accessCode, 10),
        },
      });
      id = user.id;
      created++;
    }
    keepIds.push(id);
    for (const course of courses) {
      await prisma.enrollment.upsert({
        where: { courseId_studentId: { courseId: course.id, studentId: id } },
        update: { status: "ACTIVE" },
        create: { courseId: course.id, studentId: id },
      });
    }
  }

  // Anyone else enrolled (e.g. a self-registered account) leaves the class list.
  const dropped = await prisma.enrollment.deleteMany({
    where: { courseId: { in: courses.map((c) => c.id) }, studentId: { notIn: keepIds } },
  });

  console.log(`Roster: ${roster.length} students (${created} new), ${dropped.count} other enrollments removed`);
  for (const section of [...new Set(roster.map((r) => r.section))]) {
    const list = roster.filter((r) => r.section === section).sort(byThaiName);
    console.log(`  ${section}: ${list.length} — ${list[0].firstName} … ${list[list.length - 1].firstName}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
