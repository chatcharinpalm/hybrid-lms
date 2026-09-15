import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../prisma";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../utils/jwt";

// Public self-registration is student-only by design — teacher/admin
// accounts are provisioned separately (seed script or a future
// admin-managed user list), never created through an open endpoint.
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  studentCode: z.string().min(1),
  faculty: z.string().min(1),
  major: z.string().min(1),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function register(req: Request, res: Response) {
  const body = registerSchema.parse(req.body);

  const existingEmail = await prisma.user.findUnique({ where: { email: body.email } });
  if (existingEmail) return res.status(409).json({ error: "อีเมลนี้ถูกใช้สมัครไปแล้ว" });

  const existingStudentCode = await prisma.user.findUnique({ where: { studentCode: body.studentCode } });
  if (existingStudentCode) return res.status(409).json({ error: "รหัสนักศึกษานี้ถูกใช้สมัครไปแล้ว" });

  const passwordHash = await bcrypt.hash(body.password, 12);
  const fullName = `${body.firstName} ${body.lastName}`.trim();
  const user = await prisma.user.create({
    data: {
      email: body.email,
      passwordHash,
      firstName: body.firstName,
      lastName: body.lastName,
      fullName,
      role: "STUDENT",
      studentCode: body.studentCode,
      faculty: body.faculty,
      major: body.major,
    },
  });

  return res.status(201).json({ id: user.id, email: user.email, role: user.role });
}

export async function login(req: Request, res: Response) {
  const body = loginSchema.parse(req.body);

  const user = await prisma.user.findUnique({ where: { email: body.email } });
  if (!user || !user.isActive) return res.status(401).json({ error: "Invalid credentials" });

  const valid = await bcrypt.compare(body.password, user.passwordHash);
  if (!valid) return res.status(401).json({ error: "Invalid credentials" });

  const accessToken = signAccessToken({ sub: user.id, role: user.role, email: user.email });
  const refreshToken = signRefreshToken({ sub: user.id });

  // In production the frontend (Vercel) and API (Render) are different
  // origins, so the cookie needs SameSite=None to survive a cross-site
  // fetch — which in turn requires Secure. Locally (http, same-site
  // enough) "lax" without Secure is fine and simpler to test with.
  const isProd = process.env.NODE_ENV === "production";
  res.cookie("refresh_token", refreshToken, {
    httpOnly: true,
    sameSite: isProd ? "none" : "lax",
    secure: isProd,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  return res.json({
    accessToken,
    user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role },
  });
}

export async function refresh(req: Request, res: Response) {
  const token = req.cookies?.refresh_token;
  if (!token) return res.status(401).json({ error: "Missing refresh token" });

  try {
    const payload = verifyRefreshToken(token);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) return res.status(401).json({ error: "Invalid session" });

    const accessToken = signAccessToken({ sub: user.id, role: user.role, email: user.email });
    return res.json({ accessToken });
  } catch {
    return res.status(401).json({ error: "Invalid or expired refresh token" });
  }
}

export async function logout(_req: Request, res: Response) {
  res.clearCookie("refresh_token");
  return res.status(204).send();
}

export async function me(req: Request, res: Response) {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) return res.status(404).json({ error: "User not found" });
  return res.json({
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    fullName: user.fullName,
    role: user.role,
    studentCode: user.studentCode,
    faculty: user.faculty,
    major: user.major,
  });
}
