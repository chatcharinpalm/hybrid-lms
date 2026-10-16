"use client";

import { useState } from "react";
import { RoomPicker } from "./RoomPicker";

const PRESETS = [30, 45, 60, 90, 120, 180];

/**
 * Asked before a room opens: which rooms sit this exam and how many minutes
 * they get. The exam's current settings are filled in.
 */
export function OpenRoomDialog({
  examTitle,
  currentMinutes,
  rooms,
  currentRooms,
  busy,
  onCancel,
  onOpen,
}: {
  examTitle: string;
  currentMinutes: number;
  /** Rooms on the course's class list. */
  rooms: string[];
  /** Rooms set now; null = every room. */
  currentRooms: string[] | null;
  busy: boolean;
  onCancel: () => void;
  onOpen: (minutes: number, sections: string[] | null) => void;
}) {
  const [minutes, setMinutes] = useState(String(currentMinutes));
  const [sections, setSections] = useState<string[] | null>(currentRooms);
  const value = Number(minutes);
  const valid = Number.isInteger(value) && value >= 1 && value <= 600;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm" onMouseDown={onCancel}>
      <form
        onMouseDown={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (valid && !busy) onOpen(value, sections);
        }}
        className="w-full max-w-md space-y-5 rounded-2xl border border-outline-variant/40 bg-surface-container p-6 shadow-2xl"
      >
        <div className="flex items-start gap-3">
          <span className="material-symbols-outlined rounded-xl bg-secondary/15 p-2 text-2xl text-secondary">lock_open</span>
          <div>
            <h2 className="text-base font-bold text-on-surface">เปิดห้องสอบ</h2>
            <p className="mt-0.5 text-xs text-on-surface-variant">{examTitle}</p>
          </div>
        </div>

        {rooms.length > 1 && (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-on-surface">เปิดให้ห้องไหนสอบ?</p>
            <RoomPicker rooms={rooms} value={sections} onChange={setSections} size="md" />
            <p className="text-[11px] leading-relaxed text-outline">
              นักศึกษาห้องอื่นจะไม่เห็นชุดนี้และเข้าสอบไม่ได้ · หน้าคุมสอบแสดงเฉพาะห้องที่เลือก
            </p>
          </div>
        )}

        <div className="space-y-2">
          <label htmlFor="exam-minutes" className="text-sm font-semibold text-on-surface">
            ให้เวลาทำข้อสอบกี่นาที?
          </label>
          <div className="flex items-center gap-2">
            <input
              id="exam-minutes"
              autoFocus
              inputMode="numeric"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value.replace(/\D/g, "").slice(0, 3))}
              className="w-28 rounded-xl border border-outline-variant/50 bg-surface-container-lowest px-4 py-3 text-center font-mono text-2xl font-bold text-on-surface outline-none focus:border-primary"
            />
            <span className="text-sm text-on-surface-variant">นาที</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMinutes(String(m))}
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                  value === m ? "border-primary bg-primary/15 text-primary" : "border-outline-variant/40 text-on-surface-variant hover:text-on-surface"
                }`}
              >
                {m} นาที
              </button>
            ))}
          </div>
          <p className="text-[11px] leading-relaxed text-outline">
            นับเวลาแยกของนักศึกษาแต่ละคนตั้งแต่กดเริ่มทำ (เพิ่มเวลารายคนได้ภายหลังในหน้าคุมสอบ)
          </p>
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-xl px-4 py-2.5 text-sm text-on-surface-variant hover:bg-surface-container-high">
            ยกเลิก
          </button>
          <button
            type="submit"
            disabled={!valid || busy}
            className="flex items-center gap-1.5 rounded-xl bg-secondary px-5 py-2.5 text-sm font-bold text-on-secondary disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-lg">lock_open</span>
            {busy
              ? "กำลังเปิด..."
              : `เปิด${sections?.length ? ` ${sections.length} ห้อง` : "ทุกห้อง"} · ${valid ? value : "-"} นาที`}
          </button>
        </div>
      </form>
    </div>
  );
}
