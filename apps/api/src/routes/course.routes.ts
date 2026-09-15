import { Router } from "express";
import multer from "multer";
import { env } from "../env";
import * as courseController from "../controllers/course.controller";
import { optionalAuth, requireAuth, requireRole } from "../middleware/auth";

const upload = multer({
  dest: env.uploadDir,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB, tune for lecture videos
});

export const courseRouter = Router();

// Public browsing: course catalog and materials are viewable without login.
courseRouter.get("/", optionalAuth, courseController.listCourses);
courseRouter.post("/", requireAuth, requireRole("TEACHER", "ADMIN"), courseController.createCourse);
courseRouter.get("/:courseId/materials", courseController.listMaterials);
courseRouter.post(
  "/:courseId/materials",
  requireAuth,
  requireRole("TEACHER", "ADMIN"),
  upload.single("file"),
  courseController.uploadMaterial
);
courseRouter.delete(
  "/:courseId/materials/:materialId",
  requireAuth,
  requireRole("TEACHER", "ADMIN"),
  courseController.deleteMaterial
);
