"use client";

import { useEffect, useRef, useState } from "react";

interface ExamTimerProps {
  /** Epoch ms when the exam ends, derived from the server's time remaining. */
  deadline: number;
  onExpire: () => void;
}

export function ExamTimer({ deadline, onExpire }: ExamTimerProps) {
  const [remainingMs, setRemainingMs] = useState(() => deadline - Date.now());
  const expiredRef = useRef(false);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    expiredRef.current = false;
    const interval = setInterval(() => {
      const remaining = deadline - Date.now();
      setRemainingMs(remaining);
      if (remaining <= 0 && !expiredRef.current) {
        expiredRef.current = true;
        onExpireRef.current();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [deadline]);

  const clamped = Math.max(remainingMs, 0);
  const hrs = Math.floor(clamped / 3_600_000);
  const mins = String(Math.floor((clamped % 3_600_000) / 60_000)).padStart(2, "0");
  const secs = String(Math.floor((clamped % 60_000) / 1000)).padStart(2, "0");
  const isLow = clamped < 5 * 60_000;
  const isWarn = clamped < 15 * 60_000;

  return (
    <div
      className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 ${
        isLow
          ? "border-error/60 bg-error/15 text-error animate-pulse"
          : isWarn
            ? "border-tertiary/50 bg-tertiary/10 text-tertiary"
            : "border-primary/30 bg-primary/10 text-primary"
      }`}
    >
      <span className="material-symbols-outlined text-xl">timer</span>
      <div className="flex flex-col leading-none">
        <span className="text-[10px] font-medium opacity-80">เวลาคงเหลือ</span>
        <span className="font-mono text-lg font-bold tabular-nums">
          {hrs > 0 ? `${hrs}:` : ""}
          {mins}:{secs}
        </span>
      </div>
    </div>
  );
}
