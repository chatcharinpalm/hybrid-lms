/**
 * Seeds a fill-in-the-blank paper exam (same template as Chapter 5) from a
 * JSON file in prisma/data, extracted from the teacher's Word paper:
 *
 *   node -r ts-node/register/transpile-only prisma/seedPaperExam.ts data/exam6.json [--force]
 *
 * Re-running replaces the questions. That invalidates existing attempts, so it
 * refuses when students have already taken the exam unless --force is given.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface PaperExamFile {
  /** Course the exam belongs to (see data/courses.ts). */
  courseCode: string;
  title: string;
  /** Earlier titles of the same exam, so a renamed paper updates in place. */
  legacyTitles: string[];
  durationMinutes: number;
  /** The Option Bank as printed (code → text). Codes are re-dealt per student on screen. */
  bank: Array<{ code: string; label: string }>;
  /** num = number on the paper; answer = bank code of the correct entry. */
  questions: Array<{ num: number; prompt: string; answer: string }>;
}

async function main() {
  const [file, flag] = process.argv.slice(2);
  if (!file) throw new Error("usage: seedPaperExam.ts data/examN.json [--force]");
  const data: PaperExamFile = JSON.parse(readFileSync(path.resolve(__dirname, file), "utf8"));

  const codes = new Set(data.bank.map((b) => b.code));
  for (const q of data.questions) {
    if (!codes.has(q.answer)) throw new Error(`ข้อ ${q.num}: answer ${q.answer} is not in the bank`);
    if (!q.prompt.includes("______")) throw new Error(`ข้อ ${q.num}: no blank in the prompt`);
  }

  const course = await prisma.course.findUniqueOrThrow({ where: { code: data.courseCode } });
  const settings = {
    courseId: course.id,
    title: data.title,
    description: `จำนวน ${data.questions.length} ข้อ`,
    durationMinutes: data.durationMinutes, // whole paper, flip back and forth freely
    timePerQuestionSeconds: null,
    maxAttempts: 0, // unlimited retakes while the room is open
    shuffleQuestions: true,
    // Option Bank codes map to different answers for every student.
    shuffleOptions: true,
  };

  let exam = await prisma.exam.findFirst({ where: { title: { in: [data.title, ...data.legacyTitles] } } });
  if (exam) {
    const attempts = await prisma.examAttempt.count({ where: { examId: exam.id } });
    if (attempts > 0 && flag !== "--force") {
      throw new Error(`"${exam.title}" already has ${attempts} attempts; re-run with --force to replace them`);
    }
    await prisma.examAttempt.deleteMany({ where: { examId: exam.id } });
    await prisma.question.deleteMany({ where: { examId: exam.id } });
    exam = await prisma.exam.update({ where: { id: exam.id }, data: settings });
    console.log(`Updated exam ${exam.id}`);
  } else {
    exam = await prisma.exam.create({
      data: {
        ...settings,
        // No schedule: the room stays closed until a proctor opens it from the monitor page.
        status: "CLOSED",
        passScorePercent: 60,
        requireFullscreen: true,
        blockClipboard: true,
        blockContextMenu: true,
        maxViolations: 3,
      },
    });
    console.log(`Created exam ${exam.id}`);
  }

  for (const q of data.questions) {
    await prisma.question.create({
      data: {
        examId: exam.id,
        type: "FILL_IN_BANK",
        // No source number in the prompt: each student sees a shuffled order.
        prompt: q.prompt,
        points: 1,
        order: q.num,
        options: {
          create: data.bank.map((b, idx) => ({ label: b.label, code: b.code, isCorrect: b.code === q.answer, order: idx })),
        },
      },
    });
  }
  console.log(`Seeded ${data.questions.length} questions, bank of ${data.bank.length}: "${data.title}"`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
