"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

export interface BankEntry {
  code: string;
  label: string;
  /** Already given as the answer to another blank (faded, still choosable). */
  used?: boolean;
}

/** Width of the side panel; the exam beside it moves left by the same amount (md and up). */
export const BANK_PANEL_SHIFT = "md:mr-[min(600px,48vw)]";
const PANEL_W = "md:w-[min(600px,48vw)]";

/** Side panel from md up; phones keep the sheet along the bottom. */
const isWide = () => typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches;

/** Text size range for fitting the whole bank on screen (px). */
const FONT_MAX = 17;
const FONT_MIN = 9;

/**
 * The Option Bank as a sheet of paper laid beside the exam: it slides in at
 * the right when a blank is tapped and the exam moves left to make room, like
 * an answer sheet on the desk next to the question paper. Every entry shows at
 * once — the table takes three code|answer pairs across when there is room and
 * its text shrinks until the whole bank fits the screen, so it never scrolls.
 * Tapping an entry fills the blank (and can be changed again later); the sheet
 * stays open so the student can go on to the next blank. Phones get it along
 * the bottom (scrolling there, as the text would be too small otherwise).
 */
export function BankPanel({
  entries,
  questionLabel,
  selectedCode,
  onPick,
  onClose,
  title,
}: {
  /** Combined exams: the chapter whose bank this is. */
  title?: string;
  entries: BankEntry[];
  /** "ข้อ 5", or null when browsing the bank without a blank chosen. */
  questionLabel: string | null;
  selectedCode: string | null;
  onPick: (code: string) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Fit: pick the column count from the sheet's width, then the largest text size at which the table fits its height.
  const boxRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState({ cols: 2, font: 15 });
  useLayoutEffect(() => {
    const box = boxRef.current;
    const table = tableRef.current;
    if (!box || !table) return;
    const refit = () => {
      if (!isWide()) {
        setFit({ cols: box.clientWidth >= 560 ? 3 : box.clientWidth >= 380 ? 2 : 1, font: 15 });
        return;
      }
      const cols = box.clientWidth >= 500 ? 3 : 2;
      table.style.setProperty("--cols", String(cols));
      let lo = FONT_MIN;
      let hi = FONT_MAX;
      // Binary search on half-pixels; the table is measured directly, before React re-renders.
      const room = box.clientHeight - 16; // the box's padding
      while (hi - lo > 0.25) {
        const mid = (lo + hi) / 2;
        table.style.fontSize = `${mid}px`;
        if (table.offsetHeight <= room) lo = mid;
        else hi = mid;
      }
      table.style.fontSize = `${lo}px`;
      setFit((f) => (f.cols === cols && f.font === lo ? f : { cols, font: lo }));
    };
    refit();
    // Thai glyphs load on first use, after the first fit, and change every row's height: fit again.
    document.fonts?.ready.then(refit).catch(() => undefined);
    document.fonts?.addEventListener("loadingdone", refit);
    const ro = new ResizeObserver(() => requestAnimationFrame(refit));
    ro.observe(box);
    return () => {
      ro.disconnect();
      document.fonts?.removeEventListener("loadingdone", refit);
    };
  }, [entries]);

  return (
    <aside
      className={`bank-panel-in fixed inset-x-0 bottom-0 z-50 flex max-h-[52vh] flex-col border-t-2 border-blue-700 bg-[#fdfcf8] font-paper text-black shadow-[0_-12px_40px_rgba(0,0,0,0.45)] md:inset-x-auto md:bottom-0 md:right-0 md:top-16 md:max-h-none md:border-l md:border-t-0 md:border-black/20 md:shadow-[-14px_0_40px_rgba(0,0,0,0.5)] ${PANEL_W}`}
      // Taps inside must not take focus from the blank (that would close or move it).
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-black/25 px-3 py-1.5">
        <p className="min-w-0 truncate text-[15px] leading-tight">
          <b>คลังตัวเลือก{title ? ` (${title})` : ""}</b>
          <span className="text-black/60">
            {questionLabel ? (
              <>
                {" "}— กำลังตอบ <b className="text-blue-800">{questionLabel}</b> แตะตัวเลือกเพื่อเติม (เปลี่ยนได้ตลอด)
              </>
            ) : (
              " — แตะช่องว่างในข้อสอบก่อน แล้วเลือกจากแผ่นนี้"
            )}
          </span>
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="ปิดคลังตัวเลือก"
          className="flex h-7 shrink-0 items-center gap-1 rounded-full px-2 text-sm text-black/60 hover:bg-black/5 hover:text-black"
        >
          ปิด
          <span className="material-symbols-outlined text-lg">close</span>
        </button>
      </div>

      {/* The table as printed on the paper: code | answer pairs across, every entry on screen at once. */}
      <div ref={boxRef} className="min-h-0 flex-1 overflow-y-auto p-2">
        <div
          ref={tableRef}
          className="border-l border-t border-black leading-snug"
          style={{ fontSize: fit.font, ["--cols" as string]: fit.cols }}
        >
          <div className="grid font-bold" style={{ gridTemplateColumns: "repeat(var(--cols), 3.7em 1fr)" }}>
            {Array.from({ length: fit.cols }, (_, c) => (
              <div key={c} className="contents">
                <div className="border-b border-r border-black px-1 py-0.5 text-center">รหัส</div>
                <div className="border-b border-r border-black px-1 py-0.5 text-center">คำตอบ</div>
              </div>
            ))}
          </div>
          <div className="grid" style={{ gridTemplateColumns: "repeat(var(--cols), 1fr)" }}>
            {entries.map((e) => {
              const selected = e.code === selectedCode;
              return (
                <button
                  key={e.code}
                  type="button"
                  disabled={!questionLabel}
                  onClick={() => {
                    onPick(e.code);
                    if (!isWide()) onClose();
                  }}
                  className={`grid grid-cols-[3.7em_1fr] border-b border-r border-black text-left transition-colors disabled:cursor-default ${
                    selected ? "bg-blue-700 text-white" : e.used ? "text-black/35 enabled:hover:bg-blue-50" : "enabled:hover:bg-blue-50"
                  }`}
                >
                  <b className={`flex items-center justify-center border-r border-black px-0.5 py-0.5 text-[0.92em] ${selected ? "text-white" : "text-blue-900"}`}>
                    [{e.code}]
                  </b>
                  <span className={`px-1.5 py-0.5 ${e.used && !selected ? "line-through decoration-black/25" : ""}`}>{e.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </aside>
  );
}
