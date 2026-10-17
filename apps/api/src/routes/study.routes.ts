import { Router } from "express";
import multer from "multer";
import * as study from "../controllers/study.controller";
import { requireAuth, requireRole } from "../middleware/auth";

// Pictures are held in memory and sent straight to Supabase Storage (no /tmp).
const memoryUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

export const studyRouter = Router();

// Every study route needs a login: students must be enrolled, staff see their own courses.
studyRouter.use(requireAuth);

studyRouter.get("/courses/:courseId/chapters", study.listChapters);
studyRouter.post("/courses/:courseId/chapters", requireRole("TEACHER", "ADMIN"), study.createChapter);

studyRouter.get("/chapters/:chapterId", study.getChapter);
studyRouter.patch("/chapters/:chapterId", requireRole("TEACHER", "ADMIN"), study.updateChapter);
studyRouter.delete("/chapters/:chapterId", requireRole("TEACHER", "ADMIN"), study.deleteChapter);
studyRouter.put("/chapters/:chapterId/content", requireRole("TEACHER", "ADMIN"), study.replaceContent);

studyRouter.post("/questions/:questionId/check", study.checkQuestion);
studyRouter.get("/worksheets/:worksheetId/answers", study.getWorksheetAnswers);

studyRouter.post(
  "/media",
  requireRole("TEACHER", "ADMIN"),
  memoryUpload.single("file"),
  study.uploadMedia
);
