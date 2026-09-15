import { Router } from "express";
import * as attendanceController from "../controllers/attendance.controller";
import { requireAuth, requireRole } from "../middleware/auth";

export const attendanceRouter = Router();

attendanceRouter.get(
  "/sessions/:sessionId/qr-token",
  requireAuth,
  requireRole("TEACHER", "ADMIN"),
  attendanceController.getRotatingQrToken
);
attendanceRouter.post(
  "/sessions/:sessionId/check-in/onsite",
  requireAuth,
  requireRole("STUDENT"),
  attendanceController.checkInOnsite
);
attendanceRouter.post(
  "/sessions/:sessionId/check-in/online",
  requireAuth,
  requireRole("STUDENT"),
  attendanceController.checkInOnline
);
attendanceRouter.get(
  "/sessions/:sessionId",
  requireAuth,
  requireRole("TEACHER", "ADMIN"),
  attendanceController.listSessionAttendance
);
