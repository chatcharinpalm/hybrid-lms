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
  /** Null when the marked paper may be shown; otherwise why not (yet). */
  reviewBlocked: string | null;
  latest: {
    status: string;
    endedReason: string | null;
    scorePoints: number | null;
    scorePercent: number | null;
    passed: boolean | null;
    violationCount: number;
  } | null;
}

interface ReviewRow {
  number: number;
  prompt: string;
  explanation: string | null;
  chosen: { code: string | null; label: string } | null;
  correct: { code: string | null; label: string } | null;
  isCorrect: boolean | null;
}

const ENDED_REASON_TH: Record<string, string> = {
  STUDENT: "ส่งข้อสอบเรียบร้อย",
  TIMEOUT: "หมดเวลา ระบบส่งให้อัตโนมัติ",
  VIOLATIONS: "ทำผิดกฎครบกำหนด ระบบส่งให้อัตโนมัติ",
  ADMIN_FORCED: "ผู้คุมสอบสั่งส่งข้อสอบ",
  EXAM_CLOSED: "ผู้คุมสอบปิดห้องสอบ",
};

const answerText = (a: { code: string | null; label: string } | null) => (a ? `${a.code ? `[${a.code}] ` : ""}${a.label}` : "ไม่ได้ตอบ");

export default function ExamResultPage() {
  const { examId } = useParams<{ examId: string }>();
  const [result, setResult] = useState<MyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [review, setReview] = useState<ReviewRow[] | null>(null);
  const [onlyWrong, setOnlyWrong] = useState(true);

  useEffect(() => {
    apiFetch<MyResult>(`/api/exams/${examId}/my-result`)
      .then((r) => {
        setResult(r);
        if (r.latest && !r.reviewBlocked) {
          apiFetch<{ rows: ReviewRow[] }>(`/api/exams/${examId}/my-review`)
            .then((v) => setReview(v.rows))
            .catch(() => setReview(null));
        }
      })
      .catch((err: Error) => setError(err.message));
  }, [examId]);

  const latest = result?.latest;
  const forced = latest && latest.endedReason && latest.endedReason !== "STUDENT" && latest.endedReason !== "TIMEOUT";
  const wrong = review?.filter((r) => r.isCorrect !== true) ?? [];
  const shown = onlyWrong ? wrong : review ?? [];

  return (
    <div className="min-h-screen px-4 py-10">
      <div className="mx-auto max-w-md w-full rounded-2xl border border-outline-variant/40 bg-surface-container p-8 text-center space-y-5">
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
            {latest && result.reviewBlocked && (
              <p className="rounded-lg border border-outline-variant/30 bg-surface-container-lowest p-3 text-xs text-on-surface-variant">
                <span className="material-symbols-outlined mr-1 align-middle text-sm">info</span>
                {result.reviewBlocked}
              </p>
            )}

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
                href="/exams"
                className="w-full py-3 rounded-xl border border-outline-variant/40 text-on-surface text-sm hover:bg-surface-container-high"
              >
                กลับหน้าหลัก
              </Link>
            </div>
          </>
        )}
      </div>

      {/* The marked paper: which questions were wrong, the right answer and the teacher's explanation */}
      {review && (
        <section className="mx-auto mt-8 max-w-3xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-bold text-on-surface">
              เฉลยและคำอธิบาย
              <span className="ml-2 text-sm font-normal text-on-surface-variant">
                ผิด/ไม่ได้ตอบ {wrong.length} จาก {review.length} ข้อ
              </span>
            </h2>
            <div className="flex rounded-xl border border-outline-variant/30 bg-surface-container p-1 text-xs">
              {[
                { v: true, label: "เฉพาะข้อที่ผิด" },
                { v: false, label: "ทุกข้อ" },
              ].map((o) => (
                <button
                  key={o.label}
                  type="button"
                  onClick={() => setOnlyWrong(o.v)}
                  className={`rounded-lg px-3 py-1.5 font-semibold ${onlyWrong === o.v ? "bg-primary text-on-primary" : "text-on-surface-variant"}`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {shown.length === 0 && (
            <p className="rounded-xl border border-secondary/40 bg-secondary/10 p-5 text-center text-sm font-semibold text-secondary">
              ถูกทุกข้อ เยี่ยมมาก!
            </p>
          )}

          {shown.map((r) => {
            const ok = r.isCorrect === true;
            return (
              <article
                key={r.number}
                className={`rounded-xl border bg-surface-container p-4 ${ok ? "border-secondary/30" : "border-error/40"}`}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`material-symbols-outlined mt-0.5 rounded-full p-1 text-lg ${
                      ok ? "bg-secondary/15 text-secondary" : "bg-error/15 text-error"
                    }`}
                  >
                    {ok ? "check" : "close"}
                  </span>
                  <div className="min-w-0 flex-1 space-y-2">
                    <p className="text-sm text-on-surface">
                      <b className="mr-1.5">ข้อ {r.number}</b>
                      <span className="whitespace-pre-line">{r.prompt}</span>
                    </p>
                    <div className="grid gap-2 text-xs sm:grid-cols-2">
                      <p className={`rounded-lg border px-3 py-2 ${ok ? "border-secondary/30 text-secondary" : "border-error/30 text-error"}`}>
                        <span className="block text-[10px] text-outline">คำตอบของคุณ</span>
                        {answerText(r.chosen)}
                      </p>
                      {!ok && (
                        <p className="rounded-lg border border-secondary/30 px-3 py-2 text-secondary">
                          <span className="block text-[10px] text-outline">คำตอบที่ถูก</span>
                          {answerText(r.correct)}
                        </p>
                      )}
                    </div>
                    {r.explanation && (
                      <p className="rounded-lg bg-surface-container-lowest px-3 py-2 text-xs leading-relaxed text-on-surface-variant">
                        <span className="material-symbols-outlined mr-1 align-middle text-sm text-tertiary">lightbulb</span>
                        {r.explanation}
                      </p>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
