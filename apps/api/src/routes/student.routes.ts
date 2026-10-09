import { Router } from "express";
import * as studentController from "../controllers/student.controller";
import { requireAuth, requireRole } from "../middleware/auth";

export const studentRouter = Router();
const staff = [requireAuth, requireRole("TEACHER", "ADMIN")];

studentRouter.get("/roster", ...staff, studentController.getRoster);
studentRouter.post("/access-codes", ...staff, studentController.regenerateSectionCodes);
studentRouter.post("/:studentId/access-code", ...staff, studentController.regenerateCode);
