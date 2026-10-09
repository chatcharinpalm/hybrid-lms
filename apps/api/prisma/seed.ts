/**
 * Staff accounts only. Everything else comes from the teacher's documents:
 *
 *   1. prisma/seed.ts          staff accounts (this file)
 *   2. prisma/seedCourses.ts   the two courses (+ staff password)
 *   3. prisma/seedRoster.ts    class list from the roster spreadsheet
 *   4. prisma/seedExam5.ts, seedPaperExam.ts data/exam6.json, data/exam7.json
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Never in the repo: set STAFF_PASSWORD in apps/api/.env (or the shell) when seeding.
  const password = process.env.STAFF_PASSWORD;
  if (!password) throw new Error("Set STAFF_PASSWORD to seed the staff accounts");
  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.upsert({
    where: { email: "admin@netsechub.dev" },
    update: {},
    create: {
      email: "admin@netsechub.dev",
      passwordHash,
      firstName: "ผู้ดูแล",
      lastName: "ระบบ",
      fullName: "ผู้ดูแลระบบ",
      role: "ADMIN",
    },
  });

  await prisma.user.upsert({
    where: { email: "teacher@netsechub.dev" },
    update: {},
    create: {
      email: "teacher@netsechub.dev",
      passwordHash,
      firstName: "วิทวัส",
      lastName: "ทิพย์สุวรรณ",
      fullName: "ดร.วิทวัส ทิพย์สุวรรณ",
      role: "TEACHER",
      avatarUrl: "/teacher.png",
    },
  });

  // eslint-disable-next-line no-console
  console.log("Seed complete: admin@netsechub.dev / teacher@netsechub.dev");
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
