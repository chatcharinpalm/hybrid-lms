"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { canFullscreen, useExamSecurity, type ViolationEvent } from "@/hooks/useExamSecurity";
import type { ExamSecurityConfig } from "@/types/exam";
import { ViolationModal } from "./ViolationModal";
import { ExamTimer } from "./ExamTimer";

interface SecureExamShellProps {
  title: string;
  attemptId: string;
  /** Epoch ms when the whole exam ends; null hides the whole-exam countdown (e.g. per-question timers). */
  deadline: number | null;
  /** Wider page for the paper layout. */
  wide?: boolean;
  /** Who is sitting the exam, shown on the cover and in the top bar. */
  student?: { fullName: string; studentCode: string | null };
  /** Short facts about the exam for the cover, e.g. "42 ข้อ". */
  facts?: Array<{ icon: string; label: string }>;
  /** Answered / total, for the progress meter in the top bar. */
  progress?: { done: number; total: number };
  security: ExamSecurityConfig;
  currentQuestionNumber?: number;
  /** Violation count reported by the server (e.g. after a proctor forgives violations). */
  serverViolationCount?: number;
  /** The exam paper UI — question list, flag inputs, etc. */
  children: React.ReactNode;
  onExpire: () => void;
  onForceSubmit: () => void;
}

/**
 * Reusable lockdown shell for the Secure Exam Engine.
 *
 * Composition, not configuration sprawl: this component owns the
 * fullscreen gate, the violation-reporting wiring, and the status chrome
 * (timer + integrity badges). The actual question rendering is passed in
 * as `children` so this shell can wrap any exam UI (MCQ quiz, CTF flag
 * submission form, etc.) without modification.
 *
 * Usage:
 *   <SecureExamShell title={exam.title} attemptId={paper.attemptId}
 *     deadline={Date.now() + paper.secondsLeft * 1000}
 *     security={paper.security} onExpire={submit} onForceSubmit={submit}>
 *     <QuestionPanel questions={paper.questions} ... />
 *   </SecureExamShell>
 */
export function SecureExamShell({
  title,
  attemptId,
  deadline,
  wide,
  student,
  facts,
  progress,
  security,
  currentQuestionNumber,
  serverViolationCount,
  children,
  onExpire,
  onForceSubmit,
}: SecureExamShellProps) {
  const [lockedIn, setLockedIn] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  // Read after mount (document is not there during server rendering).
  const [fullscreenSupported, setFullscreenSupported] = useState(true);
  useEffect(() => setFullscreenSupported(canFullscreen()), []);

  // The hook's syncViolationCount setter isn't available until after the
  // hook is called below, but reportViolation (passed *into* the hook) needs
  // to call it — a ref breaks the circular dependency.
  const syncCountRef = useRef<(count: number) => void>(() => undefined);

  const reportViolation = useCallback(
    async (event: ViolationEvent) => {
      try {
        const result = await apiFetch<{ violationCount: number; forceSubmit: boolean }>(
          `/api/exams/attempts/${attemptId}/violations`,
          { method: "POST", body: JSON.stringify({ type: event.type, detail: event.detail }) }
        );
        syncCountRef.current(result.violationCount);
        if (result.forceSubmit) onForceSubmit();
      } catch {
        // Network hiccup: the local counter (below) still gates the UI and
        // the server remains the source of truth once connectivity returns.
      }
      setModalOpen(true);
    },
    [attemptId, onForceSubmit]
  );

  const { isFullscreen, isAway, violationCount, lastViolation, requestEnterFullscreen, syncViolationCount } =
    useExamSecurity({
      enabled: lockedIn,
      config: security,
      onViolation: reportViolation,
      onMaxViolationsReached: onForceSubmit,
    });

  useEffect(() => {
    syncCountRef.current = syncViolationCount;
  }, [syncViolationCount]);

  // Keep the local auto-submit counter in line with the server's count.
  useEffect(() => {
    if (typeof serverViolationCount === "number") syncViolationCount(serverViolationCount);
  }, [serverViolationCount, syncViolationCount]);


  const handleEnter = async () => {
    if (security.requireFullscreen && fullscreenSupported) {
      await requestEnterFullscreen();
    }
    setLockedIn(true);
  };

  // Back to the exam after leaving it: must run from a click so the browser allows fullscreen.
  const handleReturn = async () => {
    setModalOpen(false);
    if (security.requireFullscreen && fullscreenSupported && !isFullscreen) {
      await requestEnterFullscreen();
    }
  };

  if (!lockedIn) {
    const rules = [
      { icon: "fullscreen", tone: "text-primary bg-primary/15", text: "หน้าจอจะขยายเต็มจอตลอดการสอบ" },
      { icon: "tab_close", tone: "text-tertiary bg-tertiary/15", text: "ห้ามสลับหน้าต่าง ห้ามออกจากเต็มจอ ห้ามคัดลอก" },
      { icon: "visibility", tone: "text-secondary bg-secondary/15", text: "ผู้คุมสอบเห็นทุกการกระทำแบบสด ๆ" },
      {
        icon: "gpp_bad",
        tone: "text-error bg-error/15",
        text: `ทำผิดครบ ${security.maxViolations} ครั้ง ระบบจะส่งข้อสอบทันที`,
      },
    ];
    return (
      <div className="exam-desk min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-4xl grid md:grid-cols-[1fr_1.15fr] overflow-hidden rounded-3xl border border-outline-variant/40 bg-surface-container/80 shadow-2xl backdrop-blur">
          {/* Cover sheet preview */}
          <div className="relative hidden md:flex items-center justify-center bg-gradient-to-br from-primary-container/30 via-surface-container-low to-surface-container-lowest p-10">
            <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(circle_at_1px_1px,rgba(173,198,255,0.35)_1px,transparent_0)] [background-size:22px_22px]" />
            <div className="relative w-56 rotate-[-4deg]">
              <div className="absolute inset-0 translate-x-3 translate-y-3 rotate-[5deg] rounded-sm bg-white/60" />
              <div className="absolute inset-0 translate-x-1.5 translate-y-1.5 rotate-[2deg] rounded-sm bg-white/80" />
              <div className="relative aspect-[8.5/11] rounded-sm bg-white p-4 font-paper text-black shadow-2xl">
                <div className="h-1.5 w-3/4 rounded bg-black/70" />
                <div className="mt-1.5 h-1 w-1/2 rounded bg-black/30" />
                <div className="mt-4 grid grid-cols-3 gap-1">
                  {Array.from({ length: 18 }, (_, i) => (
                    <div key={i} className="h-2.5 border border-black/40" />
                  ))}
                </div>
                <div className="mt-4 space-y-1.5">
                  {[90, 70, 85, 60, 80, 75].map((w, i) => (
                    <div key={i} className="h-1 rounded bg-black/25" style={{ width: `${w}%` }} />
                  ))}
                </div>
                <span className="absolute bottom-3 right-3 rounded border-2 border-error/80 px-1.5 text-[10px] font-bold text-error rotate-[-8deg]">
                  SECURE
                </span>
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="p-8 sm:p-10 space-y-6">
            <div className="space-y-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-semibold text-primary">
                <span className="material-symbols-outlined text-sm">shield_lock</span>
                Secure Exam
              </span>
              <h1 className="text-xl font-bold leading-snug text-on-surface">{title}</h1>
              {student && (
                <p className="flex items-center gap-1.5 text-sm text-on-surface-variant">
                  <span className="material-symbols-outlined text-base text-outline">badge</span>
                  {student.fullName}
                  {student.studentCode && <span className="font-mono text-outline">· {student.studentCode}</span>}
                </p>
              )}
            </div>

            {facts && facts.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {facts.map((f) => (
                  <div
                    key={f.label}
                    className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest/70 px-3 py-2.5 text-center"
                  >
                    <span className="material-symbols-outlined text-xl text-primary">{f.icon}</span>
                    <div className="mt-0.5 text-xs font-semibold text-on-surface">{f.label}</div>
                  </div>
                ))}
              </div>
            )}

            <ul className="space-y-2.5">
              {rules.map((r) => (
                <li key={r.icon} className="flex items-center gap-3 text-sm text-on-surface-variant">
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${r.tone}`}>
                    <span className="material-symbols-outlined text-lg">{r.icon}</span>
                  </span>
                  {r.text}
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={handleEnter}
              className="group flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary-container to-primary py-4 text-base font-bold text-on-primary-container shadow-lg shadow-primary-container/30 transition-transform hover:scale-[1.01] active:scale-[0.99]"
            >
              เริ่มทำข้อสอบ
              <span className="material-symbols-outlined transition-transform group-hover:translate-x-1">arrow_forward</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // The exam stays covered whenever the student is out of fullscreen or away from the window.
  // Devices that can't go fullscreen (iPhone, older iPad Safari) rely on the away detection alone.
  const locked = (security.requireFullscreen && fullscreenSupported && !isFullscreen) || isAway;

  return (
    <div className={`exam-desk ${wide ? "h-screen overflow-hidden" : "min-h-screen"}`}>
      <header className="sticky top-0 z-40 border-b border-outline-variant/30 bg-surface/80 backdrop-blur-xl">
        <div className="flex h-16 items-center gap-4 px-4 sm:px-6">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary-container to-primary text-on-primary-container shadow-md shadow-primary-container/30">
            <span className="material-symbols-outlined text-xl">edit_document</span>
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-semibold text-on-surface">{title}</h1>
            {student && (
              <p className="truncate text-[11px] text-outline">
                {student.fullName}
                {student.studentCode && <span className="font-mono"> · {student.studentCode}</span>}
              </p>
            )}
          </div>

          {progress && (
            <div className="hidden w-48 shrink-0 md:block">
              <div className="mb-1 flex items-baseline justify-between text-[11px]">
                <span className="text-outline">ตอบแล้ว</span>
                <span className="font-mono font-bold text-on-surface">
                  {progress.done}
                  <span className="font-normal text-outline">/{progress.total}</span>
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-surface-container-highest">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary-container to-secondary transition-all duration-500"
                  style={{ width: `${(progress.done / Math.max(progress.total, 1)) * 100}%` }}
                />
              </div>
            </div>
          )}

          <span
            className={`flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold ${
              violationCount === 0
                ? "border-secondary/30 bg-secondary/10 text-secondary"
                : "border-error/50 bg-error/15 text-error"
            }`}
          >
            <span className="material-symbols-outlined text-base">{violationCount === 0 ? "verified_user" : "gpp_maybe"}</span>
            {violationCount === 0 ? "ยังไม่ทำผิด" : `ทำผิด ${violationCount}/${security.maxViolations}`}
          </span>
          {deadline !== null && <ExamTimer deadline={deadline} onExpire={onExpire} />}
        </div>
      </header>

      <main
        className={`select-none ${
          wide
            ? "h-[calc(100vh-4rem)] overflow-hidden" // paper reader: the page never scrolls
            : "max-w-3xl mx-auto p-4 sm:p-6 space-y-5"
        } ${locked ? "invisible" : ""}`}
      >
        {children}
      </main>

      {locked && !modalOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-surface p-6">
          <div className="max-w-sm text-center space-y-4">
            <span className="material-symbols-outlined text-5xl text-error">lock</span>
            <h2 className="text-lg font-bold text-on-surface">ข้อสอบถูกล็อก</h2>
            <p className="text-sm text-on-surface-variant">
              คุณออกจากหน้าจอสอบ ระบบบันทึกไว้แล้ว กดปุ่มด้านล่างเพื่อกลับไปทำข้อสอบต่อ
            </p>
            <button
              type="button"
              onClick={handleReturn}
              className="w-full py-3.5 rounded-xl bg-primary text-on-primary font-bold text-base hover:opacity-90"
            >
              กลับไปทำข้อสอบ
            </button>
          </div>
        </div>
      )}

      <ViolationModal
        open={modalOpen}
        violation={lastViolation}
        violationCount={violationCount}
        maxViolations={security.maxViolations}
        currentQuestionNumber={currentQuestionNumber}
        onAcknowledge={handleReturn}
      />
    </div>
  );
}