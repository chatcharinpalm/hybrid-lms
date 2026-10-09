import type { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";

/** Database too busy or briefly unreachable: worth retrying, not a bug. */
const BUSY_CODES = new Set(["P1001", "P1002", "P1008", "P1017", "P2024"]);

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: "Validation failed", issues: err.flatten() });
  }
  // eslint-disable-next-line no-console
  console.error(err);
  if (
    (err instanceof Prisma.PrismaClientKnownRequestError && BUSY_CODES.has(err.code)) ||
    err instanceof Prisma.PrismaClientInitializationError
  ) {
    return res.status(503).json({ error: "ระบบไม่ว่างชั่วคราว กรุณาลองใหม่อีกครั้ง" });
  }
  return res.status(500).json({ error: "เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง" });
}
