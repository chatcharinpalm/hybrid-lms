import { Router } from "express";
import * as examController from "../controllers/exam.controller";
import { optionalAuth, requireAuth, requireRole } from "../middleware/auth";

export const examRouter = Router();

// Teacher/Admin: authoring
examRouter.post("/", requireAuth, requireRole("TEACHER", "ADMIN"), examController.createExam);
// An exam from the teacher's own document (Word/PDF), layout kept.
examRouter.post("/import-document", requireAuth, requireRole("TEACHER", "ADMIN"), examController.importDocumentExam);
// One exam from several chapters; each student draws a set number from each.
examRouter.post("/combine", requireAuth, requireRole("TEACHER", "ADMIN"), examController.combineExams);
// Public browsing: the exam center list (title/schedule/status) is viewable
// without login â€” only starting an attempt below requires a student login.
examRouter.get("/course/:courseId", optionalAuth, examController.listExamsForCourse);
examRouter.post(
  "/:examId/publish",
  requireAuth,
  requireRole("TEACHER", "ADMIN"),
  examController.publishExam
);

// Student: taking the exam (Secure Exam Engine)
examRouter.post("/:examId/attempts", requireAuth, requireRole("STUDENT"), examController.startAttempt);
examRouter.get("/:examId/my-result", requireAuth, requireRole("STUDENT"), examController.getMyLatestResult);
// The student's marked paper (wrong answers, the key, explanations), as the exam's review setting allows.
examRouter.get("/:examId/my-review", requireAuth, requireRole("STUDENT"), examController.getMyReview);
examRouter.post(
  "/attempts/:attemptId/answers",
  requireAuth,
  requireRole("STUDENT"),
  examController.saveAnswer
);
examRouter.post(
  "/attempts/:attemptId/progress",
  requireAuth,
  requireRole("STUDENT"),
  examController.updateProgress
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
// Polled by the exam screen to pick up back-office actions (messages, added time, force submit, reset).
examRouter.get(
  "/attempts/:attemptId/live",
  requireAuth,
  requireRole("STUDENT"),
  examController.getLiveState
);

// Teacher/Admin: proctoring review & live monitor
examRouter.get(
  "/attempts/:attemptId/violations",
  requireAuth,
  requireRole("TEACHER", "ADMIN"),
  examController.getAttemptViolations
);
examRouter.get(
  "/attempts/:attemptId/answer-sheet",
  requireAuth,
  requireRole("TEACHER", "ADMIN"),
  examController.getAttemptAnswerSheet
);
examRouter.get(
  "/:examId/proctor",
  requireAuth,
  requireRole("TEACHER", "ADMIN"),
  examController.getLiveProctoring
);

// Teacher/Admin: back-office controls
const staff = [requireAuth, requireRole("TEACHER", "ADMIN")];
examRouter.post("/:examId/status", ...staff, examController.setExamStatus);
examRouter.patch("/:examId/settings", ...staff, examController.updateExamSettings);
examRouter.get("/:examId/answer-key", ...staff, examController.getAnswerKey);
examRouter.put("/:examId/explanations", ...staff, examController.saveExplanations);
examRouter.get("/gradebook/:courseId", ...staff, examController.getGradebook);
examRouter.get("/rooms/:courseId", ...staff, examController.getCourseSections);
// What is open right now, room by room (the back office's front page).
examRouter.get("/live/summary", ...staff, examController.getLiveSummary);
examRouter.delete("/:examId", ...staff, examController.deleteExam);
examRouter.get("/:examId/audit", ...staff, examController.getExamAuditLog);
examRouter.post("/attempts/:attemptId/control/force-submit", ...staff, examController.forceSubmitAttempt);
examRouter.post("/attempts/:attemptId/control/reset", ...staff, examController.resetAttempt);
examRouter.post("/attempts/:attemptId/control/forgive", ...staff, examController.forgiveViolations);
examRouter.post("/attempts/:attemptId/control/add-time", ...staff, examController.addQuestionTime);
examRouter.post("/attempts/:attemptId/control/message", ...staff, examController.sendProctorMessage);
