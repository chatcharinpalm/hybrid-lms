"use client";

import { useEffect, useRef, useState } from "react";
import { idleFor, isLoggedIn, logout, STUDENT_IDLE_MS, touchActivity } from "@/lib/auth";

export const IDLE_LIMIT_MS = STUDENT_IDLE_MS;
const WARN_MS = 30_000;

/**
 * Signs a student out after 5 minutes without a mouse move, key or tap, with
 * a 30-second warning first, and at once when a page opens on a session left
 * idle that long (the next person at a lab computer must not find the last
 * student signed in). Activity in any tab counts (it is kept in localStorage).
 *
 * `paused` — the exam screen: a student may sit thinking without touching
 * anything, so no sign-out there; the screen keeps the session marked as in
 * use for as long as it is open, and a closed exam tab still runs out.
 */
export function IdleLogout({ paused = false }: { paused?: boolean }) {
  const [left, setLeft] = useState<number | null>(null);
  const lastWrite = useRef(0);

  useEffect(() => {
    if (!isLoggedIn()) return;
    const signOut = () => {
      logout();
      window.location.href = "/login?expired=1";
    };
    // A session found already idle too long: someone else's, left behind.
    if (idleFor() > IDLE_LIMIT_MS) {
      signOut();
      return;
    }
    touchActivity();

    const onActivity = () => {
      // At most one write every 5 s.
      if (Date.now() - lastWrite.current < 5000) return;
      lastWrite.current = Date.now();
      touchActivity();
      setLeft(null);
    };
    const events = ["mousemove", "pointerdown", "keydown", "wheel", "touchstart", "scroll"] as const;
    if (!paused) events.forEach((e) => window.addEventListener(e, onActivity, { passive: true, capture: true }));

    const tick = setInterval(() => {
      if (!isLoggedIn()) return;
      if (paused) {
        touchActivity();
        return;
      }
      const remaining = IDLE_LIMIT_MS - idleFor();
      if (remaining <= 0) signOut();
      else setLeft(remaining <= WARN_MS ? Math.ceil(remaining / 1000) : null);
    }, 1000);

    return () => {
      clearInterval(tick);
      events.forEach((e) => window.removeEventListener(e, onActivity, { capture: true }));
    };
  }, [paused]);

  if (left === null) return null;
  return (
    <div className="fixed inset-x-0 top-4 z-[90] flex justify-center px-4">
      <div className="flex items-center gap-3 rounded-2xl border border-tertiary/50 bg-surface-container-high px-4 py-3 shadow-2xl">
        <span className="material-symbols-outlined text-2xl text-tertiary">timer</span>
        <span className="text-sm text-on-surface">
          ไม่ได้ใช้งานนาน จะออกจากระบบใน <b className="font-mono text-tertiary">{left}</b> วินาที
        </span>
        <button
          type="button"
          onClick={() => {
            touchActivity();
            setLeft(null);
          }}
          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-on-primary"
        >
          ยังใช้งานอยู่
        </button>
      </div>
    </div>
  );
}
