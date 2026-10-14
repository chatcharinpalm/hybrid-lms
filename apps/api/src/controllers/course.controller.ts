import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../prisma";

/** Public course card for the login page: course info plus the instructor's display name and photo. */
export async function getCourseInstructor(req: Request, res: Response) {
  const course = await prisma.course.findUnique({
    where: { code: req.params.code },
    select: {
      code: true,
      title: true,
      teacher: { select: { fullName: true, avatarUrl: true } },
    },
  });
  if (!course) return res.status(404).json({ error: "Course not found" });
  return res.json(course);
}

export async function listCourses(req: Request, res: Response) {
  // Public/anonymous browsing shows the visible catalog. A logged-in caller
  // gets a personalized view instead (their enrollments, or the courses
  // they teach) so the admin/exam pages still scope correctly. Hidden
  // courses are left out for everyone but staff.
  const where: Prisma.CourseWhereInput = !req.user
    ? { isHidden: false }
    : req.user.role === "STUDENT"
      ? { isHidden: false, enrollments: { some: { studentId: req.user.id } } }
      : req.user.role === "ADMIN"
        ? {}
        : { teacherId: req.user.id };

  const courses = await prisma.course.findMany({
    where,
    orderBy: { createdAt: "asc" },
    // Exam statuses feed the course cards (how many exams, how many rooms open now).
    include: { exams: { select: { status: true } } },
  });
  return res.json(
    courses.map(({ exams, ...c }) => ({
      ...c,
      examCount: exams.length,
      openExamCount: exams.filter((e) => e.status === "OPEN").length,
    }))
  );
}

/** Back office: hide a course from students, or show it again. */
export async function setCourseVisibility(req: Request, res: Response) {
  const { isHidden } = z.object({ isHidden: z.boolean() }).parse(req.body);
  const course = await prisma.course.update({ where: { id: req.params.courseId }, data: { isHidden } });
  await prisma.auditLog.create({
    data: {
      actorId: req.user!.id,
      action: isHidden ? "COURSE_HIDDEN" : "COURSE_SHOWN",
      entity: "Course",
      entityId: course.id,
    },
  });
  return res.json(course);
}

const createCourseSchema = z.object({
  // Course codes aren't shown anywhere; one is generated when none is given.
  code: z.string().trim().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  termLabel: z.string().optional(),
});

export async function createCourse(req: Request, res: Response) {
  const { code, ...body } = createCourseSchema.parse(req.body);
  const course = await prisma.course.create({
    data: { ...body, code: code || `C-${randomUUID().slice(0, 8)}`, teacherId: req.user!.id },
  });
  return res.status(201).json(course);
}

export async function listMaterials(req: Request, res: Response) {
  const materials = await prisma.courseMaterial.findMany({
    where: { courseId: req.params.courseId },
    orderBy: { createdAt: "desc" },
  });
  return res.json(materials);
}

const uploadMetaSchema = z.object({
  title: z.string().min(1),
  type: z.enum(["SLIDE", "VIDEO", "DOCUMENT", "LINK"]),
});

export async function uploadMaterial(req: Request, res: Response) {
  const body = uploadMetaSchema.parse(req.body);
  const file = req.file;
  if (!file) return res.status(400).json({ error: "File is required" });

  const material = await prisma.courseMaterial.create({
    data: {
      courseId: req.params.courseId,
      uploaderId: req.user!.id,
      title: body.title,
      type: body.type,
      fileUrl: `/uploads/${file.filename}`,
      sizeBytes: file.size,
    },
  });

  return res.status(201).json(material);
}

export async function deleteMaterial(req: Request, res: Response) {
  await prisma.courseMaterial.delete({ where: { id: req.params.materialId } });
  return res.status(204).send();
}
