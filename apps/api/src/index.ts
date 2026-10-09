import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import path from "node:path";
import { env } from "./env";
import { authRouter } from "./routes/auth.routes";
import { examRouter } from "./routes/exam.routes";
import { attendanceRouter } from "./routes/attendance.routes";
import { courseRouter } from "./routes/course.routes";
import { studentRouter } from "./routes/student.routes";
import { errorHandler } from "./middleware/errorHandler";
import { prisma } from "./prisma";

const app = express();

app.use(helmet());
app.use(cors({ origin: env.corsOrigins, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use("/uploads", express.static(path.resolve(env.uploadDir)));

app.get("/health", (_req, res) => res.json({ ok: true }));
// Hit daily by a Vercel cron (vercel.json): a real query keeps the free Supabase
// project from pausing itself after a week without traffic (e.g. over a break).
app.get("/api/keepalive", async (_req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ ok: true, at: new Date().toISOString() });
});

app.use("/api/auth", authRouter);
app.use("/api/exams", examRouter);
app.use("/api/attendance", attendanceRouter);
app.use("/api/courses", courseRouter);
app.use("/api/students", studentRouter);

app.use(errorHandler);

// On Vercel the app is exported and run as a serverless function; elsewhere it listens.
if (!process.env.VERCEL) {
  app.listen(env.port, () => {
    // eslint-disable-next-line no-console
    console.log(`API listening on http://localhost:${env.port}`);
  });
}

export default app;
