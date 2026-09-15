"use client";

import { useEffect, useRef, useState } from "react";

interface ExamTimerProps {
  startedAt: string;
  durationMinutes: number;
  onExpire: () => void;
}

export function ExamTimer({ startedAt, durationMinutes, onExpire }: ExamTimerProps) {
  const deadline = new Date(startedAt).getTime() + durationMinutes * 60_000;
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
  const hrs = String(Math.floor(clamped / 3_600_000)).padStart(2, "0");
  const mins = String(Math.floor((clamped % 3_600_000) / 60_000)).padStart(2, "0");
  const secs = String(Math.floor((clamped % 60_000) / 1000)).padStart(2, "0");
  const isLow = clamped < 5 * 60_000;

  return (
    <div className="px-4 py-2 rounded bg-surface-container-lowest border border-outline-variant/40 flex flex-col justify-center">
      <span className="text-[11px] uppercase tracking-wider text-outline font-medium">เวลาคงเหลือ</span>
      <span className={`font-mono text-lg font-semibold ${isLow ? "text-error" : "text-primary"}`}>
        {hrs}:{mins}:{secs}
      </span>
    </div>
  );
}
