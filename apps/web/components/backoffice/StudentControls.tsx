"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";

/** One click sends; grouped so the right one is quick to find. */
const QUICK_MESSAGES: Array<{ text: string; tone: "warn" | "info" }> = [
  { text: "ฮั่นแน่ จะทำไร ฉันรู้นะ 👀", tone: "warn" },
  { text: "กรุณาอยู่ในหน้าจอสอบ ห้ามสลับหน้าต่าง", tone: "warn" },
  { text: "ห้ามหันไปมองจอเพื่อน", tone: "warn" },
  { text: "ครูเห็นนะ ตั้งใจทำข้อสอบด้วยตัวเอง", tone: "warn" },
  { text: "เหลือเวลาอีก 10 นาที ตรวจคำตอบให้เรียบร้อย", tone: "info" },
  { text: "ทำเสร็จแล้วกด \"ส่งข้อสอบ\" ได้เลย", tone: "info" },
  { text: "มีปัญหายกมือเรียกอาจารย์ได้", tone: "info" },
];

/**
 * Writing a message to a student's exam screen: big one-click quick messages,
 * or type your own (Enter sends) with a preview of how it pops up for them.
 */
function MessageForm({
  busy,
  onSend,
  autoFocus,
}: {
  busy: boolean;
  /** Resolves true when sent. */
  onSend: (text: string) => Promise<boolean>;
  autoFocus?: boolean;
}) {
  const [text, setText] = useState("");
  const [sent, setSent] = useState<string | null>(null);

  const send = async (value: string) => {
    const v = value.trim();
    if (!v || busy) return;
    if (await onSend(v)) {
      setText("");
      setSent(v);
      setTimeout(() => setSent(null), 3000);
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <p className="mb-1.5 text-xs font-semibold text-on-surface-variant">กดข้อความสำเร็จรูป — ส่งทันที</p>
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {QUICK_MESSAGES.map((q) => (
            <button
              key={q.text}
              type="button"
              disabled={busy}
              onClick={() => send(q.text)}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition-colors disabled:opacity-40 ${
                q.tone === "warn"
                  ? "border-amber-500/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/25"
                  : "border-primary/30 bg-primary/10 text-on-surface hover:bg-primary/20"
              }`}
            >
              <span className="material-symbols-outlined text-base">{q.tone === "warn" ? "warning" : "info"}</span>
              <span className="flex-1">{q.text}</span>
              <span className="material-symbols-outlined text-base opacity-60">send</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-semibold text-on-surface-variant">หรือพิมพ์เอง</p>
        <div className="flex gap-2">
          <textarea
            autoFocus={autoFocus}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(text);
              }
            }}
            maxLength={500}
            rows={2}
            placeholder="พิมพ์ข้อความ แล้วกด Enter หรือปุ่มส่ง"
            className="min-w-0 flex-1 resize-none rounded-xl border border-outline-variant/40 bg-surface-container-lowest px-3 py-2.5 text-sm text-on-surface focus:border-amber-400 focus:outline-none"
          />
          <button
            type="button"
            disabled={busy || !text.trim()}
            onClick={() => send(text)}
            className="flex w-24 shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl bg-amber-500 text-sm font-bold text-black hover:bg-amber-400 disabled:opacity-40"
          >
            <span className="material-symbols-outlined">send</span>
            ส่ง
          </button>
        </div>
        {text.trim() && (
          <p className="mt-1.5 text-[11px] text-outline">
            นักศึกษาจะเห็นป๊อปอัปบนจอสอบ: <span className="text-amber-300">&ldquo;{text.trim()}&rdquo;</span>
          </p>
        )}
      </div>

      {sent && (
        <div className="flex items-center gap-2 rounded-xl border border-secondary/40 bg-secondary/15 px-3 py-2 text-sm font-semibold text-secondary">
          <span className="material-symbols-outlined text-base">check_circle</span>
          ส่งแล้ว: &ldquo;{sent}&rdquo;
        </div>
      )}
    </div>
  );
}

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
  const { busy, confirm, setConfirm, error, run } = useStudentControl(attemptId, onDone);
  const inProgress = status === "IN_PROGRESS";

  const btn =
    "px-3 py-3 rounded-xl text-sm font-semibold border transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5";

  return (
    <div className="space-y-5">
      {inProgress ? (
        <div className="space-y-2">
          <h4 className="text-sm font-bold text-on-surface flex items-center gap-1.5">
            <span className="material-symbols-outlined text-base text-amber-400">campaign</span>
            ส่งข้อความขึ้นจอนักศึกษา
          </h4>
          <MessageForm busy={busy} onSend={(text) => run("message", { message: text }, "ส่งข้อความแล้ว")} />
        </div>
      ) : (
        <p className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest px-3 py-2.5 text-xs text-on-surface-variant">
          นักศึกษาไม่ได้อยู่ในห้องสอบแล้ว จึงส่งข้อความไม่ได้ — ยังกด &ldquo;ให้สอบใหม่&rdquo; ได้
        </p>
      )}

      <div className="space-y-2">
        <h4 className="text-sm font-bold text-on-surface flex items-center gap-1.5">
          <span className="material-symbols-outlined text-base text-primary">tune</span>
          ควบคุมผู้สอบ
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {[1, 5].map((minutes) => (
            <button
              key={minutes}
              type="button"
              disabled={busy || !inProgress}
              onClick={() =>
                run("add-time", { seconds: minutes * 60 }, `เพิ่มเวลา${timed ? "ข้อนี้" : "สอบ"} ${minutes} นาทีแล้ว`)
              }
              className={`${btn} bg-surface-container-lowest text-on-surface border-outline-variant/30 hover:border-primary`}
            >
              <span className="material-symbols-outlined text-sm">more_time</span>+{minutes} นาที
            </button>
          ))}
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

/** A popup for writing a warning, with the quick messages one click away. */
function MessageComposer({
  title,
  busy,
  onSend,
  onClose,
}: {
  title: string;
  busy: boolean;
  /** Resolves true when sent; the popup closes itself shortly after. */
  onSend: (text: string) => Promise<boolean>;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        className="w-full max-w-xl space-y-4 rounded-2xl border border-amber-500/40 bg-surface-container p-6 text-left shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-2xl text-amber-400">campaign</span>
          <h3 className="flex-1 text-base font-bold text-on-surface">{title}</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-outline hover:bg-surface-container-highest hover:text-on-surface">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <MessageForm
          autoFocus
          busy={busy}
          onSend={async (text) => {
            const ok = await onSend(text);
            if (ok) setTimeout(onClose, 1200);
            return ok;
          }}
        />
      </div>
    </div>
  );
}

/**
 * Icon controls on a student's tile in the wall view: message, +5 min,
 * forgive, force submit and reset — destructive ones ask for a second click.
 */
export function TileActions({
  attemptId,
  studentName,
  status,
  timed,
  rail,
  onDone,
}: StudentControlsProps & { studentName: string; /** Compact icon grid for the side of a tile. */ rail?: boolean }) {
  const { busy, confirm, setConfirm, error, run } = useStudentControl(attemptId, onDone);
  const [composing, setComposing] = useState(false);
  const inProgress = status === "IN_PROGRESS";

  const icon = rail
    ? "relative flex h-6 w-6 items-center justify-center rounded-md border transition-colors disabled:opacity-30"
    : "flex h-7 min-w-[1.75rem] items-center justify-center gap-0.5 rounded-lg border px-1 text-[10px] font-bold transition-colors disabled:opacity-30";
  // In the rail there's no room for a "sure?" label: the armed button turns solid red and pings.
  const armedLabel = (text: string) =>
    rail ? <span className="absolute -inset-0.5 rounded-md ring-2 ring-error animate-ping" /> : text;
  const stop = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    fn();
  };

  return (
    <div
      className={rail ? "grid grid-cols-2 content-start gap-1" : "flex flex-wrap items-center gap-1"}
      onMouseLeave={() => setConfirm(null)}
      title={error ?? undefined}
    >
      {inProgress && (
        <>
          <button
            type="button"
            title="ส่งข้อความขึ้นจอ"
            disabled={busy}
            onClick={stop(() => setComposing(true))}
            className={`${icon} ${rail ? "col-span-2 !w-auto gap-0.5 px-1 text-[10px] font-bold" : ""} border-amber-500/60 bg-amber-500/25 text-amber-200 hover:bg-amber-500/40`}
          >
            <span className="material-symbols-outlined text-[16px]">chat</span>
            {rail && "ข้อความ"}
          </button>
          <button
            type="button"
            title={timed ? "เพิ่มเวลาข้อปัจจุบัน 5 นาที" : "เพิ่มเวลาสอบ 5 นาที"}
            disabled={busy}
            onClick={stop(() => run("add-time", { seconds: 300 }, "เพิ่มเวลา 5 นาทีแล้ว"))}
            className={`${icon} border-primary/30 bg-primary/10 text-primary hover:bg-primary/25`}
          >
            <span className="material-symbols-outlined text-[16px]">more_time</span>
          </button>
          <button
            type="button"
            title="ล้างจำนวนครั้งที่โกงเป็น 0"
            disabled={busy}
            onClick={stop(() => run("forgive", {}, "ล้างการโกงแล้ว"))}
            className={`${icon} border-secondary/30 bg-secondary/10 text-secondary hover:bg-secondary/25`}
          >
            <span className="material-symbols-outlined text-[16px]">healing</span>
          </button>
          <button
            type="button"
            title="บังคับส่งข้อสอบ (กดสองครั้ง)"
            disabled={busy}
            onClick={stop(() =>
              confirm === "submit"
                ? run("force-submit", { reason: "ผู้คุมสอบสั่งส่ง" }, "บังคับส่งข้อสอบแล้ว")
                : setConfirm("submit")
            )}
            className={`${icon} ${
              confirm === "submit" ? "border-error bg-error text-white" : "border-error/40 bg-error/10 text-error hover:bg-error/25"
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">stop_circle</span>
            {confirm === "submit" && armedLabel("ส่งเลย?")}
          </button>
        </>
      )}
      <button
        type="button"
        title="ลบผลและให้สอบใหม่ (กดสองครั้ง)"
        disabled={busy}
        onClick={stop(() => (confirm === "reset" ? run("reset", {}, "รีเซ็ตแล้ว ผู้สอบเริ่มใหม่ได้") : setConfirm("reset")))}
        className={`${icon} ${
          confirm === "reset"
            ? "border-error bg-error text-white"
            : "border-outline-variant/40 bg-surface-container-lowest text-on-surface-variant hover:border-error hover:text-error"
        }`}
      >
        <span className="material-symbols-outlined text-[16px]">restart_alt</span>
        {confirm === "reset" && armedLabel("ลบ?")}
      </button>
      {error &&
        (rail ? (
          <span className="col-span-2 text-center text-[10px] font-bold text-error">!</span>
        ) : (
          <span className="w-full truncate text-[10px] text-error">{error}</span>
        ))}

      {composing && (
        <MessageComposer
          title={`ส่งข้อความถึง ${studentName}`}
          busy={busy}
          onClose={() => setComposing(false)}
          onSend={(text) => run("message", { message: text }, "ส่งข้อความแล้ว")}
        />
      )}
    </div>
  );
}

/** Sends one message to every student still taking the exam. */
export function BroadcastButton({ attemptIds, onDone }: { attemptIds: string[]; onDone: (notice: string) => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const send = async (message: string) => {
    setBusy(true);
    const results = await Promise.allSettled(
      attemptIds.map((id) =>
        apiFetch(`/api/exams/attempts/${id}/control/message`, { method: "POST", body: JSON.stringify({ message }) })
      )
    );
    setBusy(false);
    const sent = results.filter((r) => r.status === "fulfilled").length;
    onDone(`ประกาศถึง ${sent}/${attemptIds.length} คนที่กำลังสอบแล้ว`);
    return sent > 0;
  };

  return (
    <>
      <button
        type="button"
        disabled={attemptIds.length === 0}
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/15 px-3 py-2 text-xs font-bold text-amber-300 hover:bg-amber-500/25 disabled:opacity-40"
      >
        <span className="material-symbols-outlined text-sm">campaign</span>
        ประกาศถึงทุกคน ({attemptIds.length})
      </button>
      {open && (
        <MessageComposer
          title={`ประกาศถึงทุกคนที่กำลังสอบ (${attemptIds.length} คน)`}
          busy={busy}
          onClose={() => setOpen(false)}
          onSend={send}
        />
      )}
    </>
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
            onClick={() => run("message", { message: QUICK_MESSAGES[0].text }, "ส่งข้อความเตือนแล้ว")}
            className={`${base} bg-amber-500/15 text-amber-300 border-amber-500/40 hover:bg-amber-500/25`}
          >
            <span className="material-symbols-outlined text-sm">campaign</span>
            เตือน
          </button>
          <button
            type="button"
            disabled={busy}
            title={timed ? "เพิ่มเวลาข้อปัจจุบัน 5 นาที" : "เพิ่มเวลาสอบ 5 นาที"}
            onClick={() => run("add-time", { seconds: 300 }, "เพิ่มเวลา 5 นาทีแล้ว")}
            className={`${base} bg-primary/10 text-primary border-primary/30 hover:bg-primary/20`}
          >
            <span className="material-symbols-outlined text-sm">more_time</span>
            +5 นาที
          </button>
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