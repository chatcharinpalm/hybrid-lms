/**
 * The two real courses the exams belong to, and the staff password.
 * Renames the original demo course (CPE-321) in place so its exams stay attached.
 *
 *   node -r ts-node/register/transpile-only prisma/seedCourses.ts
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { COURSES } from "./data/courses";

const prisma = new PrismaClient();
// Never in the repo: set STAFF_PASSWORD in apps/api/.env (or the shell). Unset = leave passwords as they are.
const STAFF_PASSWORD = process.env.STAFF_PASSWORD;

async function main() {
  const teacher = await prisma.user.findUniqueOrThrow({ where: { email: "teacher@netsechub.dev" } });

  for (const c of COURSES) {
    const existing =
      (await prisma.course.findUnique({ where: { code: c.code } })) ??
      (c.legacyCode ? await prisma.course.findUnique({ where: { code: c.legacyCode } }) : null);
    const data = { code: c.code, title: c.title, description: c.description, termLabel: c.termLabel, teacherId: teacher.id };
    const course = existing
      ? await prisma.course.update({ where: { id: existing.id }, data })
      : await prisma.course.create({ data });
    console.log(`${existing ? "Updated" : "Created"} ${course.code} ${course.title}`);

    // Exams that belong to this course by title prefix ("แบบทดสอบ บทที่ 7 ...").
    for (const prefix of c.examTitlePrefixes) {
      const moved = await prisma.exam.updateMany({
        where: { title: { startsWith: prefix }, courseId: { not: course.id } },
        data: { courseId: course.id },
      });
      if (moved.count) console.log(`  moved ${moved.count} exam(s) "${prefix}…"`);
    }
  }

  if (STAFF_PASSWORD) {
    const passwordHash = await bcrypt.hash(STAFF_PASSWORD, 12);
    const staff = await prisma.user.updateMany({ where: { role: { in: ["ADMIN", "TEACHER"] } }, data: { passwordHash } });
    console.log(`Staff password set for ${staff.count} accounts`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
