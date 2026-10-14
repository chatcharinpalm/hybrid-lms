"use client";

import { useEffect } from "react";

export interface BankEntry {
  code: string;
  label: string;
  /** Already given as the answer to another blank (faded, still choosable). */
  used?: boolean;
}

/** Width of the side panel; the exam beside it moves left by the same amount (md and up). */
export const BANK_PANEL_SHIFT = "md:mr-[min(420px,42vw)]";
const PANEL_W = "md:w-[min(420px,42vw)]";

/** Side panel from md up; phones keep the sheet along the bottom. */
const isWide = () => typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches;

/**
 * The Option Bank as a sheet of paper laid beside the exam: it slides in at
 * the right when a blank is tapped and the exam moves left to make room, like
 * an answer sheet on the desk next to the question paper. Tapping an entry
 * fills the blank (and can be changed again later); the sheet stays open so
 * the student can go on to the next blank. Phones get it along the bottom.
 */
export function BankPanel({
  entries,
  questionLabel,
  selectedCode,
  onPick,
  onClose,
}: {
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

  return (
    <aside
      className={`bank-panel-in fixed inset-x-0 bottom-0 z-50 flex max-h-[52vh] flex-col border-t-2 border-blue-700 bg-[#fdfcf8] font-paper text-black shadow-[0_-12px_40px_rgba(0,0,0,0.45)] md:inset-x-auto md:bottom-0 md:right-0 md:top-16 md:max-h-none md:border-l md:border-t-0 md:border-black/20 md:shadow-[-14px_0_40px_rgba(0,0,0,0.5)] ${PANEL_W}`}
      // Taps inside must not take focus from the blank (that would close or move it).
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-black/25 px-4 pb-2 pt-3">
        <div className="min-w-0">
          <p className="text-[16px] font-bold leading-tight">คลังตัวเลือก (Option Bank)</p>
          <p className="mt-0.5 text-[14px] leading-tight text-black/60">
            {questionLabel ? (
              <>
                กำลังตอบ <b className="text-blue-800">{questionLabel}</b> — แตะตัวเลือกเพื่อเติม (เปลี่ยนได้ตลอด)
              </>
            ) : (
              "แตะช่องว่างในข้อสอบก่อน แล้วเลือกตัวเลือกจากแผ่นนี้"
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="ปิดคลังตัวเลือก"
          className="flex h-8 shrink-0 items-center gap-1 rounded-full px-2 text-sm text-black/60 hover:bg-black/5 hover:text-black"
        >
          ปิด
          <span className="material-symbols-outlined text-lg">close</span>
        </button>
      </div>

      {/* The table as printed on the paper: code | answer, two pairs across. */}
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        <div className="border-l border-t border-black">
          <div className="grid grid-cols-[3.6rem_1fr] text-[14px] font-bold md:grid-cols-[3.6rem_1fr_3.6rem_1fr]">
            {[0, 1].map((c) => (
              <div key={c} className={`contents ${c === 1 ? "max-md:hidden" : ""}`}>
                <div className="border-b border-r border-black px-1 py-1 text-center">รหัส</div>
                <div className="border-b border-r border-black px-1.5 py-1 text-center">คำตอบ</div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2">
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
                  className={`grid grid-cols-[3.6rem_1fr] border-b border-r border-black text-left text-[15px] leading-snug transition-colors disabled:cursor-default ${
                    selected ? "bg-blue-700 text-white" : e.used ? "text-black/35 enabled:hover:bg-blue-50" : "enabled:hover:bg-blue-50"
                  }`}
                >
                  <b className={`flex items-center justify-center border-r border-black px-1 py-1 text-[14px] ${selected ? "text-white" : "text-blue-900"}`}>
                    [{e.code}]
                  </b>
                  <span className={`px-1.5 py-1 ${e.used && !selected ? "line-through decoration-black/25" : ""}`}>{e.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </aside>
  );
}
