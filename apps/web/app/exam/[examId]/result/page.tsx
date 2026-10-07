"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/api";

interface MyResult {
  examTitle: string;
  totalQuestions: number;
  canRetake: boolean;
  attemptCount: number;
  latest: {
    status: string;
    endedReason: string | null;
    scorePoints: number | null;
    scorePercent: number | null;
    passed: boolean | null;
    violationCount: number;
  } | null;
}

const ENDED_REASON_TH: Record<string, string> = {
  STUDENT: "ส่งข้อสอบเรียบร้อย",
  TIMEOUT: "หมดเวลา ระบบส่งให้อัตโนมัติ",
  VIOLATIONS: "ทำผิดกฎครบกำหนด ระบบส่งให้อัตโนมัติ",
  ADMIN_FORCED: "ผู้คุมสอบสั่งส่งข้อสอบ",
  EXAM_CLOSED: "ผู้คุมสอบปิดห้องสอบ",
};

export default function ExamResultPage() {
  const { examId } = useParams<{ examId: string }>();
  const [result, setResult] = useState<MyResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<MyResult>(`/api/exams/${examId}/my-result`)
      .then(setResult)
      .catch((err: Error) => setError(err.message));
  }, [examId]);

  const latest = result?.latest;
  const forced = latest && latest.endedReason && latest.endedReason !== "STUDENT" && latest.endedReason !== "TIMEOUT";

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-2xl border border-outline-variant/40 bg-surface-container p-8 text-center space-y-5">
        {error ? (
          <p className="text-sm text-error">{error}</p>
        ) : !result ? (
          <p className="text-sm text-on-surface-variant">กำลังโหลดผลสอบ...</p>
        ) : (
          <>
            <span className={`material-symbols-outlined text-5xl ${forced ? "text-error" : "text-secondary"}`}>
              {forced ? "gpp_bad" : "task_alt"}
            </span>
            <div>
              <h1 className="text-lg font-bold text-on-surface">
                {latest?.endedReason ? ENDED_REASON_TH[latest.endedReason] ?? "ส่งข้อสอบแล้ว" : "ส่งข้อสอบแล้ว"}
              </h1>
              <p className="text-xs text-on-surface-variant mt-1">{result.examTitle}</p>
            </div>

            {latest && latest.scorePoints !== null && (
              <div className="rounded-xl bg-surface-container-lowest border border-outline-variant/30 p-5">
                <p className="text-xs text-outline">คะแนนของคุณ</p>
                <p className="text-4xl font-black text-on-surface font-mono mt-1">
                  {latest.scorePoints}
                  <span className="text-lg text-outline font-normal"> / {result.totalQuestions}</span>
                </p>
                <p className={`text-sm font-bold mt-1 ${latest.passed ? "text-secondary" : "text-error"}`}>
                  {latest.scorePercent}% · {latest.passed ? "ผ่าน" : "ไม่ผ่าน"}
                </p>
                {latest.violationCount > 0 && (
                  <p className="text-xs text-error mt-2">ทำผิดกฎระหว่างสอบ {latest.violationCount} ครั้ง</p>
                )}
              </div>
            )}

            <p className="text-xs text-outline">สอบไปแล้ว {result.attemptCount} ครั้ง</p>

            <div className="flex flex-col gap-2">
              {result.canRetake && (
                <Link
                  href={`/exam/${examId}/session`}
                  className="w-full py-3 rounded-xl bg-primary text-on-primary font-bold text-sm hover:opacity-90"
                >
                  สอบอีกครั้ง
                </Link>
              )}
              <Link
                href="/dashboard"
                className="w-full py-3 rounded-xl border border-outline-variant/40 text-on-surface text-sm hover:bg-surface-container-high"
              >
                กลับหน้าหลัก
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
