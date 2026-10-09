"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

interface SheetRow {
  number: number;
  paperNumber: number | null;
  prompt: string;
  chosen: { code: string | null; label: string } | null;
  correct: { code: string | null; label: string } | null;
  isCorrect: boolean | null;
}
interface Sheet {
  total: number;
  answered: number;
  scorePoints: number | null;
  rows: SheetRow[];
}

/**
 * One student's answers for marking: what they wrote (their code and its words —
 * codes differ per student, so the words are what count) next to the right answer.
 */
export function AnswerSheet({ attemptId, refreshKey }: { attemptId: string; refreshKey?: unknown }) {
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [wrongOnly, setWrongOnly] = useState(false);

  useEffect(() => {
    apiFetch<Sheet>(`/api/exams/attempts/${attemptId}/answer-sheet`)
      .then((s) => {
        setSheet(s);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "โหลดคำตอบไม่สำเร็จ"));
  }, [attemptId, refreshKey]);

  if (error) return <p className="text-xs text-error">{error}</p>;
  if (!sheet) return <p className="text-xs text-outline">กำลังโหลดคำตอบ...</p>;

  const right = sheet.rows.filter((r) => r.isCorrect).length;
  const rows = wrongOnly ? sheet.rows.filter((r) => r.isCorrect !== true) : sheet.rows;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-lg bg-surface-container-lowest px-2.5 py-1 text-on-surface-variant">
          ตอบแล้ว <b className="text-on-surface">{sheet.answered}</b>/{sheet.total}
        </span>
        <span className="rounded-lg bg-secondary/15 px-2.5 py-1 text-secondary">
          ถูก <b>{right}</b>
        </span>
        <span className="rounded-lg bg-error/15 px-2.5 py-1 text-error">
          ผิด <b>{sheet.rows.filter((r) => r.isCorrect === false).length}</b>
        </span>
        <label className="ml-auto flex cursor-pointer items-center gap-1.5 text-on-surface-variant">
          <input type="checkbox" checked={wrongOnly} onChange={(e) => setWrongOnly(e.target.checked)} />
          ดูเฉพาะข้อที่ผิด/ยังไม่ตอบ
        </label>
      </div>
      <div className="max-h-[420px] overflow-y-auto rounded-xl border border-outline-variant/30">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-surface-container-highest text-[11px] text-outline">
            <tr>
              <th className="px-2 py-2 text-center">ข้อ</th>
              <th className="px-2 py-2">คำถาม</th>
              <th className="px-2 py-2">นักศึกษาตอบ</th>
              <th className="px-2 py-2">คำตอบที่ถูก</th>
              <th className="px-2 py-2 text-center">ผล</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/20">
            {rows.map((r) => (
              <tr key={r.number} className={r.isCorrect === false ? "bg-error/5" : ""}>
                <td className="px-2 py-2 text-center font-mono text-on-surface-variant" title="ข้อในกระดาษต้นฉบับ">
                  {r.number}
                  {r.paperNumber !== null && <div className="text-[10px] text-outline">(ต้นฉบับ {r.paperNumber})</div>}
                </td>
                <td className="max-w-[260px] px-2 py-2 text-on-surface-variant">
                  <span className="line-clamp-2" title={r.prompt}>
                    {r.prompt}
                  </span>
                </td>
                <td className="px-2 py-2 text-on-surface">
                  {r.chosen ? (
                    <>
                      <span className="mr-1 rounded bg-surface-container-highest px-1 font-mono text-[11px]">{r.chosen.code}</span>
                      {r.chosen.label}
                    </>
                  ) : (
                    <span className="text-outline">— ยังไม่ตอบ —</span>
                  )}
                </td>
                <td className="px-2 py-2 text-on-surface-variant">{r.correct?.label ?? "-"}</td>
                <td className="px-2 py-2 text-center text-base">
                  {r.isCorrect === true ? (
                    <span className="text-secondary">✓</span>
                  ) : r.isCorrect === false ? (
                    <span className="text-error">✗</span>
                  ) : (
                    <span className="text-outline">·</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
