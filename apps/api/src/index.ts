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
import { errorHandler } from "./middleware/errorHandler";

const app = express();

app.use(helmet());
app.use(cors({ origin: env.corsOrigins, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use("/uploads", express.static(path.resolve(env.uploadDir)));

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRouter);
app.use("/api/exams", examRouter);
app.use("/api/attendance", attendanceRouter);
app.use("/api/courses", courseRouter);

app.use(errorHandler);

app.listen(env.port, () => {
  // eslint-disable-next-line no-console
  console.log(`API listening on http://localhost:${env.port}`);
});
