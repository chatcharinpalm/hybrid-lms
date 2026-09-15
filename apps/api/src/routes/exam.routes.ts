import { Router } from "express";
import * as examController from "../controllers/exam.controller";
import { requireAuth, requireRole } from "../middleware/auth";

export const examRouter = Router();

// Teacher/Admin: authoring
examRouter.post("/", requireAuth, requireRole("TEACHER", "ADMIN"), examController.createExam);
// Public browsing: the exam center list (title/schedule/status) is viewable
// without login — only starting an attempt below requires a student login.
examRouter.get("/course/:courseId", examController.listExamsForCourse);
examRouter.post(
  "/:examId/publish",
  requireAuth,
  requireRole("TEACHER", "ADMIN"),
  examController.publishExam
);

// Student: taking the exam (Secure Exam Engine)
examRouter.post("/:examId/attempts", requireAuth, requireRole("STUDENT"), examController.startAttempt);
examRouter.post(
  "/attempts/:attemptId/answers",
  requireAuth,
  requireRole("STUDENT"),
  examController.saveAnswer
);
examRouter.post(
  "/attempts/:attemptId/violations",
  requireAuth,
  requireRole("STUDENT"),
  examController.reportViolation
);
examRouter.post(
  "/attempts/:attemptId/submit",
  requireAuth,
  requireRole("STUDENT"),
  examController.submitAttempt
);

// Teacher/Admin: proctoring review
examRouter.get(
  "/attempts/:attemptId/violations",
  requireAuth,
  requireRole("TEACHER", "ADMIN"),
  examController.getAttemptViolations
);
