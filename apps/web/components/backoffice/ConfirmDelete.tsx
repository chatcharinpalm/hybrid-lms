"use client";

import { useState } from "react";

const WORD = "ลบ";

/**
 * A delete button that asks first: a dialog says what goes with it and the
 * teacher types "ลบ" to confirm, so a slip of the mouse never removes an exam
 * or a course and everyone's results with it.
 */
export function ConfirmDelete({
  title,
  consequences,
  onDelete,
  label = "ลบ",
}: {
  /** What is being deleted, e.g. the exam's name. */
  title: string;
  /** What is deleted along with it. */
  consequences: string[];
  onDelete: () => Promise<void>;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    if (busy) return;
    setOpen(false);
    setTyped("");
    setError(null);
  };
  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      await onDelete();
      setOpen(false);
      setTyped("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={`ลบ ${title}`}
        className="flex items-center gap-1 rounded-lg border border-error/40 px-2.5 py-1.5 text-xs text-error hover:bg-error/10"
      >
        <span className="material-symbols-outlined text-sm">delete</span>
        {label}
      </button>
      {open && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm" onClick={close}>
          <div
            className="w-full max-w-md space-y-4 rounded-2xl border border-outline-variant/40 bg-surface-container p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-3xl text-error">delete_forever</span>
              <div className="min-w-0">
                <h2 className="text-base font-bold text-on-surface">ลบ &quot;{title}&quot;?</h2>
                <p className="mt-1 text-xs text-on-surface-variant">ลบแล้วกู้คืนไม่ได้ สิ่งที่จะหายไปด้วย:</p>
                <ul className="mt-1 list-disc pl-5 text-xs text-on-surface-variant">
                  {consequences.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </div>
            </div>
            <label className="block space-y-1.5 text-xs text-on-surface-variant">
              พิมพ์คำว่า <b className="text-error">{WORD}</b> เพื่อยืนยัน
              <input
                autoFocus
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && typed.trim() === WORD && !busy && run()}
                className="w-full rounded border border-outline-variant/40 bg-surface-container-lowest px-3 py-2 text-sm text-on-surface outline-none focus:border-error"
              />
            </label>
            {error && <p className="rounded border border-error/30 bg-error/10 px-3 py-2 text-xs text-error">{error}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={close} className="rounded-lg bg-surface-container-highest px-4 py-2 text-sm text-on-surface">
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={typed.trim() !== WORD || busy}
                onClick={run}
                className="rounded-lg bg-error px-4 py-2 text-sm font-semibold text-on-error disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy ? "กำลังลบ..." : "ลบถาวร"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
