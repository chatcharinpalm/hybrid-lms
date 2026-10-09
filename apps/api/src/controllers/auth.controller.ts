import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../prisma";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../utils/jwt";
import type { Role } from "../constants";
import { rosterEmail } from "../utils/roster";

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

// Staff sign in with e-mail; roster students with their student code and the
// access code handed to them after signing the attendance sheet.
const loginSchema = z.union([
  z.object({ email: z.string().email(), password: z.string().min(1) }),
  z.object({ studentCode: z.string().min(1), password: z.string().min(1) }),
]);

/** Failed sign-ins per login key; access codes are short, so guessing is cut off. */
const failures = new Map<string, { count: number; until: number }>();
const MAX_FAILURES = 8;
const LOCK_MS = 5 * 60_000;

function lockedFor(key: string): number {
  const f = failures.get(key);
  if (!f || f.count < MAX_FAILURES) return 0;
  const left = f.until - Date.now();
  if (left <= 0) {
    failures.delete(key);
    return 0;
  }
  return left;
}

function recordFailure(key: string) {
  const f = failures.get(key) ?? { count: 0, until: 0 };
  f.count += 1;
  f.until = Date.now() + LOCK_MS;
  failures.set(key, f);
}

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
  const byCode = "studentCode" in body;
  const email = byCode ? rosterEmail(body.studentCode) : body.email.toLowerCase();

  const wait = lockedFor(email);
  if (wait > 0) {
    return res.status(429).json({ error: `ใส่รหัสผิดหลายครั้ง กรุณารอ ${Math.ceil(wait / 60_000)} นาทีแล้วลองใหม่` });
  }

  const invalid = byCode ? "รหัสนักศึกษาหรือรหัสเข้าสอบไม่ถูกต้อง" : "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
  const user = await prisma.user.findUnique({ where: { email } });
  // Access codes are case-insensitive: they are printed in capitals and typed by hand.
  const password = byCode ? body.password.trim().toUpperCase() : body.password;
  if (!user || !user.isActive || !(await bcrypt.compare(password, user.passwordHash))) {
    recordFailure(email);
    return res.status(401).json({ error: invalid });
  }
  failures.delete(email);

  const accessToken = signAccessToken({ sub: user.id, role: user.role as Role, email: user.email });
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

  // The refresh token is also returned in the body: the student site and the
  // back office keep separate sessions in one browser, and a single shared
  // cookie would hand one side the other's identity on refresh.
  return res.json({
    accessToken,
    refreshToken,
    user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role },
  });
}

export async function refresh(req: Request, res: Response) {
  const fromBody = typeof req.body?.refreshToken === "string" ? (req.body.refreshToken as string) : null;
  const token = fromBody ?? req.cookies?.refresh_token;
  if (!token) return res.status(401).json({ error: "Missing refresh token" });

  try {
    const payload = verifyRefreshToken(token);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) return res.status(401).json({ error: "Invalid session" });

    const accessToken = signAccessToken({ sub: user.id, role: user.role as Role, email: user.email });
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
