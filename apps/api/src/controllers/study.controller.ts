import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { StudyStorageError, uploadStudyMedia } from "../services/studyStorage";

// Review lessons: students read them any time. Nothing here starts a timer or
// locks anything; the exam system (Exam, ExamAttempt) is separate and untouched.

const blockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), text: z.string().max(20000) }),
  // A picture is either a picture link (https) or the picture itself as a data URL, kept inside the content.
  z.object({
    type: z.literal("image"),
    url: z
      .string()
      .max(4_000_000)
      .refine((u) => /^(https?:\/\/|data:image\/)/.test(u), "Picture must be a link or an image data URL"),
    alt: z.string().max(300).optional(),
  }),
]);

const contentSchema = z.object({
  sections: z
    .array(z.object({ title: z.string().min(1).max(300), blocks: z.array(blockSchema) }))
    .max(200),
  questions: z
    .array(
      z
        .object({
          text: z.string().min(1).max(5000),
          choices: z.array(z.object({ label: z.string().max(10), text: z.string().max(1000) })).min(2).max(8),
          answerIndex: z.number().int().min(0),
          explanation: z.string().max(5000).optional().nullable(),
        })
        .refine((q) => q.answerIndex < q.choices.length, { message: "answerIndex out of range" })
    )
    .max(500),
  worksheets: z
    .array(
      z.object({
        title: z.string().min(1).max(300),
        blocks: z.array(blockSchema),
        answers: z.array(blockSchema).optional().nullable(),
      })
    )
    .max(50),
});

const chapterCreateSchema = z.object({
  number: z.number().int().min(1).max(999),
  title: z.string().min(1).max(300),
});

const chapterPatchSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  published: z.boolean().optional(),
});

function isStaff(req: Request) {
  return req.user?.role === "TEACHER" || req.user?.role === "ADMIN";
}

/** Students must be enrolled in the course; teachers only their own; admins all. */
async function canSeeCourse(req: Request, courseId: string) {
  if (!req.user) return false;
  if (req.user.role === "ADMIN") return true;
  if (req.user.role === "TEACHER") {
    const course = await prisma.course.findUnique({ where: { id: courseId }, select: { teacherId: true } });
    return course?.teacherId === req.user.id;
  }
  const enrollment = await prisma.enrollment.findFirst({
    where: { courseId, studentId: req.user.id, status: "ACTIVE" },
    select: { id: true },
  });
  return !!enrollment;
}

async function loadChapterForUser(req: Request, chapterId: string) {
  const chapter = await prisma.studyChapter.findUnique({
    where: { id: chapterId },
    select: { id: true, courseId: true, published: true },
  });
  if (!chapter) return null;
  if (!(await canSeeCourse(req, chapter.courseId))) return null;
  if (!chapter.published && !isStaff(req)) return null;
  return chapter;
}

/** Chapter list for one course. Staff also see unpublished chapters. */
export async function listChapters(req: Request, res: Response) {
  const { courseId } = req.params;
  if (!(await canSeeCourse(req, courseId))) return res.status(404).json({ error: "Course not found" });
  const chapters = await prisma.studyChapter.findMany({
    where: { courseId, ...(isStaff(req) ? {} : { published: true }) },
    orderBy: { number: "asc" },
    select: {
      id: true,
      number: true,
      title: true,
      published: true,
      _count: { select: { sections: true, questions: true, worksheets: true } },
    },
  });
  return res.json(chapters);
}

/** Whole chapter for reading: sections, practice questions (no answers), worksheets (no answers). */
export async function getChapter(req: Request, res: Response) {
  const chapter = await loadChapterForUser(req, req.params.chapterId);
  if (!chapter) return res.status(404).json({ error: "Chapter not found" });
  // Staff get the keys too (for the editor); students never do.
  const staff = isStaff(req);
  const full = await prisma.studyChapter.findUnique({
    where: { id: chapter.id },
    include: {
      sections: { orderBy: { order: "asc" }, select: { id: true, order: true, title: true, blocks: true } },
      questions: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          order: true,
          text: true,
          choices: true,
          ...(staff ? { answerIndex: true, explanation: true } : {}),
        },
      },
      worksheets: {
        orderBy: { order: "asc" },
        select: { id: true, order: true, title: true, blocks: true, ...(staff ? { answers: true } : {}) },
      },
    },
  });
  return res.json(full);
}

/** Checks one practice answer. Students get the key and explanation right away. */
export async function checkQuestion(req: Request, res: Response) {
  const body = z.object({ choice: z.number().int().min(0) }).parse(req.body);
  const question = await prisma.studyQuestion.findUnique({
    where: { id: req.params.questionId },
    select: { chapterId: true, answerIndex: true, explanation: true },
  });
  if (!question || !(await loadChapterForUser(req, question.chapterId))) {
    return res.status(404).json({ error: "Question not found" });
  }
  return res.json({
    correct: body.choice === question.answerIndex,
    answerIndex: question.answerIndex,
    explanation: question.explanation,
  });
}

/** Worksheet answers, fetched only when the student asks for them. */
export async function getWorksheetAnswers(req: Request, res: Response) {
  const worksheet = await prisma.studyWorksheet.findUnique({
    where: { id: req.params.worksheetId },
    select: { chapterId: true, answers: true },
  });
  if (!worksheet || !(await loadChapterForUser(req, worksheet.chapterId))) {
    return res.status(404).json({ error: "Worksheet not found" });
  }
  return res.json({ answers: worksheet.answers ?? [] });
}

export async function createChapter(req: Request, res: Response) {
  const { courseId } = req.params;
  if (!(await canSeeCourse(req, courseId))) return res.status(404).json({ error: "Course not found" });
  const data = chapterCreateSchema.parse(req.body);
  const chapter = await prisma.studyChapter.create({ data: { ...data, courseId } });
  return res.status(201).json(chapter);
}

export async function updateChapter(req: Request, res: Response) {
  const chapter = await prisma.studyChapter.findUnique({ where: { id: req.params.chapterId }, select: { courseId: true } });
  if (!chapter || !(await canSeeCourse(req, chapter.courseId))) return res.status(404).json({ error: "Chapter not found" });
  const data = chapterPatchSchema.parse(req.body);
  const updated = await prisma.studyChapter.update({ where: { id: req.params.chapterId }, data });
  return res.json(updated);
}

export async function deleteChapter(req: Request, res: Response) {
  const chapter = await prisma.studyChapter.findUnique({ where: { id: req.params.chapterId }, select: { courseId: true } });
  if (!chapter || !(await canSeeCourse(req, chapter.courseId))) return res.status(404).json({ error: "Chapter not found" });
  await prisma.studyChapter.delete({ where: { id: req.params.chapterId } });
  return res.status(204).end();
}

/** Replaces all sections, questions and worksheets of a chapter in one transaction (used by the editor and the importer). */
export async function replaceContent(req: Request, res: Response) {
  const chapter = await prisma.studyChapter.findUnique({ where: { id: req.params.chapterId }, select: { courseId: true } });
  if (!chapter || !(await canSeeCourse(req, chapter.courseId))) return res.status(404).json({ error: "Chapter not found" });
  const content = contentSchema.parse(req.body);
  const chapterId = req.params.chapterId;
  await prisma.$transaction([
    prisma.studySection.deleteMany({ where: { chapterId } }),
    prisma.studyQuestion.deleteMany({ where: { chapterId } }),
    prisma.studyWorksheet.deleteMany({ where: { chapterId } }),
    prisma.studySection.createMany({
      data: content.sections.map((s, i) => ({ chapterId, order: i + 1, title: s.title, blocks: s.blocks })),
    }),
    prisma.studyQuestion.createMany({
      data: content.questions.map((q, i) => ({
        chapterId,
        order: i + 1,
        text: q.text,
        choices: q.choices,
        answerIndex: q.answerIndex,
        explanation: q.explanation ?? null,
      })),
    }),
    prisma.studyWorksheet.createMany({
      data: content.worksheets.map((w, i) => ({
        chapterId,
        order: i + 1,
        title: w.title,
        blocks: w.blocks,
        answers: w.answers ?? undefined,
      })),
    }),
  ]);
  return res.json({
    sections: content.sections.length,
    questions: content.questions.length,
    worksheets: content.worksheets.length,
  });
}

/** Uploads one picture for a lesson. Staff only; the returned URL goes into a block. */
export async function uploadMedia(req: Request, res: Response) {
  if (!req.file) return res.status(400).json({ error: "No file" });
  if (!req.file.mimetype.startsWith("image/")) {
    return res.status(400).json({ error: "Only image files can be uploaded here" });
  }
  try {
    const url = await uploadStudyMedia(req.file.buffer, req.file.mimetype, req.file.originalname, "lessons");
    return res.status(201).json({ url });
  } catch (err) {
    if (err instanceof StudyStorageError) {
      return res.status(503).json({ error: err.message });
    }
    throw err;
  }
}
