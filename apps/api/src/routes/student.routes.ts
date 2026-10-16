import { Router } from "express";
import * as studentController from "../controllers/student.controller";
import { requireAuth, requireRole } from "../middleware/auth";

export const studentRouter = Router();
const staff = [requireAuth, requireRole("TEACHER", "ADMIN")];

studentRouter.get("/roster", ...staff, studentController.getRoster);
// Public: the login page's CED / TCT choice.
studentRouter.get("/programs", studentController.listPrograms);
// The signed-in student's own name, code and room (the exam center shows which room's exams they see).
studentRouter.get("/me", requireAuth, requireRole("STUDENT"), studentController.getMe);
studentRouter.post("/access-codes", ...staff, studentController.regenerateSectionCodes);
studentRouter.post("/:studentId/access-code", ...staff, studentController.regenerateCode);
