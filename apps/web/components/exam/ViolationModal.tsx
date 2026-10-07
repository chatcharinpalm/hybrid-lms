"use client";

import { useEffect } from "react";
import Image from "next/image";
import type { ViolationEvent } from "@/hooks/useExamSecurity";

const VIOLATION_LABELS_TH: Record<ViolationEvent["type"], string> = {
  TAB_HIDDEN: "สลับแท็บหรือย่อหน้าต่างขณะทำข้อสอบ",
  WINDOW_BLUR: "คลิกออกนอกหน้าต่างสอบ / เปลี่ยนโปรแกรม",
  FULLSCREEN_EXIT: "ออกจากโหมดเต็มหน้าจอ (Esc/Exit Fullscreen)",
  COPY_ATTEMPT: "พยายามคัดลอกข้อความ (Copy / Ctrl+C)",
  PASTE_ATTEMPT: "พยายามวางข้อความ (Paste / Ctrl+V)",
  CUT_ATTEMPT: "พยายามตัดข้อความ (Cut / Ctrl+X)",
  CONTEXT_MENU_ATTEMPT: "เปิดเมนูคลิกขวา (Context Menu)",
  DEVTOOLS_SHORTCUT: "พยายามเปิดเครื่องมือนักพัฒนา (F12 / DevTools)",
  PRINT_SCREEN: "พยายามจับภาพหน้าจอ (Print Screen / Snipping)",
  MULTIPLE_DISPLAYS_DETECTED: "ตรวจพบการต่อจอภาพมากกว่าหนึ่งจอ",
};

interface ViolationModalProps {
  open: boolean;
  violation: ViolationEvent | null;
  violationCount: number;
  maxViolations: number;
  currentQuestionNumber?: number;
  onAcknowledge: () => void;
}

export function ViolationModal({
  open,
  violation,
  violationCount,
  maxViolations,
  currentQuestionNumber,
  onAcknowledge,
}: ViolationModalProps) {
  // Beep alert when opened
  useEffect(() => {
    if (open) {
      try {
        const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = "sine";
        osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
        osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.1); // A5
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.4);
      } catch {
        // AudioContext not allowed before user gesture
      }
    }
  }, [open]);

  if (!open || !violation) return null;

  const remaining = Math.max(maxViolations - violationCount, 0);
  const isFinalWarning = remaining === 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div
        className={`relative w-full max-w-md rounded-2xl border-2 p-6 shadow-2xl bg-surface-container-high transition-all transform scale-100 ${
          isFinalWarning
            ? "border-error shadow-error/30 ring-4 ring-error/20"
            : "border-amber-500 shadow-amber-500/20 ring-4 ring-amber-500/20"
        }`}
      >
        {/* Top Meme / Instructor Badge with User's Photo */}
        <div className="flex flex-col items-center text-center -mt-2 mb-4">
          <div className="relative mb-3">
            <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-amber-400 shadow-lg shadow-amber-500/30 bg-surface-container-lowest relative mx-auto animate-bounce">
              <Image
                src="/hun-nae.png"
                alt="อาจารย์คุมสอบ"
                width={120}
                height={120}
                className="object-cover w-full h-full object-top"
                priority
              />
            </div>
            <span className="absolute -bottom-1 -right-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-amber-500 text-black border border-amber-300 shadow">
              PROCTOR
            </span>
          </div>

          {/* Catchphrase requested by user */}
          <h2 className="text-xl font-black tracking-tight text-amber-300 drop-shadow flex items-center justify-center gap-1.5">
            <span>👀</span>
            <span>ฮั่นแน่จะทำไรฉันรู้นะ</span>
            <span>⚡</span>
          </h2>
          <p className="text-xs text-on-surface-variant mt-1 font-medium">
            {isFinalWarning
              ? "ระบบตรวจพบการฝ่าฝืนกฎครบตามเกณฑ์ — กำลังส่งข้อสอบอัตโนมัติ"
              : "อาจารย์กำลังจับตามองอยู่นะ อย่าคิดจะโกงเชียว!"}
          </p>
        </div>

        {/* Violation Details Box */}
        <div className="py-3 px-4 rounded-xl bg-surface-container-lowest/80 border border-outline-variant/30 space-y-2.5 text-xs text-on-surface-variant">
          <div className="flex items-center justify-between">
            <span className="text-outline font-medium">พฤติกรรมที่ตรวจพบ:</span>
            <span className="font-semibold text-error text-right max-w-[210px]">
              {VIOLATION_LABELS_TH[violation.type] || violation.type}
            </span>
          </div>

          {typeof currentQuestionNumber === "number" && (
            <div className="flex items-center justify-between border-t border-outline-variant/20 pt-2">
              <span className="text-outline font-medium">เกิดขึ้นขณะทำข้อที่:</span>
              <span className="font-bold text-primary font-mono">
                ข้อ {currentQuestionNumber}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between border-t border-outline-variant/20 pt-2">
            <span className="text-outline font-medium">บันทึกการฝ่าฝืนสะสม:</span>
            <span
              className={`font-mono font-bold px-2 py-0.5 rounded text-xs ${
                isFinalWarning
                  ? "bg-error/20 text-error border border-error/40"
                  : "bg-amber-500/20 text-amber-400 border border-amber-500/40"
              }`}
            >
              {violationCount} / {maxViolations} ครั้ง
            </span>
          </div>
        </div>

        {/* Warning text */}
        <div className="mt-4 text-center">
          {!isFinalWarning ? (
            <p className="text-xs text-amber-200/90 leading-relaxed">
              เตือนครั้งที่ <strong className="text-amber-400 font-bold">{violationCount}</strong>! หากทำผิดกฎอีก{" "}
              <strong className="text-error font-bold">{remaining}</strong> ครั้ง ระบบจะปรับตกและส่งข้อสอบทันที
            </p>
          ) : (
            <p className="text-xs text-error font-semibold">
              คุณได้ทำผิดกฎครบกำหนดแล้ว ระบบได้บันทึกรายงานการทุจริตไปยังอาจารย์ผู้คุมสอบเรียบร้อยแล้ว
            </p>
          )}
        </div>

        {/* Action Button */}
        <div className="mt-5 flex justify-center">
          <button
            type="button"
            onClick={onAcknowledge}
            className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs tracking-wide transition-all shadow-md ${
              isFinalWarning
                ? "bg-error text-on-error hover:bg-error/90"
                : "bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-semibold"
            }`}
          >
            {isFinalWarning ? "รับทราบผลการสอบ" : "รับทราบและกลับสู่ข้อสอบ (สัญญาว่าจะไม่ทำอีก)"}
          </button>
        </div>
      </div>
    </div>
  );
}
