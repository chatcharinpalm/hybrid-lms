"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useExamSecurity, type ViolationEvent } from "@/hooks/useExamSecurity";
import type { ExamSecurityConfig } from "@/types/exam";
import { ViolationModal } from "./ViolationModal";
import { ExamTimer } from "./ExamTimer";

interface SecureExamShellProps {
  title: string;
  attemptId: string;
  startedAt: string;
  durationMinutes: number;
  security: ExamSecurityConfig;
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
 *     startedAt={paper.startedAt} durationMinutes={paper.durationMinutes}
 *     security={paper.security} onExpire={submit} onForceSubmit={submit}>
 *     <QuestionPanel questions={paper.questions} ... />
 *   </SecureExamShell>
 */
export function SecureExamShell({
  title,
  attemptId,
  startedAt,
  durationMinutes,
  security,
  children,
  onExpire,
  onForceSubmit,
}: SecureExamShellProps) {
  const [lockedIn, setLockedIn] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

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

  const { isFullscreen, violationCount, lastViolation, requestEnterFullscreen, syncViolationCount } =
    useExamSecurity({
      enabled: lockedIn,
      config: security,
      onViolation: reportViolation,
      onMaxViolationsReached: onForceSubmit,
    });

  useEffect(() => {
    syncCountRef.current = syncViolationCount;
  }, [syncViolationCount]);

  const handleEnter = async () => {
    if (security.requireFullscreen) {
      await requestEnterFullscreen();
    }
    setLockedIn(true);
  };

  if (!lockedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-lg w-full rounded-lg border border-outline-variant/40 bg-surface-container p-8 text-center space-y-5">
          <span className="material-symbols-outlined text-4xl text-primary">lock</span>
          <h1 className="text-lg font-semibold text-on-surface">{title}</h1>
          <p className="text-xs text-on-surface-variant leading-relaxed">
            ระบบจะเข้าสู่โหมดเต็มหน้าจอและล็อกฟังก์ชันคัดลอก/วาง คลิกขวา และคีย์ลัดบางส่วน
            การสลับหน้าต่างหรือออกจากโหมดเต็มหน้าจอจะถูกบันทึกเป็นการทุจริต
          </p>
          <ul className="text-[11px] text-on-surface-variant text-left bg-surface-container-lowest border border-outline-variant/20 rounded p-3 space-y-1 font-mono">
            <li>• Fullscreen Lockdown: {security.requireFullscreen ? "เปิดใช้งาน" : "ปิด"}</li>
            <li>• Clipboard Block: {security.blockClipboard ? "เปิดใช้งาน" : "ปิด"}</li>
            <li>• Context Menu Block: {security.blockContextMenu ? "เปิดใช้งาน" : "ปิด"}</li>
            <li>• Auto-submit threshold: {security.maxViolations} ครั้ง</li>
          </ul>
          <button
            type="button"
            onClick={handleEnter}
            className="w-full py-2.5 rounded bg-primary text-on-primary font-semibold text-sm hover:opacity-90 transition-opacity"
          >
            เข้าสู่ห้องสอบ (Enter Secure Mode)
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 h-16 bg-surface/95 backdrop-blur border-b border-outline-variant/30 px-6 flex items-center justify-between">
        <div className="flex items-center gap-4 min-w-0">
          <h1 className="text-sm font-semibold text-on-surface truncate">{title}</h1>
          <span
            className={`hidden sm:flex items-center gap-1.5 text-[11px] font-mono px-2 py-0.5 rounded border ${
              isFullscreen
                ? "text-secondary border-secondary/30 bg-secondary/10"
                : "text-error border-error/30 bg-error/10"
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isFullscreen ? "bg-secondary" : "bg-error"}`} />
            {isFullscreen ? "Lockdown Active" : "Lockdown Inactive"}
          </span>
          <span className="hidden md:flex items-center gap-1.5 text-[11px] font-mono px-2 py-0.5 rounded border border-outline-variant/40 text-on-surface-variant">
            <span className="material-symbols-outlined text-sm">shield</span>
            Violations: {violationCount}/{security.maxViolations}
          </span>
        </div>
        <ExamTimer startedAt={startedAt} durationMinutes={durationMinutes} onExpire={onExpire} />
      </header>

      <main className="max-w-5xl mx-auto p-6 space-y-6 select-none">{children}</main>

      <ViolationModal
        open={modalOpen}
        violation={lastViolation}
        violationCount={violationCount}
        maxViolations={security.maxViolations}
        onAcknowledge={() => setModalOpen(false)}
      />
    </div>
  );
}
