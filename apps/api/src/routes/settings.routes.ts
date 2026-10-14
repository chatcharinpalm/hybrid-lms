import { Router } from "express";
import * as settingsController from "../controllers/settings.controller";
import { requireAuth, requireRole } from "../middleware/auth";

export const settingsRouter = Router();

settingsRouter.get("/portal", settingsController.getPortalSettings);
settingsRouter.put("/portal", requireAuth, requireRole("TEACHER", "ADMIN"), settingsController.updatePortalSettings);
