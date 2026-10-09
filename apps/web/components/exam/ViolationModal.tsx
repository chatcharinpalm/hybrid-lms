"use client";

import { useEffect, useState } from "react";
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

/** How long the scare holds the whole screen before the details and the button appear. */
const SCARE_MS = 1600;

interface ViolationModalProps {
  open: boolean;
  violation: ViolationEvent | null;
  violationCount: number;
  maxViolations: number;
  currentQuestionNumber?: number;
  onAcknowledge: () => void;
}

/** A harsh, falling alarm shriek: detuned saws plus a burst of noise. */
function playScream() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const t = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, t);
    master.gain.exponentialRampToValueAtTime(0.55, t + 0.03);
    master.gain.exponentialRampToValueAtTime(0.0001, t + 1.3);
    master.connect(ctx.destination);

    for (const detune of [-25, 0, 31]) {
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.detune.value = detune;
      osc.frequency.setValueAtTime(1350, t);
      osc.frequency.exponentialRampToValueAtTime(220, t + 1.2);
      // Wobble, like a siren.
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = 11;
      lfoGain.gain.value = 60;
      lfo.connect(lfoGain).connect(osc.frequency);
      osc.connect(master);
      osc.start(t);
      lfo.start(t);
      osc.stop(t + 1.3);
      lfo.stop(t + 1.3);
    }

    const len = Math.floor(ctx.sampleRate * 0.5);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.35;
    noise.connect(noiseGain).connect(master);
    noise.start(t);
  } catch {
    // Audio blocked — the picture still does the job.
  }
}

/**
 * Caught: the whole screen turns into a jump scare — the proctor's face slams
 * in at full size with a shake and a shriek — then the details and the button
 * to get back to the exam appear. One red flash only (no strobing).
 */
export function ViolationModal({
  open,
  violation,
  violationCount,
  maxViolations,
  currentQuestionNumber,
  onAcknowledge,
}: ViolationModalProps) {
  const [scaring, setScaring] = useState(false);

  useEffect(() => {
    if (!open) return;
    setScaring(true);
    playScream();
    const timer = setTimeout(() => setScaring(false), SCARE_MS);
    return () => clearTimeout(timer);
  }, [open, violationCount]);

  if (!open || !violation) return null;

  const remaining = Math.max(maxViolations - violationCount, 0);
  const isFinalWarning = remaining === 0;

  return (
    <div className="fixed inset-0 z-[100] overflow-hidden bg-black text-white">
      {/* The face, filling the screen */}
      <div className="jumpscare-shake absolute inset-0">
        <Image
          src="/hun-nae.png"
          alt="อาจารย์คุมสอบ"
          fill
          priority
          sizes="100vw"
          className={`jumpscare-face object-cover object-top ${scaring ? "" : "opacity-40 blur-[2px]"}`}
        />
      </div>
      <div className="jumpscare-flash pointer-events-none absolute inset-0 bg-red-600" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(120,0,0,0.85)_100%)]" />

      <div className="relative flex h-full flex-col items-center justify-between p-6 text-center sm:p-10">
        <h1 className="jumpscare-text mt-[6vh] text-[clamp(3rem,11vw,9rem)] font-black leading-none tracking-tight text-red-500 [text-shadow:0_0_30px_#000,0_6px_0_#000]">
          {isFinalWarning ? "จบเกม!!" : "จับได้แล้ว!!"}
        </h1>

        {!scaring && (
          <div className="w-full max-w-xl space-y-4 rounded-3xl border-2 border-red-500/70 bg-black/80 p-6 backdrop-blur-md fade-up">
            <p className="text-2xl font-black text-amber-300">👀 ฮั่นแน่ จะทำไร ฉันรู้นะ</p>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between gap-4">
                <span className="text-white/60">พฤติกรรมที่ตรวจพบ</span>
                <span className="text-right font-bold text-red-400">{VIOLATION_LABELS_TH[violation.type] || violation.type}</span>
              </div>
              {typeof currentQuestionNumber === "number" && (
                <div className="flex items-center justify-between border-t border-white/10 pt-2">
                  <span className="text-white/60">ขณะทำข้อที่</span>
                  <span className="font-mono font-bold">ข้อ {currentQuestionNumber}</span>
                </div>
              )}
              <div className="flex items-center justify-between border-t border-white/10 pt-2">
                <span className="text-white/60">ทำผิดสะสม</span>
                <span className="rounded bg-red-600 px-2 py-0.5 font-mono font-black">
                  {violationCount} / {maxViolations} ครั้ง
                </span>
              </div>
            </div>
            <p className="text-sm font-semibold text-amber-200">
              {isFinalWarning
                ? "ทำผิดกฎครบกำหนด ระบบส่งข้อสอบและรายงานอาจารย์ผู้คุมสอบแล้ว"
                : `อาจารย์เห็นแล้ว! ทำผิดอีก ${remaining} ครั้ง ระบบจะส่งข้อสอบทันที`}
            </p>
            <button
              type="button"
              onClick={onAcknowledge}
              className={`w-full rounded-2xl py-4 text-base font-black transition-transform hover:scale-[1.02] ${
                isFinalWarning ? "bg-red-600 text-white" : "bg-amber-400 text-black"
              }`}
            >
              {isFinalWarning ? "รับทราบผลการสอบ" : "ขอโทษครับ/ค่ะ จะไม่ทำอีก — กลับไปทำข้อสอบ"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
