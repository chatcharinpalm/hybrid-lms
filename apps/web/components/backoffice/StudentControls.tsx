"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";

const QUICK_MESSAGES = [
  "ฮั่นแน่ จะทำไร ฉันรู้นะ 👀",
  "กรุณาอยู่ในหน้าจอสอบ ห้ามสลับหน้าต่าง",
  "ครูเห็นนะ ตั้งใจทำข้อสอบด้วยตัวเอง",
];

interface StudentControlsProps {
  attemptId: string;
  status: string;
  timed: boolean;
  /** Called after any successful action so the monitor reloads at once. */
  onDone: (notice: string) => void;
}

type Pending = "submit" | "reset" | null;

/** Calls a /control/* endpoint for one attempt, tracking busy/error and a pending two-click confirm. */
function useStudentControl(attemptId: string, onDone: (notice: string) => void) {
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<Pending>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (path: string, body: object, notice: string): Promise<boolean> => {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/exams/attempts/${attemptId}/control/${path}`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setConfirm(null);
      onDone(notice);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "ทำรายการไม่สำเร็จ");
      return false;
    } finally {
      setBusy(false);
    }
  };

  return { busy, confirm, setConfirm, error, run };
}

/** Full control panel (in the student detail popup). Destructive actions need a second click to confirm. */
export function StudentControls({ attemptId, status, timed, onDone }: StudentControlsProps) {
  const [message, setMessage] = useState("");
  const { busy, confirm, setConfirm, error, run } = useStudentControl(attemptId, onDone);
  const inProgress = status === "IN_PROGRESS";

  const send = (text: string) => {
    if (!text.trim()) return;
    run("message", { message: text.trim() }, "ส่งข้อความเตือนแล้ว").then((ok) => ok && setMessage(""));
  };

  const btn =
    "px-3 py-2 rounded-lg text-xs font-medium border transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5";

  return (
    <div className="space-y-4">
      {inProgress && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-on-surface flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm text-amber-400">campaign</span>
            ส่งข้อความเด้งขึ้นจอผู้สอบ
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_MESSAGES.map((q) => (
              <button
                key={q}
                type="button"
                disabled={busy}
                onClick={() => send(q)}
                className="px-2.5 py-1 rounded-full text-[11px] bg-amber-500/10 text-amber-300 border border-amber-500/30 hover:bg-amber-500/20 disabled:opacity-40"
              >
                {q}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send(message)}
              maxLength={500}
              placeholder="พิมพ์ข้อความเอง..."
              className="flex-1 px-3 py-2 rounded-lg bg-surface-container-lowest border border-outline-variant/30 text-xs text-on-surface focus:outline-none focus:border-amber-400"
            />
            <button
              type="button"
              disabled={busy || !message.trim()}
              onClick={() => send(message)}
              className={`${btn} bg-amber-500 text-black border-amber-400 hover:bg-amber-400`}
            >
              <span className="material-symbols-outlined text-sm">send</span>
              ส่ง
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <h4 className="text-xs font-bold text-on-surface flex items-center gap-1.5">
          <span className="material-symbols-outlined text-sm text-primary">tune</span>
          ควบคุมผู้สอบ
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {timed && (
            <>
              <button
                type="button"
                disabled={busy || !inProgress}
                onClick={() => run("add-time", { seconds: 60 }, "เพิ่มเวลาข้อนี้ 1 นาทีแล้ว")}
                className={`${btn} bg-surface-container-lowest text-on-surface border-outline-variant/30 hover:border-primary`}
              >
                <span className="material-symbols-outlined text-sm">more_time</span>
                +1 นาที
              </button>
              <button
                type="button"
                disabled={busy || !inProgress}
                onClick={() => run("add-time", { seconds: 300 }, "เพิ่มเวลาข้อนี้ 5 นาทีแล้ว")}
                className={`${btn} bg-surface-container-lowest text-on-surface border-outline-variant/30 hover:border-primary`}
              >
                <span className="material-symbols-outlined text-sm">more_time</span>
                +5 นาที
              </button>
            </>
          )}
          <button
            type="button"
            disabled={busy || !inProgress}
            onClick={() => run("forgive", {}, "ล้างจำนวนครั้งที่โกงเป็น 0 แล้ว")}
            className={`${btn} bg-surface-container-lowest text-secondary border-secondary/30 hover:border-secondary`}
          >
            <span className="material-symbols-outlined text-sm">healing</span>
            ล้างการโกง
          </button>
          <button
            type="button"
            disabled={busy || !inProgress}
            onClick={() =>
              confirm === "submit"
                ? run("force-submit", { reason: "ผู้คุมสอบสั่งส่ง" }, "บังคับส่งข้อสอบแล้ว")
                : setConfirm("submit")
            }
            className={`${btn} ${
              confirm === "submit"
                ? "bg-error text-white border-error"
                : "bg-surface-container-lowest text-error border-error/40 hover:border-error"
            }`}
          >
            <span className="material-symbols-outlined text-sm">gpp_bad</span>
            {confirm === "submit" ? "ยืนยันบังคับส่ง?" : "บังคับส่ง / ปรับตก"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              confirm === "reset" ? run("reset", {}, "รีเซ็ตแล้ว ผู้สอบเริ่มใหม่ได้") : setConfirm("reset")
            }
            className={`${btn} ${
              confirm === "reset"
                ? "bg-error text-white border-error"
                : "bg-surface-container-lowest text-on-surface-variant border-outline-variant/30 hover:border-error"
            }`}
          >
            <span className="material-symbols-outlined text-sm">restart_alt</span>
            {confirm === "reset" ? "ยืนยันลบและให้สอบใหม่?" : "รีเซ็ตให้สอบใหม่"}
          </button>
        </div>
        {confirm && (
          <p className="text-[11px] text-error">
            {confirm === "reset"
              ? "คำตอบ คะแนน และบันทึกการโกงของผู้สอบคนนี้จะถูกลบทั้งหมด กดอีกครั้งเพื่อยืนยัน"
              : "ระบบจะส่งข้อสอบของผู้สอบคนนี้ทันทีและให้คะแนนตามที่ตอบไว้ กดอีกครั้งเพื่อยืนยัน"}{" "}
            <button type="button" onClick={() => setConfirm(null)} className="underline text-outline">
              ยกเลิก
            </button>
          </p>
        )}
        {error && <p className="text-[11px] text-error">{error}</p>}
      </div>
    </div>
  );
}

/**
 * One-click actions shown directly on each student's row in the monitor table.
 * "ส่งเลย" and "สอบใหม่" ask for a second click before they run.
 */
export function RowActions({ attemptId, status, timed, onDone }: StudentControlsProps) {
  const { busy, confirm, setConfirm, error, run } = useStudentControl(attemptId, onDone);
  const inProgress = status === "IN_PROGRESS";
  const base =
    "px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border flex items-center gap-1 whitespace-nowrap transition-colors disabled:opacity-30 disabled:cursor-not-allowed";

  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5" onMouseLeave={() => setConfirm(null)}>
      {inProgress && (
        <>
          <button
            type="button"
            disabled={busy}
            title="ส่งข้อความ ฮั่นแน่ จะทำไร ฉันรู้นะ ไปที่จอผู้สอบ"
            onClick={() => run("message", { message: QUICK_MESSAGES[0] }, "ส่งข้อความเตือนแล้ว")}
            className={`${base} bg-amber-500/15 text-amber-300 border-amber-500/40 hover:bg-amber-500/25`}
          >
            <span className="material-symbols-outlined text-sm">campaign</span>
            เตือน
          </button>
          {timed && (
            <button
              type="button"
              disabled={busy}
              title="เพิ่มเวลาข้อปัจจุบัน 5 นาที"
              onClick={() => run("add-time", { seconds: 300 }, "เพิ่มเวลา 5 นาทีแล้ว")}
              className={`${base} bg-primary/10 text-primary border-primary/30 hover:bg-primary/20`}
            >
              <span className="material-symbols-outlined text-sm">more_time</span>
              +5 นาที
            </button>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              confirm === "submit"
                ? run("force-submit", { reason: "ผู้คุมสอบสั่งส่ง" }, "บังคับส่งข้อสอบแล้ว")
                : setConfirm("submit")
            }
            className={`${base} ${
              confirm === "submit" ? "bg-error text-white border-error" : "bg-error/10 text-error border-error/40 hover:bg-error/20"
            }`}
          >
            <span className="material-symbols-outlined text-sm">stop_circle</span>
            {confirm === "submit" ? "ยืนยัน?" : "ส่งเลย"}
          </button>
        </>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={() => (confirm === "reset" ? run("reset", {}, "รีเซ็ตแล้ว ผู้สอบเริ่มใหม่ได้") : setConfirm("reset"))}
        className={`${base} ${
          confirm === "reset"
            ? "bg-error text-white border-error"
            : "bg-surface-container-lowest text-on-surface-variant border-outline-variant/40 hover:border-error hover:text-error"
        }`}
      >
        <span className="material-symbols-outlined text-sm">restart_alt</span>
        {confirm === "reset" ? "ยืนยันลบ?" : "สอบใหม่"}
      </button>
      {error && <span className="w-full text-right text-[10px] text-error">{error}</span>}
    </div>
  );
}