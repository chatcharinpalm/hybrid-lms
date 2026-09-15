"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { isLoggedIn, loginUrl } from "@/lib/auth";
import type { ExamPaper } from "@/types/exam";
import { SecureExamShell } from "@/components/exam/SecureExamShell";
import { QuestionPanel, type AnswerMap } from "@/components/exam/QuestionPanel";

export default function ExamSessionPage() {
  const { examId } = useParams<{ examId: string }>();
  const router = useRouter();

  const [paper, setPaper] = useState<ExamPaper | null>(null);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submittedRef = useRef(false);

  useEffect(() => {
    // Guards direct navigation to /session that skips the lobby's own check.
    if (!isLoggedIn()) {
      router.replace(loginUrl(`/exam/${examId}/lobby`));
      return;
    }
    apiFetch<ExamPaper>(`/api/exams/${examId}/attempts`, { method: "POST" })
      .then(setPaper)
      .catch((err: Error) => setError(err.message));
  }, [examId, router]);

  const handleAnswerChange = (questionId: string, value: AnswerMap[string]) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    if (!paper) return;
    // Fire-and-forget autosave per keystroke/selection is debounced server-side
    // via upsert; acceptable for MCQ/flag inputs given their low write volume.
    apiFetch(`/api/exams/attempts/${paper.attemptId}/answers`, {
      method: "POST",
      body: JSON.stringify({ questionId, ...value }),
    }).catch(() => undefined);
  };

  const handleSubmit = async () => {
    if (!paper || submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    try {
      await apiFetch(`/api/exams/attempts/${paper.attemptId}/submit`, { method: "POST" });
    } finally {
      router.replace(`/exam/${examId}/result`);
    }
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md rounded-lg border border-error/40 bg-surface-container p-6 text-center space-y-3">
          <span className="material-symbols-outlined text-3xl text-error">error</span>
          <p className="text-sm text-on-surface">{error}</p>
        </div>
      </div>
    );
  }

  if (!paper) {
    return (
      <div className="min-h-screen flex items-center justify-center text-on-surface-variant text-sm">
        กำลังเตรียมห้องสอบ...
      </div>
    );
  }

  return (
    <SecureExamShell
      title="การสอบ (Secure Exam Session)"
      attemptId={paper.attemptId}
      startedAt={paper.startedAt}
      durationMinutes={paper.durationMinutes}
      security={paper.security}
      onExpire={handleSubmit}
      onForceSubmit={handleSubmit}
    >
      <QuestionPanel questions={paper.questions} answers={answers} onAnswerChange={handleAnswerChange} />

      <div className="flex justify-end pt-2">
        <button
          type="button"
          disabled={submitting}
          onClick={handleSubmit}
          className="px-5 py-2.5 rounded bg-primary text-on-primary font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {submitting ? "กำลังส่งข้อสอบ..." : "ส่งข้อสอบ (Submit)"}
        </button>
      </div>
    </SecureExamShell>
  );
}
