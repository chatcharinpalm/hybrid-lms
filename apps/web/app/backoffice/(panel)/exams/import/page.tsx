"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { importDocument, markerLabel, type Draft, type DraftQuestion, type QType } from "@/lib/docImport";
import { DocumentPaper, type QuestionBlock } from "@/components/exam/DocumentPaper";

interface Course {
  id: string;
  code: string;
  title: string;
}

const TYPE_LABELS: Record<QType, string> = {
  SINGLE_CHOICE: "ปรนัย (เลือกตอบ)",
  SHORT_ANSWER: "เติมคำ (พิมพ์คำตอบ)",
  FILL_IN_BANK: "เติมรหัสจากคลังตัวเลือก",
  ESSAY: "อัตนัย (เขียนตอบ)",
};

/** Does this question still need an answer key? */
function needsKey(q: DraftQuestion) {
  if (q.type === "SINGLE_CHOICE") return q.options.filter((o) => o.label.trim()).length < 2 || !q.options.some((o) => o.isCorrect && o.label.trim());
  if (q.type === "FILL_IN_BANK") return !q.bankAnswer;
  if (q.type === "SHORT_ANSWER") return !q.answerKey.trim();
  return false;
}

/**
 * Back office: upload any exam document (Word or PDF). The exam keeps the
 * document's own layout; the system finds its questions (choices, blanks,
 * true/false, essays) and answer key, the teacher checks and fixes them
 * beside each question, then saves it as an exam of the chosen course.
 */
export default function ImportExamPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseId, setCourseId] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ id: string; title: string } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    apiFetch<Course[]>("/api/courses")
      .then(setCourses)
      .catch((err: Error) => setError(err.message));
  }, []);

  const readFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setSaved(null);
    setParsing(true);
    setFileName(file.name);
    try {
      const parsed = await importDocument(file);
      setDraft(parsed);
      if (!courseId) {
        const hay = `${file.name} ${parsed.title}`.toLowerCase();
        const match = courses.find((c) => hay.includes(c.title.toLowerCase()) || hay.includes(c.code.toLowerCase()));
        if (match) setCourseId(match.id);
      }
    } catch (err) {
      setDraft(null);
      setError((err as Error).message);
    } finally {
      setParsing(false);
    }
  };

  const setQuestion = (key: string, patch: Partial<DraftQuestion>) =>
    setDraft((d) => d && { ...d, questions: d.questions.map((q) => (q.key === key ? { ...q, ...patch } : q)) });

  const removeBlock = (block: QuestionBlock) =>
    setDraft(
      (d) =>
        d && {
          ...d,
          blocks: d.blocks.filter((b) => b !== block),
          questions: d.questions.filter((q) => !block.slots.includes(q.key)),
        }
    );

  const byKey = new Map(draft?.questions.map((q) => [q.key, q]) ?? []);
  const qBlocks = (draft?.blocks.filter((b) => b.t === "q") ?? []) as QuestionBlock[];
  const missingKeys = qBlocks.filter((b) => b.slots.some((s) => byKey.get(s) && needsKey(byKey.get(s)!)));

  const problems = draft
    ? [
        ...(!courseId ? ["เลือกรายวิชา"] : []),
        ...(!draft.title.trim() ? ["ใส่ชื่อแบบทดสอบ"] : []),
        ...(qBlocks.length === 0 ? ["ไม่มีข้อสอบ"] : []),
        ...missingKeys.map((b) => `ข้อ ${b.num}: ใส่เฉลย`),
      ]
    : [];

  const save = async () => {
    if (!draft || problems.length) return;
    setSaving(true);
    setError(null);
    try {
      const exam = await apiFetch<{ id: string; title: string }>("/api/exams/import-document", {
        method: "POST",
        body: JSON.stringify({
          courseId,
          title: draft.title.trim(),
          durationMinutes: draft.durationMinutes,
          blocks: draft.blocks,
          questions: draft.questions.map((q) => ({
            key: q.key,
            type: q.type,
            prompt: q.prompt,
            points: q.type === "ESSAY" ? 0 : q.points,
            answerKey: q.answerKey.trim() || undefined,
            options:
              q.type === "SINGLE_CHOICE"
                ? q.options.filter((o) => o.label.trim()).map((o) => ({ label: o.label.trim(), isCorrect: o.isCorrect }))
                : q.type === "FILL_IN_BANK"
                  ? draft.bank.map((b) => ({ label: b.label, code: b.code, isCorrect: b.code === q.bankAnswer }))
                  : [],
          })),
        }),
      });
      setSaved(exam);
      setDraft(null);
      setFileName(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const inlineIn = (block: QuestionBlock, key: string) => block.html.includes(`data-slot="${key}"`);

  return (
    <div className="space-y-6">
      <div className="border-b border-outline-variant/30 pb-4">
        <h1 className="text-lg font-semibold text-on-surface">นำเข้าข้อสอบจากเอกสาร</h1>
        <p className="text-xs text-outline">
          ใช้ไฟล์ข้อสอบเดิมได้เลย (Word .docx หรือ PDF) ไม่ต้องปรับรูปแบบ — นักศึกษาจะเห็นหน้าตาตามเอกสาร
          ระบบหาข้อสอบ ตัวเลือก ช่องว่าง ถูก/ผิด ข้อเขียน และเฉลยให้เอง ตรวจทานด้านขวาของแต่ละข้อก่อนบันทึก
        </p>
      </div>

      {saved && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-secondary/40 bg-secondary/10 px-5 py-4">
          <div className="text-sm text-on-surface">
            <span className="material-symbols-outlined mr-1 align-middle text-secondary">task_alt</span>
            บันทึก &quot;{saved.title}&quot; แล้ว — ห้องสอบยังปิดอยู่จนกว่าจะเปิดจากหน้าคุมสอบ
          </div>
          <Link
            href={`/backoffice/exams/${saved.id}/monitor`}
            className="rounded bg-secondary px-3 py-2 text-xs font-semibold text-on-secondary hover:opacity-90"
          >
            ไปหน้าคุมสอบ
          </Link>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-[1fr_2fr]">
        <label className="space-y-1.5">
          <span className="text-xs font-medium text-on-surface-variant">1. รายวิชา</span>
          <select
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            className="w-full rounded border border-outline-variant/40 bg-surface-container-lowest px-3 py-2.5 text-sm text-on-surface"
          >
            <option value="">— เลือกรายวิชา —</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </label>

        <div className="space-y-1.5">
          <span className="text-xs font-medium text-on-surface-variant">2. ไฟล์ข้อสอบ (Word หรือ PDF)</span>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              readFile(e.dataTransfer.files[0]);
            }}
            className={`flex w-full items-center gap-3 rounded border-2 border-dashed px-4 py-3 text-left text-sm transition-colors ${
              dragOver ? "border-tertiary bg-tertiary/10" : "border-outline-variant/50 hover:border-tertiary/60"
            }`}
          >
            <span className="material-symbols-outlined text-2xl text-tertiary">description</span>
            <span className="flex-1 truncate text-on-surface">
              {parsing ? "กำลังอ่านไฟล์..." : fileName ?? "ลากไฟล์มาวาง หรือคลิกเพื่อเลือกไฟล์"}
            </span>
            {fileName && <span className="text-xs text-outline">เลือกไฟล์ใหม่</span>}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".docx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            onChange={(e) => {
              readFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      {error && <p className="whitespace-pre-line rounded border border-error/30 bg-error/10 px-3 py-2 text-xs text-error">{error}</p>}

      {draft && (
        <>
          <div className="grid gap-4 md:grid-cols-[1fr_160px]">
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-on-surface-variant">ชื่อแบบทดสอบ</span>
              <input
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                className="w-full rounded border border-outline-variant/40 bg-surface-container-lowest px-3 py-2.5 text-sm text-on-surface"
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-on-surface-variant">เวลาทำ (นาที)</span>
              <input
                type="number"
                min={1}
                value={draft.durationMinutes}
                onChange={(e) => setDraft({ ...draft, durationMinutes: Math.max(1, Number(e.target.value) || 1) })}
                className="w-full rounded border border-outline-variant/40 bg-surface-container-lowest px-3 py-2.5 text-sm text-on-surface"
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-3 text-xs">
            <Stat icon="quiz" label="ข้อสอบ" value={qBlocks.length} />
            {(Object.keys(TYPE_LABELS) as QType[]).map((t) => {
              const n = draft.questions.filter((q) => q.type === t).length;
              return n > 0 ? <Stat key={t} icon="label" label={TYPE_LABELS[t]} value={n} /> : null;
            })}
            {draft.bank.length > 0 && <Stat icon="list_alt" label="คลังตัวเลือก" value={draft.bank.length} />}
            <Stat icon="key" label="มีเฉลยแล้ว" value={`${qBlocks.length - missingKeys.length}/${qBlocks.length}`} />
          </div>

          {draft.warnings.length > 0 && (
            <ul className="space-y-1 rounded border border-tertiary/30 bg-tertiary/10 px-4 py-3 text-xs text-tertiary">
              {draft.warnings.map((w, i) => (
                <li key={i}>• {w}</li>
              ))}
            </ul>
          )}

          <p className="text-xs text-outline">
            ตัวอย่างด้านล่างคือหน้าตาที่นักศึกษาจะเห็น (ระบบสลับลำดับข้อและตัวเลือกให้แต่ละคนตอนสอบจริง)
          </p>

          <div className="rounded-lg bg-white p-6 shadow-inner sm:p-10">
            <DocumentPaper
              blocks={draft.blocks}
              bank={draft.bank}
              renderSlot={(key) => {
                const q = byKey.get(key);
                return (
                  <span className="mx-1 inline-block min-w-[5em] border-b-2 border-dotted border-slate-500 px-1 text-center text-sm font-bold text-emerald-700">
                    {q?.type === "FILL_IN_BANK" ? q.bankAnswer ?? "?" : q?.type === "SHORT_ANSWER" ? q.answerKey || "?" : ""}
                  </span>
                );
              }}
              renderBelow={(block) =>
                block.slots
                  .filter((key) => !inlineIn(block, key))
                  .map((key) => {
                    const q = byKey.get(key);
                    if (!q) return null;
                    if (q.type === "ESSAY")
                      return <div key={key} className="mt-1 h-16 rounded border border-dashed border-slate-400 bg-slate-50" />;
                    if (q.type !== "SINGLE_CHOICE") return null;
                    return (
                      <div key={key} className="mt-1 grid gap-x-6 sm:grid-cols-2">
                        {q.options.map((o, i) => (
                          <div key={i} className={o.isCorrect ? "font-bold text-emerald-700" : ""}>
                            {block.fixedOptions || block.marker ? markerLabel(block.marker, i) : "○"} {o.label}
                            {o.isCorrect && " ✓"}
                          </div>
                        ))}
                      </div>
                    );
                  })
              }
              renderAside={(block) => (
                <QuestionEditor
                  block={block}
                  questions={block.slots.map((s) => byKey.get(s)!).filter(Boolean)}
                  bank={draft.bank}
                  inline={(key) => inlineIn(block, key)}
                  onChange={setQuestion}
                  onRemove={() => removeBlock(block)}
                />
              )}
            />
          </div>

          <div className="sticky bottom-0 -mx-6 flex flex-wrap items-center justify-end gap-3 border-t border-outline-variant/30 bg-surface/95 px-6 py-4 backdrop-blur">
            {problems.length > 0 && (
              <span className="mr-auto text-xs text-tertiary">
                ยังต้องแก้ {problems.length} จุด: {problems.slice(0, 4).join(", ")}
                {problems.length > 4 ? " ..." : ""}
              </span>
            )}
            <button
              type="button"
              disabled={problems.length > 0 || saving}
              onClick={save}
              className="flex items-center gap-1.5 rounded bg-tertiary px-5 py-2.5 text-sm font-semibold text-on-tertiary hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span className="material-symbols-outlined text-lg">save</span>
              {saving ? "กำลังบันทึก..." : "บันทึกเป็นแบบทดสอบ"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/** Beside each question: what kind it is, and its answer. */
function QuestionEditor({
  block,
  questions,
  bank,
  inline,
  onChange,
  onRemove,
}: {
  block: QuestionBlock;
  questions: DraftQuestion[];
  bank: Draft["bank"];
  inline: (key: string) => boolean;
  onChange: (key: string, patch: Partial<DraftQuestion>) => void;
  onRemove: () => void;
}) {
  const input = "w-full rounded border border-slate-300 bg-white px-2 py-1.5 font-sans text-sm text-slate-900";
  return (
    <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 font-sans text-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500">ข้อ {block.num}</span>
        <button type="button" title="ไม่ใช่ข้อสอบ / ลบข้อนี้" onClick={onRemove} className="text-slate-400 hover:text-red-600">
          <span className="material-symbols-outlined text-lg">delete</span>
        </button>
      </div>
      {questions.map((q, qi) => {
        // A blank in the text can be typed in or take a bank code; a question without one is chosen or written.
        const types: QType[] = inline(q.key) ? ["SHORT_ANSWER", ...(bank.length ? (["FILL_IN_BANK"] as QType[]) : [])] : ["SINGLE_CHOICE", "ESSAY"];
        const missing = needsKey(q);
        return (
          <div key={q.key} className={`space-y-2 ${qi > 0 ? "border-t border-slate-200 pt-2" : ""}`}>
            {questions.length > 1 && <div className="text-xs text-slate-500">ช่องที่ {qi + 1}</div>}
            <div className="flex gap-2">
              <select
                value={q.type}
                onChange={(e) => {
                  const type = e.target.value as QType;
                  onChange(q.key, {
                    type,
                    options: type === "SINGLE_CHOICE" && q.options.length < 2 ? [{ label: "", isCorrect: false }, { label: "", isCorrect: false }] : q.options,
                  });
                }}
                className={input}
              >
                {types.map((t) => (
                  <option key={t} value={t}>
                    {TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
              {q.type !== "ESSAY" && (
                <label className="flex shrink-0 items-center gap-1 text-xs text-slate-500">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={q.points}
                    onChange={(e) => onChange(q.key, { points: Math.max(0, Number(e.target.value) || 0) })}
                    className="w-14 rounded border border-slate-300 bg-white px-1.5 py-1.5 text-sm text-slate-900"
                  />
                  คะแนน
                </label>
              )}
            </div>

            {q.type === "SINGLE_CHOICE" && (
              <div className="space-y-1">
                {q.options.map((o, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <input
                      type="radio"
                      name={`correct-${q.key}`}
                      checked={o.isCorrect}
                      title="คำตอบที่ถูก"
                      onChange={() => onChange(q.key, { options: q.options.map((x, j) => ({ ...x, isCorrect: j === i })) })}
                      className="accent-emerald-600"
                    />
                    <span className="w-7 shrink-0 text-xs text-slate-500">{markerLabel(block.marker, i)}</span>
                    <input
                      value={o.label}
                      onChange={(e) => onChange(q.key, { options: q.options.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })}
                      className={`${input} ${o.isCorrect ? "border-emerald-500" : ""}`}
                    />
                    <button
                      type="button"
                      onClick={() => onChange(q.key, { options: q.options.filter((_, j) => j !== i) })}
                      className="text-slate-400 hover:text-red-600"
                    >
                      <span className="material-symbols-outlined text-base">close</span>
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => onChange(q.key, { options: [...q.options, { label: "", isCorrect: false }] })}
                  className="text-xs text-blue-700 hover:underline"
                >
                  + เพิ่มตัวเลือก
                </button>
              </div>
            )}

            {q.type === "FILL_IN_BANK" && (
              <select value={q.bankAnswer ?? ""} onChange={(e) => onChange(q.key, { bankAnswer: e.target.value || null })} className={input}>
                <option value="">— เลือกเฉลย —</option>
                {bank.map((b) => (
                  <option key={b.code} value={b.code}>
                    [{b.code}] {b.label}
                  </option>
                ))}
              </select>
            )}

            {q.type === "SHORT_ANSWER" && (
              <input
                value={q.answerKey}
                placeholder="เฉลย (หลายคำตอบที่ถูก คั่นด้วย | )"
                onChange={(e) => onChange(q.key, { answerKey: e.target.value })}
                className={input}
              />
            )}

            {q.type === "ESSAY" && <p className="text-xs text-slate-500">ข้อเขียน: นักศึกษาพิมพ์คำตอบ อาจารย์อ่านในหน้าคุมสอบ (ไม่นับคะแนนอัตโนมัติ)</p>}

            {missing && <p className="text-xs font-medium text-amber-700">ยังไม่มีเฉลย</p>}
          </div>
        );
      })}
    </div>
  );
}

function Stat({ icon, label, value }: { icon: string; label: string; value: React.ReactNode }) {
  return (
    <span className="flex items-center gap-2 rounded border border-outline-variant/30 bg-surface-container px-3 py-2 text-on-surface-variant">
      <span className="material-symbols-outlined text-base text-tertiary">{icon}</span>
      {label} <b className="text-on-surface">{value}</b>
    </span>
  );
}
