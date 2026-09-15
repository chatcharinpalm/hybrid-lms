import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../prisma";

export async function listCourses(req: Request, res: Response) {
  // Public/anonymous browsing shows the full catalog. A logged-in caller
  // gets a personalized view instead (their enrollments, or the courses
  // they teach) so the admin/exam pages still scope correctly.
  if (!req.user) {
    return res.json(await prisma.course.findMany());
  }

  const courses =
    req.user.role === "STUDENT"
      ? await prisma.course.findMany({ where: { enrollments: { some: { studentId: req.user.id } } } })
      : req.user.role === "ADMIN"
        ? await prisma.course.findMany()
        : await prisma.course.findMany({ where: { teacherId: req.user.id } });
  return res.json(courses);
}

const createCourseSchema = z.object({
  code: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  termLabel: z.string().optional(),
});

export async function createCourse(req: Request, res: Response) {
  const body = createCourseSchema.parse(req.body);
  const course = await prisma.course.create({
    data: { ...body, teacherId: req.user!.id },
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
