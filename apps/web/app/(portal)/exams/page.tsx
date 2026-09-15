"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

interface Course {
  id: string;
  code: string;
  title: string;
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

const STATUS_LABEL: Record<ExamSummary["status"], { text: string; className: string }> = {
  OPEN: { text: "เปิดให้ทำแบบทดสอบ", className: "bg-secondary/10 text-secondary border-secondary/20" },
  SCHEDULED: { text: "กำหนดการถัดไป", className: "bg-surface-container-highest text-outline border-outline-variant/30" },
  CLOSED: { text: "ตรวจแล้วเสร็จ (Closed)", className: "bg-surface-container-highest text-outline border-outline-variant/30" },
  DRAFT: { text: "ยังไม่เผยแพร่", className: "bg-surface-container-highest text-outline border-outline-variant/30" },
};

export default function ExamsPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [examsByCourse, setExamsByCourse] = useState<Record<string, ExamSummary[]>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Course[]>("/api/courses")
      .then(async (list) => {
        setCourses(list);
        const entries = await Promise.all(
          list.map(async (c) => [c.id, await apiFetch<ExamSummary[]>(`/api/exams/course/${c.id}`)] as const)
        );
        setExamsByCourse(Object.fromEntries(entries));
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between pb-2 border-b border-outline-variant/30">
        <div>
          <h1 className="text-base font-semibold text-on-surface">ศูนย์สอบ &amp; แบบประเมิน</h1>
          <p className="text-xs text-outline">แบบทดสอบทั้งหมดพร้อมระบบป้องกันการทุจริต (Secure Exam Engine)</p>
        </div>
      </div>

      {error && <p className="text-xs text-error">{error}</p>}

      {courses.length === 0 && !error && (
        <p className="text-xs text-on-surface-variant">ยังไม่มีรายวิชาที่ลงทะเบียน หรือกำลังโหลดข้อมูล...</p>
      )}

      {courses.map((course) => (
        <div key={course.id} className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-xs font-mono font-medium bg-surface-container-high text-on-surface-variant">
              {course.code}
            </span>
            <h2 className="text-sm font-semibold text-on-surface">{course.title}</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(examsByCourse[course.id] ?? []).map((exam) => {
              const status = STATUS_LABEL[exam.status];
              return (
                <div
                  key={exam.id}
                  className="rounded-lg border border-outline-variant/30 bg-surface-container p-5 space-y-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase font-semibold border ${status.className}`}>
                        {status.text}
                      </span>
                      <h3 className="text-sm font-semibold text-on-surface mt-2 leading-snug">{exam.title}</h3>
                    </div>
                    <span className="text-xs font-mono text-outline shrink-0">{exam.durationMinutes} นาที</span>
                  </div>
                  {exam.description && (
                    <p className="text-xs text-on-surface-variant leading-relaxed">{exam.description}</p>
                  )}
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono p-2.5 rounded bg-surface-container-lowest border border-outline-variant/20">
                    <div className="text-on-surface-variant">
                      เกณฑ์ผ่าน: <span className="text-on-surface font-semibold">{exam.passScorePercent}%</span>
                    </div>
                    <div className="text-right text-on-surface-variant">
                      สิทธิ์สอบ: <span className="text-primary font-semibold">{exam.maxAttempts}</span>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    {exam.status === "OPEN" ? (
                      <Link
                        href={`/exam/${exam.id}/lobby`}
                        className="px-3 py-1.5 rounded bg-primary text-on-primary text-xs font-medium hover:opacity-90 transition-opacity"
                      >
                        เริ่มทำแบบทดสอบ
                      </Link>
                    ) : (
                      <button
                        disabled
                        className="px-3 py-1.5 rounded bg-surface-container-high text-outline text-xs cursor-not-allowed"
                      >
                        ยังไม่เปิดให้สอบ
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
