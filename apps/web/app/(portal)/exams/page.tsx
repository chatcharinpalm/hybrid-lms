"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { courseCover } from "@/components/exam/courseCover";

interface Course {
  id: string;
  title: string;
  description: string | null;
  termLabel: string | null;
  examCount: number;
  openExamCount: number;
}

/** The exam center starts with a choice of course; each course's exams have their own page. */
export default function ExamsPage() {
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Course[]>("/api/courses")
      .then(setCourses)
      .catch((err: Error) => setError(err.message));
  }, []);

  return (
    <div className="space-y-10 py-4">
      <div className="space-y-4">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1 text-xs font-semibold text-slate-900">
          <span className="material-symbols-outlined text-[15px]">assignment_turned_in</span>
          ศูนย์สอบ
        </span>
        <h1 className="text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl">
          เลือกรายวิชา แล้ว<span className="text-tertiary">เริ่มสอบได้ทันที</span>
        </h1>
        <p className="max-w-2xl text-[15px] leading-relaxed text-on-surface-variant">
          แต่ละรายวิชาแยกห้องสอบของตัวเอง เลือกรายวิชาที่จะสอบ แล้วรอผู้คุมสอบเปิดห้อง
          ระบบป้องกันการทุจริตจะเริ่มทำงานเมื่อเข้าสู่ข้อสอบ
        </p>
      </div>

      {error && <p className="text-sm text-error">{error}</p>}
      {courses === null && !error && <p className="text-sm text-on-surface-variant">กำลังโหลดรายวิชา...</p>}
      {courses?.length === 0 && (
        <div className="rounded-2xl border border-outline-variant/30 bg-surface-container p-10 text-center text-sm text-on-surface-variant">
          ยังไม่มีรายวิชาที่ลงทะเบียน
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {courses?.map((course, i) => (
          <CourseCard key={course.id} course={course} index={i} />
        ))}
      </div>
    </div>
  );
}

function CourseCard({ course, index }: { course: Course; index: number }) {
  const cover = courseCover(index, course.title);
  const open = course.openExamCount > 0;
  return (
    <Link
      href={`/exams/${course.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white shadow-xl shadow-black/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/50"
    >
      {/* Cover */}
      <div
        className="relative h-44 overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${cover.from}, ${cover.to})` }}
      >
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.18) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.18) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
        <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full blur-3xl" style={{ background: cover.glow, opacity: 0.45 }} />
        {/* Size inline: the icon font's own stylesheet loads after Tailwind and would win. */}
        <span
          className="material-symbols-outlined absolute bottom-4 right-5 leading-none text-white/85 transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-6"
          style={{ fontSize: 96 }}
        >
          {cover.icon}
        </span>
        <span className="absolute left-3 top-3 rounded-md bg-slate-900/80 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">
          {course.termLabel ? `ปีการศึกษา ${course.termLabel}` : "รายวิชา"}
        </span>
        <span
          className={`absolute bottom-3 left-3 flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold backdrop-blur ${
            open ? "bg-emerald-500 text-white" : "bg-slate-900/70 text-white/90"
          }`}
        >
          {open && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />}
          {open ? `เปิดห้องสอบอยู่ ${course.openExamCount} ห้อง` : "ยังไม่เปิดห้องสอบ"}
        </span>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col p-6 text-slate-900">
        <h2 className="text-lg font-bold leading-snug">{course.title}</h2>
        {course.description && (
          <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-slate-500">{course.description}</p>
        )}
        <ul className="mb-6 mt-4 space-y-2 text-sm text-slate-700">
          <Check>แบบทดสอบ {course.examCount} ชุด</Check>
          <Check>ข้อสอบเติมคำจากคลังตัวเลือก สลับลำดับรายบุคคล</Check>
          <Check>ส่งแล้วทราบคะแนนทันที</Check>
        </ul>
        <div className="mt-auto flex items-center justify-between gap-3 border-t border-slate-200 pt-5">
          <div className="leading-tight">
            <div className="text-2xl font-bold">{course.examCount}</div>
            <div className="text-xs text-slate-500">ชุดข้อสอบ</div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition-colors group-hover:bg-blue-700">
            เข้าห้องสอบ
            <span className="material-symbols-outlined text-[18px] transition-transform group-hover:translate-x-0.5">arrow_forward</span>
          </span>
        </div>
      </div>
    </Link>
  );
}

function Check({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span className="material-symbols-outlined mt-px text-[18px] text-amber-500">check_circle</span>
      <span>{children}</span>
    </li>
  );
}
