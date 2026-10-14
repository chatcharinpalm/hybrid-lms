import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../prisma";

/** Student-portal menus the back office may hide. The exam center always stays. */
export const HIDEABLE_MENUS = ["courses", "attendance"] as const;

const HIDDEN_MENUS_KEY = "hiddenMenus";

async function readHiddenMenus(): Promise<string[]> {
  const row = await prisma.siteSetting.findUnique({ where: { key: HIDDEN_MENUS_KEY } });
  if (!row) return [];
  try {
    const list = JSON.parse(row.value);
    return Array.isArray(list) ? list.filter((m) => (HIDEABLE_MENUS as readonly string[]).includes(m)) : [];
  } catch {
    return [];
  }
}

/** Public: what the student portal shows (read by its top menu before login too). */
export async function getPortalSettings(_req: Request, res: Response) {
  return res.json({ hiddenMenus: await readHiddenMenus() });
}

const portalSettingsSchema = z.object({ hiddenMenus: z.array(z.enum(HIDEABLE_MENUS)) });

export async function updatePortalSettings(req: Request, res: Response) {
  const { hiddenMenus } = portalSettingsSchema.parse(req.body);
  const value = JSON.stringify([...new Set(hiddenMenus)]);
  await prisma.siteSetting.upsert({
    where: { key: HIDDEN_MENUS_KEY },
    create: { key: HIDDEN_MENUS_KEY, value },
    update: { value },
  });
  await prisma.auditLog.create({
    data: { actorId: req.user!.id, action: "PORTAL_MENUS_SET", entity: "SiteSetting", entityId: HIDDEN_MENUS_KEY, metadata: value },
  });
  return res.json({ hiddenMenus: await readHiddenMenus() });
}
