/**
 * Adds more rooms (prisma/data/roster-extra.json) WITHOUT touching anyone else:
 * no deletions, no dropped enrollments. Each row keeps the "เลขที่" of its
 * class list (User.seatNo) and gets an access code; re-running keeps codes
 * already issued, so printed slips stay valid.
 *
 * Row: { section, seatNo, studentCode, prefix, firstName, lastName, courses: "ALL" | string[] (course codes) }
 *
 *   npx tsx prisma/seedRosterExtra.ts
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { generateAccessCode, rosterEmail } from "../src/utils/roster";

const prisma = new PrismaClient();

interface Row {
  section: string;
  seatNo: number;
  studentCode: string;
  prefix: string;
  firstName: string;
  lastName: string;
  courses: "ALL" | string[];
}

async function main() {
  const rows: Row[] = JSON.parse(readFileSync(path.join(__dirname, "data/roster-extra.json"), "utf8"));
  const allCourses = await prisma.course.findMany({ select: { id: true, code: true } });
  let created = 0;
  let updated = 0;
  for (const row of rows) {
    const courses = row.courses === "ALL" ? allCourses : allCourses.filter((c) => (row.courses as string[]).includes(c.code));
    if (row.courses !== "ALL" && courses.length !== row.courses.length) throw new Error(`Course missing for ${row.studentCode}: ${row.courses}`);
    const fullName = `${row.prefix}${row.firstName} ${row.lastName}`;
    const profile = { firstName: row.firstName, lastName: row.lastName, fullName, section: row.section, seatNo: row.seatNo, role: "STUDENT", isActive: true };
    const existing = await prisma.user.findUnique({ where: { studentCode: row.studentCode } });
    let id: string;
    if (existing) {
      if (existing.role !== "STUDENT") throw new Error(`${row.studentCode} is a staff account`);
      const accessCode = existing.accessCode ?? generateAccessCode();
      await prisma.user.update({
        where: { id: existing.id },
        data: { ...profile, ...(existing.accessCode ? {} : { accessCode, passwordHash: await bcrypt.hash(accessCode, 10) }) },
      });
      id = existing.id;
      updated++;
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
    for (const course of courses) {
      await prisma.enrollment.upsert({
        where: { courseId_studentId: { courseId: course.id, studentId: id } },
        update: { status: "ACTIVE" },
        create: { courseId: course.id, studentId: id },
      });
    }
  }
  console.log(`Extra roster: ${rows.length} rows (${created} new, ${updated} updated)`);
  for (const s of [...new Set(rows.map((r) => r.section))]) console.log(`  ${s}: ${rows.filter((r) => r.section === s).length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
