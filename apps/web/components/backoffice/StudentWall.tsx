"use client";

import { useEffect, useRef, useState } from "react";
import { TileActions } from "./StudentControls";

export interface WallStudent {
  studentId: string;
  attemptId: string | null;
  fullName: string;
  studentCode: string;
  section: string | null;
  /** Place on the room's ก–ฮ class list. */
  seatNumber: number | null;
  status: "NOT_STARTED" | "IN_PROGRESS" | "SUBMITTED" | "AUTO_SUBMITTED";
  endedReason: string | null;
  questionSecondsLeft: number | null;
  secondsLeft: number | null;
  answeredCount: number;
  totalQuestions: number;
  violationCount: number;
  scorePoints: number | null;
  violations: Array<{ id: string; type: string; occurredAt: string }>;
}

/** Short label + icon per violation type, small enough to fit on a tile. */
const VIOLATION_CHIP: Record<string, { label: string; icon: string }> = {
  TAB_HIDDEN: { label: "สลับแท็บ", icon: "tab" },
  WINDOW_BLUR: { label: "คลิกออกนอกจอ", icon: "ads_click" },
  FULLSCREEN_EXIT: { label: "ออกเต็มจอ", icon: "fullscreen_exit" },
  COPY_ATTEMPT: { label: "คัดลอก", icon: "content_copy" },
  PASTE_ATTEMPT: { label: "วาง", icon: "content_paste" },
  CUT_ATTEMPT: { label: "ตัด", icon: "content_cut" },
  CONTEXT_MENU_ATTEMPT: { label: "คลิกขวา", icon: "right_click" },
  DEVTOOLS_SHORTCUT: { label: "DevTools", icon: "code" },
  PRINT_SCREEN: { label: "จับภาพจอ", icon: "screenshot" },
  MULTIPLE_DISPLAYS_DETECTED: { label: "หลายจอ", icon: "desktop_windows" },
};

/** A violation this recent makes its tile flash. */
const FRESH_MS = 30_000;

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

interface StudentWallProps {
  students: WallStudent[];
  maxViolations: number;
  /** Size tiles so every student fits the container without scrolling. */
  fit: boolean;
  /** Per-question timed exam (changes what "+5 min" extends). */
  timed: boolean;
  onSelect: (studentId: string) => void;
  /** After a control action succeeds, with a notice to show. */
  onAction: (notice: string) => void;
}

/**
 * Every student on one screen, seated in class-list order, showing at a glance
 * who broke which rule and how often. Click a tile for the full history and controls.
 */
export function StudentWall({ students, maxViolations, fit, timed, onSelect, onAction }: StudentWallProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [grid, setGrid] = useState<{ cols: number; rowHeight: number } | null>(null);

  // Pick the column count that gives the biggest tiles while every row fits the height.
  useEffect(() => {
    const el = containerRef.current;
    if (!fit || !el) {
      setGrid(null);
      return;
    }
    const GAP = 8;
    const measure = () => {
      const { width, height } = el.getBoundingClientRect();
      const n = Math.max(students.length, 1);
      let best = { cols: 1, rowHeight: 0, size: 0 };
      for (let cols = 1; cols <= n; cols++) {
        const rows = Math.ceil(n / cols);
        const w = (width - GAP * (cols - 1)) / cols;
        const h = (height - GAP * (rows - 1)) / rows;
        if (w < 210 || h < 104) continue;
        // Tiles read best around 2:1; score by the smaller of width/2 and height.
        const size = Math.min(w / 2, h);
        if (size > best.size) best = { cols, rowHeight: Math.min(h, w * 0.75), size };
      }
      setGrid(best.size > 0 ? { cols: best.cols, rowHeight: best.rowHeight } : null);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [fit, students.length]);

  const now = Date.now();

  return (
    <div ref={containerRef} className={fit ? "h-full min-h-0" : ""}>
      <div
        className="grid gap-2"
        style={
          grid
            ? { gridTemplateColumns: `repeat(${grid.cols}, minmax(0, 1fr))`, gridAutoRows: `${grid.rowHeight}px` }
            : { gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }
        }
      >
        {students.map((s, i) => (
          <Tile
            key={s.studentId}
            seat={s.seatNumber ?? i + 1}
            student={s}
            maxViolations={maxViolations}
            fresh={s.violations.some((v) => now - new Date(v.occurredAt).getTime() < FRESH_MS)}
            timed={timed}
            onClick={() => onSelect(s.studentId)}
            onAction={(text) => onAction(`${s.fullName}: ${text}`)}
          />
        ))}
      </div>
    </div>
  );
}

interface TileProps {
  seat: number;
  student: WallStudent;
  maxViolations: number;
  fresh: boolean;
  timed: boolean;
  onClick: () => void;
  onAction: (notice: string) => void;
}

function Tile({ seat, student: s, maxViolations, fresh, timed, onClick, onAction }: TileProps) {
  const logged = s.violations.length;
  const kicked = s.endedReason === "VIOLATIONS" || s.violationCount >= maxViolations;
  const flagged = logged > 0;

  const counts = new Map<string, number>();
  for (const v of s.violations) counts.set(v.type, (counts.get(v.type) ?? 0) + 1);
  const chips = [...counts.entries()].sort((a, b) => b[1] - a[1]);

  const tone = kicked
    ? "border-error bg-error/20"
    : flagged
      ? "border-amber-500/70 bg-amber-500/10"
      : s.status === "NOT_STARTED"
        ? "border-outline-variant/20 bg-surface-container-lowest/60 opacity-60"
        : "border-outline-variant/30 bg-surface-container";

  const status =
    s.status === "IN_PROGRESS"
      ? { text: "กำลังสอบ", cls: "text-primary", dot: "bg-primary animate-pulse" }
      : s.status === "NOT_STARTED"
        ? { text: "ยังไม่เริ่ม", cls: "text-outline", dot: "bg-outline/50" }
        : kicked
          ? { text: "ถูกปรับส่ง", cls: "text-error", dot: "bg-error" }
          : { text: "ส่งแล้ว", cls: "text-secondary", dot: "bg-secondary" };

  const timeLeft = s.questionSecondsLeft ?? s.secondsLeft;

  return (
    // A div, not a button: the tile holds its own control buttons. No filter/transform
    // on it either — those would trap the fixed-position message popup inside the tile.
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === "Enter" && e.target === e.currentTarget && onClick()}
      title="คลิกเพื่อดูประวัติทั้งหมด"
      className={`relative flex h-full min-h-[104px] cursor-pointer gap-2 rounded-xl border-2 p-2 text-left transition-colors hover:border-primary/70 ${tone}`}
    >
      <div className="flex min-w-0 flex-1 flex-col">
      {fresh && (
        <span className="pointer-events-none absolute -inset-1 rounded-[14px] ring-2 ring-error animate-pulse" />
      )}
      <div className="flex items-center gap-1.5 text-[10px] font-mono text-outline">
        <span className="font-bold text-on-surface-variant">#{seat}</span>
        {s.section && <span className="shrink-0 font-sans text-on-surface-variant">{s.section.split(" DE-RA")[0]}</span>}
        <span className="truncate">{s.studentCode}</span>
        <span className={`ml-auto flex shrink-0 items-center gap-1 font-sans font-semibold ${status.cls}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
          {status.text}
        </span>
      </div>

      <div className="mt-0.5 flex items-start gap-2">
        <span className="min-w-0 flex-1 truncate text-[13px] font-bold leading-tight text-on-surface">{s.fullName}</span>
        {flagged && (
          <span
            title={`นับโกง ${s.violationCount}/${maxViolations} · บันทึกทั้งหมด ${logged} ครั้ง`}
            className={`shrink-0 rounded-md px-1.5 font-mono text-base font-black leading-tight ${
              kicked ? "bg-error text-white" : "bg-amber-500 text-black"
            }`}
          >
            {logged}
          </span>
        )}
      </div>

      <div className="mt-1 flex min-h-0 flex-1 flex-wrap content-start gap-1 overflow-hidden">
        {chips.length === 0 && s.status !== "NOT_STARTED" && (
          <span className="flex items-center gap-0.5 text-[10px] text-secondary/80">
            <span className="material-symbols-outlined text-[12px]">verified_user</span>
            ไม่พบการโกง
          </span>
        )}
        {chips.map(([type, n]) => {
          const chip = VIOLATION_CHIP[type] ?? { label: type, icon: "warning" };
          return (
            <span
              key={type}
              className={`flex items-center gap-0.5 rounded px-1 py-px text-[10px] font-semibold ${
                kicked ? "bg-error/30 text-white" : "bg-amber-500/20 text-amber-200"
              }`}
            >
              <span className="material-symbols-outlined text-[12px]">{chip.icon}</span>
              {chip.label}
              {n > 1 && <span className="font-mono">×{n}</span>}
            </span>
          );
        })}
      </div>

      {s.status !== "NOT_STARTED" && (
        <div className="mt-1 flex items-center justify-between font-mono text-[10px] text-outline">
          <span>
            ตอบ {s.answeredCount}/{s.totalQuestions}
          </span>
          {s.status === "IN_PROGRESS" && timeLeft !== null ? (
            <span className={timeLeft < 300 ? "text-error" : ""}>เหลือ {mmss(timeLeft)}</span>
          ) : s.scorePoints !== null ? (
            <span className="text-on-surface-variant">
              ได้ {s.scorePoints}/{s.totalQuestions}
            </span>
          ) : null}
        </div>
      )}

      </div>

      {/* Small controls down the side: act on this student without leaving the wall. */}
      {s.attemptId && (
        <div className="-my-0.5 shrink-0 border-l border-outline-variant/25 pl-2">
          <TileActions
            key={s.attemptId}
            rail
            attemptId={s.attemptId}
            studentName={s.fullName}
            status={s.status}
            timed={timed}
            onDone={onAction}
          />
        </div>
      )}
    </div>
  );
}
