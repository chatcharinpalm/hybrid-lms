"use client";

import type { ViolationEvent } from "@/hooks/useExamSecurity";

const VIOLATION_LABELS_TH: Record<ViolationEvent["type"], string> = {
  TAB_HIDDEN: "สลับแท็บหรือย่อหน้าต่างขณะทำข้อสอบ",
  WINDOW_BLUR: "คลิกออกนอกหน้าต่างสอบ",
  FULLSCREEN_EXIT: "ออกจากโหมดเต็มหน้าจอ",
  COPY_ATTEMPT: "พยายามคัดลอกข้อความ (Copy)",
  PASTE_ATTEMPT: "พยายามวางข้อความ (Paste)",
  CUT_ATTEMPT: "พยายามตัดข้อความ (Cut)",
  CONTEXT_MENU_ATTEMPT: "เปิดเมนูคลิกขวา",
  DEVTOOLS_SHORTCUT: "พยายามเปิดเครื่องมือนักพัฒนา (DevTools)",
  PRINT_SCREEN: "พยายามจับภาพหน้าจอ (Print Screen)",
  MULTIPLE_DISPLAYS_DETECTED: "ตรวจพบจอภาพมากกว่าหนึ่งจอ",
};

interface ViolationModalProps {
  open: boolean;
  violation: ViolationEvent | null;
  violationCount: number;
  maxViolations: number;
  onAcknowledge: () => void;
}

export function ViolationModal({
  open,
  violation,
  violationCount,
  maxViolations,
  onAcknowledge,
}: ViolationModalProps) {
  if (!open || !violation) return null;

  const remaining = Math.max(maxViolations - violationCount, 0);
  const isFinalWarning = remaining === 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-surface-container-lowest/85 backdrop-blur-sm p-4">
      <div
        className={`relative w-full max-w-md rounded-lg border p-6 shadow-xl bg-surface-container-high ${
          isFinalWarning ? "border-error/60" : "border-tertiary/50"
        }`}
      >
        <div className="flex items-center gap-3 pb-3 border-b border-outline-variant/30">
          <span
            className={`material-symbols-outlined text-2xl ${
              isFinalWarning ? "text-error" : "text-tertiary"
            }`}
          >
            {isFinalWarning ? "gpp_bad" : "warning"}
          </span>
          <h3 className="text-sm font-semibold text-on-surface">
            {isFinalWarning ? "ตรวจพบการทุจริตครบตามเกณฑ์ — ระบบจะส่งข้อสอบอัตโนมัติ" : "ตรวจพบพฤติกรรมผิดปกติ"}
          </h3>
        </div>

        <div className="py-4 space-y-3 text-xs text-on-surface-variant leading-relaxed">
          <p>
            เหตุการณ์: <strong className="text-on-surface">{VIOLATION_LABELS_TH[violation.type]}</strong>
          </p>
          <div className="flex items-center justify-between p-2.5 rounded bg-surface-container-lowest border border-outline-variant/20 font-mono">
            <span>จำนวนครั้งที่บันทึก</span>
            <span className={`font-semibold ${isFinalWarning ? "text-error" : "text-tertiary"}`}>
              {violationCount} / {maxViolations}
            </span>
          </div>
          {!isFinalWarning && (
            <p>
              หากทำผิดกฎอีก <strong className="text-error">{remaining}</strong> ครั้ง ระบบจะส่งข้อสอบของคุณโดยอัตโนมัติ
              และแจ้งผู้คุมสอบทันที
            </p>
          )}
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onAcknowledge}
            className="px-4 py-2 rounded bg-primary text-on-primary font-medium text-xs hover:opacity-90 transition-opacity"
          >
            รับทราบและกลับสู่ข้อสอบ
          </button>
        </div>
      </div>
    </div>
  );
}
