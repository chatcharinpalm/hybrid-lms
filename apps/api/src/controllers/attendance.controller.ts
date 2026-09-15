import type { Request, Response } from "express";
import crypto from "node:crypto";
import { z } from "zod";
import { prisma } from "../prisma";

const QR_WINDOW_SECONDS = 30;

/**
 * Rotating check-in token, HMAC-derived from the session's static qrSecret
 * plus the current time bucket. Anyone screenshotting a code from across the
 * room can't reuse it after ~30s, and it never leaves the server unsigned.
 */
function currentToken(qrSecret: string, bucket: number): string {
  return crypto.createHmac("sha256", qrSecret).update(String(bucket)).digest("hex").slice(0, 10);
}

export async function getRotatingQrToken(req: Request, res: Response) {
  const session = await prisma.classSession.findUniqueOrThrow({ where: { id: req.params.sessionId } });
  if (!session.qrSecret) return res.status(409).json({ error: "QR check-in not enabled for this session" });

  const bucket = Math.floor(Date.now() / 1000 / QR_WINDOW_SECONDS);
  const token = currentToken(session.qrSecret, bucket);
  const expiresInSeconds = QR_WINDOW_SECONDS - (Math.floor(Date.now() / 1000) % QR_WINDOW_SECONDS);

  return res.json({ token, expiresInSeconds });
}

const checkInSchema = z.object({
  token: z.string().min(1),
});

export async function checkInOnsite(req: Request, res: Response) {
  const { token } = checkInSchema.parse(req.body);
  const session = await prisma.classSession.findUniqueOrThrow({ where: { id: req.params.sessionId } });
  if (!session.qrSecret) return res.status(409).json({ error: "QR check-in not enabled for this session" });

  const nowBucket = Math.floor(Date.now() / 1000 / QR_WINDOW_SECONDS);
  // Accept current and previous bucket to tolerate scan/network latency.
  const validTokens = [currentToken(session.qrSecret, nowBucket), currentToken(session.qrSecret, nowBucket - 1)];
  if (!validTokens.includes(token)) {
    return res.status(400).json({ error: "QR code expired or invalid" });
  }

  const record = await prisma.attendanceRecord.upsert({
    where: { sessionId_studentId: { sessionId: session.id, studentId: req.user!.id } },
    create: {
      sessionId: session.id,
      studentId: req.user!.id,
      method: "QR_ONSITE",
      ipAddress: req.ip,
    },
    update: {},
  });

  return res.status(201).json(record);
}

export async function checkInOnline(req: Request, res: Response) {
  const session = await prisma.classSession.findUniqueOrThrow({ where: { id: req.params.sessionId } });

  const record = await prisma.attendanceRecord.upsert({
    where: { sessionId_studentId: { sessionId: session.id, studentId: req.user!.id } },
    create: {
      sessionId: session.id,
      studentId: req.user!.id,
      method: "ONLINE_JOIN",
      ipAddress: req.ip,
    },
    update: {},
  });

  return res.status(201).json(record);
}

export async function listSessionAttendance(req: Request, res: Response) {
  const records = await prisma.attendanceRecord.findMany({
    where: { sessionId: req.params.sessionId },
    include: { student: { select: { id: true, fullName: true, studentCode: true } } },
    orderBy: { checkedInAt: "asc" },
  });
  return res.json(records);
}
