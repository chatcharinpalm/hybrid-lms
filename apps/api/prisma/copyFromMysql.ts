/**
 * One-time copy of the class data from the old local MySQL (XAMPP) database into
 * the Postgres database DATABASE_URL points at (Supabase): staff and students
 * (same ids, same access codes, so printed slips stay valid), courses,
 * enrollments, exams, questions and options. Exam attempts and logs from
 * testing are left behind, so the real site starts clean.
 *
 *   MYSQL_URL=mysql://root:@localhost:3306/hybrid_lms \
 *     node -r ts-node/register/transpile-only prisma/copyFromMysql.ts
 *
 * Refuses to run into a database that already has users.
 */
import { PrismaClient } from "@prisma/client";
import mysql from "mysql2/promise";

const prisma = new PrismaClient();

/** MySQL keeps booleans as 0/1. */
const bool = (v: unknown) => v === 1 || v === true || v === "1";

async function main() {
  const url = process.env.MYSQL_URL;
  if (!url) throw new Error("Set MYSQL_URL to the old MySQL database");
  if ((await prisma.user.count()) > 0) throw new Error("Target database already has users; not copying over it");

  const my = await mysql.createConnection(url);
  // Table names are lower case on Windows MySQL.
  const rows = async (table: string) => (await my.query(`SELECT * FROM \`${table}\``))[0] as Record<string, any>[];

  const users = await rows("user");
  await prisma.user.createMany({
    data: users.map((u) => ({ ...u, isActive: bool(u.isActive) })) as any,
  });

  await prisma.course.createMany({ data: (await rows("course")) as any });
  await prisma.enrollment.createMany({ data: (await rows("enrollment")) as any });

  const exams = await rows("exam");
  await prisma.exam.createMany({
    data: exams.map((e) => ({
      ...e,
      requireFullscreen: bool(e.requireFullscreen),
      blockClipboard: bool(e.blockClipboard),
      blockContextMenu: bool(e.blockContextMenu),
      shuffleQuestions: bool(e.shuffleQuestions),
      shuffleOptions: bool(e.shuffleOptions),
      // Every room starts closed on the real site.
      status: e.status === "OPEN" ? "CLOSED" : e.status,
    })) as any,
  });

  await prisma.question.createMany({ data: (await rows("question")) as any });

  const options = await rows("questionoption");
  for (let i = 0; i < options.length; i += 1000) {
    await prisma.questionOption.createMany({
      data: options.slice(i, i + 1000).map((o) => ({ ...o, isCorrect: bool(o.isCorrect) })) as any,
    });
  }

  await my.end();
  console.log(
    `Copied: ${users.length} users, ${await prisma.course.count()} courses, ${await prisma.enrollment.count()} enrollments, ` +
      `${exams.length} exams, ${await prisma.question.count()} questions, ${options.length} options`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
