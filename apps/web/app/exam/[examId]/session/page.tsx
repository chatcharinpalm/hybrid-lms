"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ApiError, apiFetch } from "@/lib/api";
import { isLoggedIn, loginUrl } from "@/lib/auth";
import type { ExamPaper } from "@/types/exam";
import { SecureExamShell } from "@/components/exam/SecureExamShell";
import { QuestionPanel, type AnswerMap } from "@/components/exam/QuestionPanel";
import { ProctorMessageModal } from "@/components/exam/ProctorMessageModal";

interface ProctorMessage {
  id: string;
  message: string;
  createdAt: string;
}

interface LiveState {
  status: string;
  violationCount: number;
  currentQuestionIndex: number;
  questionSecondsLeft: number | null;
  messages: ProctorMessage[];
}

export default function ExamSessionPage() {
  const { examId } = useParams<{ examId: string }>();
  const router = useRouter();

  const [paper, setPaper] = useState<ExamPaper | null>(null);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  // Epoch ms when the current question's time runs out (null = no per-question limit).
  const [questionDeadline, setQuestionDeadline] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [serverViolationCount, setServerViolationCount] = useState<number | undefined>(undefined);
  const [messages, setMessages] = useState<ProctorMessage[]>([]);
  const [wasReset, setWasReset] = useState(false);
  const submittedRef = useRef(false);

  const applyServerState = (index: number | undefined, secondsLeft: number | null | undefined) => {
    if (typeof index === "number") setCurrentIndex(index);
    setQuestionDeadline(typeof secondsLeft === "number" ? Date.now() + secondsLeft * 1000 : null);
  };

  useEffect(() => {
    // Guards direct navigation to /session that skips the lobby's own check.
    if (!isLoggedIn()) {
      router.replace(loginUrl(`/exam/${examId}/lobby`));
      return;
    }
    apiFetch<ExamPaper>(`/api/exams/${examId}/attempts`, { method: "POST" })
      .then((data) => {
        setPaper(data);
        applyServerState(data.currentQuestionIndex, data.questionSecondsLeft);
      })
      .catch((err: Error) => setError(err.message));
  }, [examId, router]);

  // Poll the server for back-office actions: warnings, added time, forgiven
  // violations, forced submission, or a reset of the whole attempt.
  const attemptId = paper?.attemptId;
  const indexRef = useRef(currentIndex);
  indexRef.current = currentIndex;
  const deadlineRef = useRef(questionDeadline);
  deadlineRef.current = questionDeadline;

  useEffect(() => {
    if (!attemptId) return;
    let stopped = false;

    const poll = async () => {
      try {
        const live = await apiFetch<LiveState>(`/api/exams/attempts/${attemptId}/live`);
        if (stopped) return;
        if (live.status !== "IN_PROGRESS") {
          stopped = true;
          submittedRef.current = true;
          router.replace(`/exam/${examId}/result`);
          return;
        }
        setServerViolationCount(live.violationCount);
        if (live.messages.length > 0) setMessages((prev) => [...prev, ...live.messages]);

        // Follow the server if it moved on (timeout) or the proctor changed the time.
        if (live.currentQuestionIndex > indexRef.current) {
          applyServerState(live.currentQuestionIndex, live.questionSecondsLeft);
        } else if (live.currentQuestionIndex === indexRef.current && typeof live.questionSecondsLeft === "number") {
          const serverDeadline = Date.now() + live.questionSecondsLeft * 1000;
          if (deadlineRef.current === null || Math.abs(serverDeadline - deadlineRef.current) > 2000) {
            setQuestionDeadline(serverDeadline);
          }
        }
      } catch (err) {
        if (err instanceof ApiError && err.status === 410) {
          stopped = true;
          submittedRef.current = true;
          setError(err.message);
          setWasReset(true);
        }
        // Other errors (network blips) — try again next tick.
      }
    };

    const interval = setInterval(poll, 3000);
    return () => {
      stopped = true;
      clearInterval(interval);
    };
  }, [attemptId, examId, router]);

  const handleAnswerChange = (questionId: string, value: AnswerMap[string]) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    if (!paper) return;

    // Fire-and-forget autosave; the server rejects answers for questions whose time is up.
    apiFetch(`/api/exams/attempts/${paper.attemptId}/answers`, {
      method: "POST",
      body: JSON.stringify({ questionId, ...value }),
    }).catch(() => undefined);
  };

  const handleQuestionChange = async (newIndex: number) => {
    if (!paper) return;
    try {
      // The server decides which question the student is on (forward only on timed exams).
      const state = await apiFetch<{ currentQuestionIndex: number; questionSecondsLeft: number | null }>(
        `/api/exams/attempts/${paper.attemptId}/progress`,
        { method: "POST", body: JSON.stringify({ currentQuestionIndex: newIndex }) }
      );
      applyServerState(state.currentQuestionIndex, state.questionSecondsLeft);
    } catch {
      // Attempt already closed on the server (time ran out) — show the result.
      router.replace(`/exam/${examId}/result`);
    }
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
          {wasReset && (
            <button
              type="button"
              onClick={() => router.replace(`/exam/${examId}/lobby`)}
              className="px-4 py-2 rounded-lg bg-primary text-on-primary text-xs font-medium"
            >
              กลับไปหน้าเตรียมสอบ
            </button>
          )}
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
      title={paper.examTitle ?? "ข้อสอบ"}
      hideOverallTimer={Boolean(paper.timePerQuestionSeconds)}
      attemptId={paper.attemptId}
      startedAt={paper.startedAt}
      durationMinutes={paper.durationMinutes}
      security={paper.security}
      currentQuestionNumber={currentIndex + 1}
      serverViolationCount={serverViolationCount}
      onExpire={handleSubmit}
      onForceSubmit={handleSubmit}
    >
      <QuestionPanel
        questions={paper.questions}
        answers={answers}
        currentIndex={currentIndex}
        timePerQuestionSeconds={paper.timePerQuestionSeconds ?? null}
        questionDeadline={questionDeadline}
        onAnswerChange={handleAnswerChange}
        onQuestionChange={handleQuestionChange}
        onSubmit={handleSubmit}
      />
      <ProctorMessageModal message={messages[0] ?? null} onAcknowledge={() => setMessages((m) => m.slice(1))} />
    </SecureExamShell>
  );
}
