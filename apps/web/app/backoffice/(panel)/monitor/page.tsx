"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { exportExamExcelById } from "@/lib/exportExamExcel";
import { ConfirmDelete } from "@/components/backoffice/ConfirmDelete";

interface CourseExam {
  id: string;
  title: string;
  description: string;
  durationMinutes: number;
  status: string;
  courseId: string;
}

function ExportExcelButton({ examId }: { examId: string }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const run = async () => {
    setBusy("กำลังเตรียม...");
    setError(null);
    try {
      await exportExamExcelById(examId, (done, total) => setBusy(`โหลดคำตอบ ${done}/${total}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "ส่งออกไม่สำเร็จ");
    } finally {
      setBusy(null);
    }
  };
  return (
    <button
      type="button"
      disabled={Boolean(busy)}
      onClick={run}
      title={error ?? "ผลสอบ คำตอบรายข้อ การทุจริต และการสั่งการ (ทุกห้อง)"}
      className={`px-3 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-1.5 disabled:opacity-60 ${
        error
          ? "bg-error/10 text-error border-error/40"
          : "bg-emerald-600/15 text-emerald-400 border-emerald-500/40 hover:bg-emerald-600/25"
      }`}
    >
      <span className={`material-symbols-outlined text-sm ${busy ? "animate-spin" : ""}`}>{busy ? "sync" : "download"}</span>
      {busy ?? (error ? "ส่งออกไม่สำเร็จ ลองใหม่" : "Export Excel")}
    </button>
  );
}

export default function AdminMonitorHubPage() {
  const [exams, setExams] = useState<CourseExam[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Look up exams for CPE-321 or all exams
    apiFetch<any[]>("/api/courses")
      .then(async (courses) => {
        const allExams: CourseExam[] = [];
        for (const c of courses) {
          const courseExams = await apiFetch<CourseExam[]>(`/api/exams/course/${c.id}`).catch(() => []);
          allExams.push(...courseExams);
        }
        setExams(allExams);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-on-surface">
            ศูนย์ควบคุมการสอบสด (Live Exam Monitoring Center)
          </h1>
          <p className="text-xs text-on-surface-variant mt-1">
            เลือกแบบทดสอบเพื่อเปิดจอสังเกตการณ์คุมสอบแบบเรียลไทม์ พร้อมระบบแจ้งเตือนการทุจริตทันที
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-xs font-bold text-outline uppercase tracking-wider">
          แบบทดสอบทั้งหมดในระบบ
        </h3>

        {loading ? (
          <div className="py-6 text-center text-xs text-outline">กำลังโหลดรายการข้อสอบ...</div>
        ) : exams.length === 0 ? (
          <div className="py-6 text-center text-xs text-outline">ยังไม่มีแบบทดสอบ</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {exams.map((ex) => (
              <div
                key={ex.id}
                className="p-5 rounded-xl bg-surface-container border border-outline-variant/30 flex items-center justify-between gap-4"
              >
                <div>
                  <h4 className="text-sm font-semibold text-on-surface">{ex.title}</h4>
                  <p className="text-xs text-outline mt-0.5">
                    เวลา: {ex.durationMinutes} นาที • สถานะ: {ex.status}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <ExportExcelButton examId={ex.id} />
                  <Link
                    href={`/backoffice/exams/${ex.id}/monitor`}
                    className="px-3 py-1.5 rounded-lg bg-surface-container-highest hover:bg-surface-container-high border border-outline-variant/30 text-xs text-on-surface hover:text-primary transition-colors flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-sm">visibility</span>
                    <span>คุมสอบ</span>
                  </Link>
                  <ConfirmDelete
                    title={ex.title}
                    consequences={["ข้อสอบทุกข้อในชุดนี้", "ผลสอบและคำตอบของนักศึกษาทุกคน", "บันทึกการทุจริตของชุดนี้"]}
                    onDelete={async () => {
                      await apiFetch(`/api/exams/${ex.id}`, { method: "DELETE" });
                      setExams((list) => list.filter((e) => e.id !== ex.id));
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
