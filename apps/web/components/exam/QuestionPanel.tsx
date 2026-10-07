"use client";

import { useEffect, useState, useRef } from "react";
import type { ExamQuestion } from "@/types/exam";
import { FillInBankQuestion } from "./FillInBankQuestion";

export type AnswerMap = Record<string, { selectedOptionIds?: string[]; textAnswer?: string }>;

interface QuestionPanelProps {
  questions: ExamQuestion[];
  answers: AnswerMap;
  currentIndex: number;
  /** Per-question limit from the exam settings; null hides the per-question timer. */
  timePerQuestionSeconds: number | null;
  /** Epoch ms when the current question expires, as reported by the server. */
  questionDeadline: number | null;
  onAnswerChange: (questionId: string, value: AnswerMap[string]) => void;
  onQuestionChange: (newIndex: number) => void;
  onSubmit: () => void;
}

const secondsUntil = (deadline: number | null) =>
  deadline === null ? 0 : Math.max(0, Math.ceil((deadline - Date.now()) / 1000));

/** One question at a time: progress + timer, the question, its answers, and a single "next" button. */
export function QuestionPanel({
  questions,
  answers,
  currentIndex,
  timePerQuestionSeconds,
  questionDeadline,
  onAnswerChange,
  onQuestionChange,
  onSubmit,
}: QuestionPanelProps) {
  const [secondsLeft, setSecondsLeft] = useState(() => secondsUntil(questionDeadline));
  const [timeExpiredNotice, setTimeExpiredNotice] = useState(false);
  const currentQuestion = questions[currentIndex];
  const totalQuestions = questions.length;
  const timed = timePerQuestionSeconds !== null && questionDeadline !== null;

  // Keep the latest callbacks without restarting the countdown on every render.
  const advanceRef = useRef<() => void>(() => undefined);
  advanceRef.current = () => {
    if (currentIndex < totalQuestions - 1) onQuestionChange(currentIndex + 1);
    else onSubmit();
  };

  // Count down to the server's deadline; a page refresh resumes from the same deadline.
  useEffect(() => {
    setTimeExpiredNotice(false);
    if (!timed) return;
    let advanceTimer: ReturnType<typeof setTimeout> | undefined;
    const tick = () => {
      const left = secondsUntil(questionDeadline);
      setSecondsLeft(left);
      if (left <= 0 && advanceTimer === undefined) {
        setTimeExpiredNotice(true);
        advanceTimer = setTimeout(() => advanceRef.current(), 1200);
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => {
      clearInterval(interval);
      clearTimeout(advanceTimer);
    };
  }, [timed, questionDeadline]);

  if (!currentQuestion) {
    return (
      <div className="rounded-xl border border-outline-variant/30 bg-surface-container p-8 text-center text-on-surface-variant text-sm">
        ไม่พบข้อมูลข้อสอบ
      </div>
    );
  }

  const answer = answers[currentQuestion.id] ?? {};
  const isLastQuestion = currentIndex === totalQuestions - 1;
  const hasAnswer = Boolean(answer.selectedOptionIds?.length || answer.textAnswer?.trim());
  const isUrgent = timed && secondsLeft <= 60;
  const timeFormatted = `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`;

  const handleNext = () => (isLastQuestion ? onSubmit() : onQuestionChange(currentIndex + 1));

  return (
    <div className="space-y-4 pb-24">
      {/* Progress + timer */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <div className="flex items-baseline justify-between mb-1.5">
            <span className="text-sm font-bold text-on-surface">
              ข้อ {currentIndex + 1} <span className="font-normal text-outline">จาก {totalQuestions}</span>
            </span>
          </div>
          <div className="h-2 rounded-full bg-surface-container-highest overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-500"
              style={{ width: `${((currentIndex + 1) / totalQuestions) * 100}%` }}
            />
          </div>
        </div>
        {timed && (
          <div
            className={`shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl border-2 font-mono text-xl font-bold ${
              isUrgent ? "border-error text-error bg-error/10 animate-pulse" : "border-outline-variant/40 text-on-surface"
            }`}
          >
            <span className="material-symbols-outlined">timer</span>
            {timeFormatted}
          </div>
        )}
      </div>

      {timeExpiredNotice && (
        <div className="rounded-xl bg-amber-500/20 border border-amber-500/40 p-3 text-center text-sm font-medium text-amber-300">
          ⏳ หมดเวลาข้อนี้แล้ว กำลังไปข้อถัดไป...
        </div>
      )}

      {/* Question */}
      <div className="rounded-2xl border border-outline-variant/40 bg-surface-container p-5 sm:p-7">
        {currentQuestion.type === "FILL_IN_BANK" ? (
          <FillInBankQuestion
            key={currentQuestion.id}
            question={currentQuestion}
            selectedOptionId={answer.selectedOptionIds?.[0]}
            onSelect={(optionId) => onAnswerChange(currentQuestion.id, { selectedOptionIds: [optionId] })}
          />
        ) : (
          <div className="space-y-5">
            <h2 className="text-lg font-semibold text-on-surface leading-relaxed">{currentQuestion.prompt}</h2>
            {currentQuestion.type === "SHORT_ANSWER" ? (
              <input
                type="text"
                value={answer.textAnswer ?? ""}
                onChange={(e) => onAnswerChange(currentQuestion.id, { textAnswer: e.target.value })}
                placeholder="พิมพ์คำตอบ..."
                className="w-full px-4 py-3 rounded-xl bg-surface-container-lowest border border-outline-variant/40 text-base text-on-surface placeholder:text-outline focus:outline-none focus:border-primary"
              />
            ) : (
              <div className="space-y-2.5">
                {currentQuestion.options.map((option, optIdx) => {
                  const selected = new Set(answer.selectedOptionIds ?? []);
                  const isChecked = selected.has(option.id);
                  const isMultiple = currentQuestion.type === "MULTIPLE_CHOICE";
                  const toggle = () => {
                    if (!isMultiple) {
                      onAnswerChange(currentQuestion.id, { selectedOptionIds: [option.id] });
                      return;
                    }
                    const next = new Set(selected);
                    if (next.has(option.id)) next.delete(option.id);
                    else next.add(option.id);
                    onAnswerChange(currentQuestion.id, { selectedOptionIds: [...next] });
                  };
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={toggle}
                      className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 text-left text-sm transition-colors ${
                        isChecked
                          ? "border-primary bg-primary/10 text-on-surface"
                          : "border-outline-variant/30 bg-surface-container-lowest text-on-surface-variant hover:border-outline-variant/70"
                      }`}
                    >
                      <span
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 font-bold ${
                          isChecked ? "bg-primary text-on-primary" : "bg-surface-container-highest text-outline"
                        }`}
                      >
                        {String.fromCharCode(65 + optIdx)}
                      </span>
                      {option.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sticky next button */}
      <div className="fixed bottom-0 inset-x-0 z-30 bg-surface/95 backdrop-blur border-t border-outline-variant/30">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <p className="flex-1 text-xs text-on-surface-variant">
            {hasAnswer ? "เลือกคำตอบแล้ว" : "ยังไม่ได้เลือกคำตอบ"} · กดแล้วย้อนกลับไม่ได้
          </p>
          <button
            type="button"
            onClick={handleNext}
            className={`px-6 py-3 rounded-xl font-bold text-sm flex items-center gap-2 transition-opacity hover:opacity-90 ${
              isLastQuestion
                ? "bg-secondary text-on-secondary"
                : hasAnswer
                  ? "bg-primary text-on-primary"
                  : "bg-surface-container-highest text-on-surface"
            }`}
          >
            {isLastQuestion ? "ส่งข้อสอบ" : hasAnswer ? "ข้อถัดไป" : "ข้ามข้อนี้"}
            <span className="material-symbols-outlined text-base">{isLastQuestion ? "check_circle" : "arrow_forward"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
