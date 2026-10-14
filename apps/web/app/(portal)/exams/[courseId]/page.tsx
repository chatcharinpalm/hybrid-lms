"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { courseCover } from "@/components/exam/courseCover";

interface Course {
  id: string;
  title: string;
  description: string | null;
}

interface ExamSummary {
  id: string;
  title: string;
  description: string | null;
  durationMinutes: number;
  status: "DRAFT" | "SCHEDULED" | "OPEN" | "CLOSED";
  passScorePercent: number;
  maxAttempts: number;
}

/** "แบบทดสอบ บทที่ 6 เรื่อง ..." → "บทที่ 6" for the card's badge. */
const chapterOf = (title: string) => title.match(/บทที่\s*\d+/)?.[0] ?? null;

/** One course's exams, after the student picked the course in the exam center. */
export default function CourseExamsPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const [course, setCourse] = useState<Course | null>(null);
  const [courseIndex, setCourseIndex] = useState(0);
  const [exams, setExams] = useState<ExamSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([apiFetch<Course[]>("/api/courses"), apiFetch<ExamSummary[]>(`/api/exams/course/${courseId}`)])
      .then(([courses, list]) => {
        const index = courses.findIndex((c) => c.id === courseId);
        if (index < 0) throw new Error("ไม่พบรายวิชานี้ หรือรายวิชาถูกปิดการแสดงผล");
        setCourse(courses[index]);
        setCourseIndex(index);
        // Chapter order, as the papers are numbered.
        setExams([...list].sort((a, b) => a.title.localeCompare(b.title, "th", { numeric: true })));
      })
      .catch((err: Error) => setError(err.message));
  }, [courseId]);

  const cover = courseCover(courseIndex, course?.title ?? "");

  return (
    <div className="space-y-8 py-2">
      <Link href="/exams" className="inline-flex items-center gap-1 text-sm text-on-surface-variant hover:text-white">
        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        เลือกรายวิชาอื่น
      </Link>

      {error && <p className="text-sm text-error">{error}</p>}

      {course && (
        <div
          className="relative overflow-hidden rounded-3xl p-8 text-white shadow-2xl shadow-black/40 sm:p-10"
          style={{ background: `linear-gradient(120deg, ${cover.from}, ${cover.to})` }}
        >
          <div
            className="absolute inset-0 opacity-25"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,.18) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.18) 1px, transparent 1px)",
              backgroundSize: "32px 32px",
            }}
          />
          <span className="material-symbols-outlined absolute -bottom-6 right-6 leading-none text-white/15" style={{ fontSize: 180 }}>
            {cover.icon}
          </span>
          <div className="relative max-w-2xl space-y-3">
            <span className="inline-block rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur">ห้องสอบของรายวิชา</span>
            <h1 className="text-2xl font-bold leading-tight sm:text-3xl">{course.title}</h1>
            {course.description && <p className="text-sm leading-relaxed text-white/80">{course.description}</p>}
          </div>
        </div>
      )}

      {exams?.length === 0 && (
        <div className="rounded-2xl border border-outline-variant/30 bg-surface-container p-10 text-center text-sm text-on-surface-variant">
          รายวิชานี้ยังไม่มีแบบทดสอบ
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {exams?.map((exam) => (
          <ExamCard key={exam.id} exam={exam} />
        ))}
      </div>
    </div>
  );
}

function ExamCard({ exam }: { exam: ExamSummary }) {
  const open = exam.status === "OPEN";
  const chapter = chapterOf(exam.title);
  return (
    <div
      className={`flex flex-col rounded-2xl border bg-white p-6 text-slate-900 shadow-xl shadow-black/25 transition-all ${
        open ? "border-emerald-400 ring-2 ring-emerald-400/40" : "border-white/10"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        {chapter ? (
          <span className="rounded-md bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white">{chapter}</span>
        ) : (
          <span />
        )}
        <span
          className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
            open ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
          }`}
        >
          <span className={`h-2 w-2 rounded-full ${open ? "animate-pulse bg-emerald-500" : "bg-slate-400"}`} />
          {open ? "เปิดห้องสอบแล้ว" : "ห้องสอบยังปิด"}
        </span>
      </div>

      <h2 className="mt-4 text-base font-bold leading-snug">{exam.title}</h2>

      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <Chip icon="schedule">{exam.durationMinutes} นาที</Chip>
        {exam.description && <Chip icon="format_list_numbered">{exam.description}</Chip>}
        <Chip icon="replay">สิทธิ์สอบ {exam.maxAttempts > 0 ? `${exam.maxAttempts} ครั้ง` : "ไม่จำกัด"}</Chip>
        <Chip icon="verified">ผ่าน {exam.passScorePercent}%</Chip>
      </div>

      <div className="mt-6 flex items-center justify-end border-t border-slate-200 pt-5">
        {open ? (
          <Link
            href={`/exam/${exam.id}/lobby`}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
          >
            เริ่มทำแบบทดสอบ
            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
          </Link>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-5 py-3 text-sm font-medium text-slate-400">
            <span className="material-symbols-outlined text-[18px]">hourglass_top</span>
            รอผู้คุมสอบเปิดห้อง
          </span>
        )}
      </div>
    </div>
  );
}

function Chip({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 font-medium text-slate-600">
      <span className="material-symbols-outlined text-[15px] text-slate-400">{icon}</span>
      {children}
    </span>
  );
}
