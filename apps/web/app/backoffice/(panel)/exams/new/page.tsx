"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

interface Course {
  id: string;
  code: string;
  title: string;
}

type QuestionType = "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "SHORT_ANSWER";

interface OptionDraft {
  label: string;
  isCorrect: boolean;
}

interface QuestionDraft {
  type: QuestionType;
  prompt: string;
  points: number;
  answerKey: string;
  options: OptionDraft[];
}

function emptyQuestion(): QuestionDraft {
  return {
    type: "SINGLE_CHOICE",
    prompt: "",
    points: 10,
    answerKey: "",
    options: [
      { label: "", isCorrect: true },
      { label: "", isCorrect: false },
    ],
  };
}

export default function NewExamPage() {
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseId, setCourseId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [passScorePercent, setPassScorePercent] = useState(60);
  const [maxAttempts, setMaxAttempts] = useState(1);
  const [requireFullscreen, setRequireFullscreen] = useState(true);
  const [blockClipboard, setBlockClipboard] = useState(true);
  const [blockContextMenu, setBlockContextMenu] = useState(true);
  const [maxViolations, setMaxViolations] = useState(3);
  const [shuffleQuestions, setShuffleQuestions] = useState(true);
  const [shuffleOptions, setShuffleOptions] = useState(true);
  const [questions, setQuestions] = useState<QuestionDraft[]>([emptyQuestion()]);
  const [publishNow, setPublishNow] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch<Course[]>("/api/courses")
      .then((list) => {
        setCourses(list);
        if (list[0]) setCourseId(list[0].id);
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  const updateQuestion = (index: number, patch: Partial<QuestionDraft>) => {
    setQuestions((prev) => prev.map((q, i) => (i === index ? { ...q, ...patch } : q)));
  };

  const updateOption = (qIndex: number, oIndex: number, patch: Partial<OptionDraft>) => {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIndex) return q;
        const options = q.options.map((o, j) => (j === oIndex ? { ...o, ...patch } : o));
        // Single-choice: enforce exactly one correct option.
        if (q.type === "SINGLE_CHOICE" && patch.isCorrect) {
          return { ...q, options: options.map((o, j) => ({ ...o, isCorrect: j === oIndex })) };
        }
        return { ...q, options };
      })
    );
  };

  const addQuestion = () => setQuestions((prev) => [...prev, emptyQuestion()]);
  const removeQuestion = (index: number) => setQuestions((prev) => prev.filter((_, i) => i !== index));
  const addOption = (qIndex: number) =>
    setQuestions((prev) =>
      prev.map((q, i) => (i === qIndex ? { ...q, options: [...q.options, { label: "", isCorrect: false }] } : q))
    );
  const removeOption = (qIndex: number, oIndex: number) =>
    setQuestions((prev) =>
      prev.map((q, i) => (i === qIndex ? { ...q, options: q.options.filter((_, j) => j !== oIndex) } : q))
    );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const exam = await apiFetch<{ id: string }>("/api/exams", {
        method: "POST",
        body: JSON.stringify({
          courseId,
          title,
          description,
          durationMinutes,
          passScorePercent,
          maxAttempts,
          requireFullscreen,
          blockClipboard,
          blockContextMenu,
          maxViolations,
          shuffleQuestions,
          shuffleOptions,
          questions: questions.map((q) => ({
            type: q.type,
            prompt: q.prompt,
            points: q.points,
            answerKey: q.type === "SHORT_ANSWER" ? q.answerKey : undefined,
            options: q.type === "SHORT_ANSWER" ? undefined : q.options,
          })),
        }),
      });

      if (publishNow) {
        await apiFetch(`/api/exams/${exam.id}/publish`, { method: "POST" });
      }
      router.push("/exams");
    } catch (err) {
      setError(err instanceof Error ? err.message : "สร้างข้อสอบไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl space-y-6 pb-16">
      <div>
        <h1 className="text-base font-semibold text-on-surface">สร้างแบบทดสอบ / ข้อสอบ</h1>
        <p className="text-xs text-outline mt-1">
          ตั้งค่าระบบป้องกันการทุจริต (Secure Exam Engine) และเพิ่มคำถามได้ในหน้าเดียว
        </p>
      </div>

      {/* Section: basic info */}
      <section className="bg-surface-container border border-outline-variant/30 rounded-xl p-6 space-y-4">
        <h2 className="text-sm font-semibold text-on-surface pb-2 border-b border-outline-variant/30">
          ข้อมูลทั่วไป
        </h2>

        <div>
          <label className="text-xs text-on-surface-variant block mb-1">รายวิชา</label>
          <select
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            className="w-full px-3 py-2 rounded bg-surface-container-lowest border border-outline-variant/40 text-sm text-on-surface focus:outline-none focus:border-primary"
          >
            {courses.length === 0 && <option value="">ยังไม่มีรายวิชา — สร้างรายวิชาก่อน</option>}
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} — {c.title}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs text-on-surface-variant block mb-1">ชื่อข้อสอบ</label>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="การสอบปฏิบัติการกลางภาค: Network Hardening"
            className="w-full px-3 py-2 rounded bg-surface-container-lowest border border-outline-variant/40 text-sm text-on-surface focus:outline-none focus:border-primary"
          />
        </div>

        <div>
          <label className="text-xs text-on-surface-variant block mb-1">คำอธิบาย</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 rounded bg-surface-container-lowest border border-outline-variant/40 text-sm text-on-surface focus:outline-none focus:border-primary resize-none"
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <NumberField label="เวลาสอบ (นาที)" value={durationMinutes} onChange={setDurationMinutes} min={1} />
          <NumberField label="เกณฑ์ผ่าน (%)" value={passScorePercent} onChange={setPassScorePercent} min={0} max={100} />
          <NumberField label="สิทธิ์สอบ (ครั้ง)" value={maxAttempts} onChange={setMaxAttempts} min={1} />
        </div>
      </section>

      {/* Section: lockdown config */}
      <section className="bg-surface-container border border-outline-variant/30 rounded-xl p-6 space-y-4">
        <h2 className="text-sm font-semibold text-on-surface pb-2 border-b border-outline-variant/30">
          Secure Exam Engine (ระบบป้องกันการทุจริต)
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ToggleField label="บังคับโหมดเต็มหน้าจอ" checked={requireFullscreen} onChange={setRequireFullscreen} />
          <ToggleField label="บล็อกคัดลอก/วาง" checked={blockClipboard} onChange={setBlockClipboard} />
          <ToggleField label="บล็อกคลิกขวา" checked={blockContextMenu} onChange={setBlockContextMenu} />
          <ToggleField label="สุ่มลำดับคำถาม" checked={shuffleQuestions} onChange={setShuffleQuestions} />
          <ToggleField label="สุ่มลำดับตัวเลือก" checked={shuffleOptions} onChange={setShuffleOptions} />
        </div>
        <NumberField
          label="จำนวนครั้งที่ทำผิดกฎก่อนส่งข้อสอบอัตโนมัติ"
          value={maxViolations}
          onChange={setMaxViolations}
          min={1}
        />
      </section>

      {/* Section: questions */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-on-surface">คำถาม ({questions.length})</h2>
          <button
            type="button"
            onClick={addQuestion}
            className="px-3 py-1.5 rounded bg-surface-container-high border border-outline-variant/40 text-on-surface text-xs font-medium hover:bg-surface-bright transition-colors flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            เพิ่มคำถาม
          </button>
        </div>

        {questions.map((q, qIndex) => (
          <div key={qIndex} className="bg-surface-container border border-outline-variant/30 rounded-xl p-5 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <span className="text-xs font-mono text-outline shrink-0 pt-2">Q{qIndex + 1}</span>
              <div className="flex-1 space-y-3">
                <textarea
                  required
                  value={q.prompt}
                  onChange={(e) => updateQuestion(qIndex, { prompt: e.target.value })}
                  placeholder="โจทย์คำถาม..."
                  rows={2}
                  className="w-full px-3 py-2 rounded bg-surface-container-lowest border border-outline-variant/40 text-sm text-on-surface focus:outline-none focus:border-primary resize-none"
                />
                <div className="flex flex-wrap items-center gap-3">
                  <select
                    value={q.type}
                    onChange={(e) => updateQuestion(qIndex, { type: e.target.value as QuestionType })}
                    className="px-2 py-1.5 rounded bg-surface-container-lowest border border-outline-variant/40 text-xs text-on-surface focus:outline-none focus:border-primary"
                  >
                    <option value="SINGLE_CHOICE">เลือกตอบข้อเดียว</option>
                    <option value="MULTIPLE_CHOICE">เลือกตอบหลายข้อ</option>
                    <option value="SHORT_ANSWER">คำตอบสั้น / Flag</option>
                  </select>
                  <NumberField label="" compact value={q.points} onChange={(v) => updateQuestion(qIndex, { points: v })} min={1} suffix="pts" />
                  <button
                    type="button"
                    onClick={() => removeQuestion(qIndex)}
                    className="ml-auto text-xs text-error hover:opacity-80 flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-sm">delete</span>
                    ลบคำถาม
                  </button>
                </div>

                {q.type === "SHORT_ANSWER" ? (
                  <input
                    required
                    value={q.answerKey}
                    onChange={(e) => updateQuestion(qIndex, { answerKey: e.target.value })}
                    placeholder="เฉลย (เช่น flag{...})"
                    className="w-full px-3 py-2 rounded bg-surface-container-lowest border border-outline-variant/40 font-mono text-xs text-on-surface focus:outline-none focus:border-primary"
                  />
                ) : (
                  <div className="space-y-2">
                    {q.options.map((opt, oIndex) => (
                      <div key={oIndex} className="flex items-center gap-2">
                        <input
                          type={q.type === "SINGLE_CHOICE" ? "radio" : "checkbox"}
                          name={`correct-${qIndex}`}
                          checked={opt.isCorrect}
                          onChange={(e) => updateOption(qIndex, oIndex, { isCorrect: e.target.checked })}
                          className="accent-primary shrink-0"
                          title="ตัวเลือกที่ถูกต้อง"
                        />
                        <input
                          required
                          value={opt.label}
                          onChange={(e) => updateOption(qIndex, oIndex, { label: e.target.value })}
                          placeholder={`ตัวเลือกที่ ${oIndex + 1}`}
                          className="flex-1 px-3 py-1.5 rounded bg-surface-container-lowest border border-outline-variant/40 text-xs text-on-surface focus:outline-none focus:border-primary"
                        />
                        {q.options.length > 2 && (
                          <button
                            type="button"
                            onClick={() => removeOption(qIndex, oIndex)}
                            className="text-outline hover:text-error transition-colors"
                          >
                            <span className="material-symbols-outlined text-base">close</span>
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => addOption(qIndex)}
                      className="text-xs text-primary hover:opacity-80 flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-sm">add</span>
                      เพิ่มตัวเลือก
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </section>

      {error && <p className="text-xs text-error">{error}</p>}

      <div className="flex items-center gap-4 sticky bottom-0 bg-surface/95 backdrop-blur border-t border-outline-variant/30 py-4">
        <ToggleField label="เผยแพร่ทันที (เปิดให้สอบ)" checked={publishNow} onChange={setPublishNow} />
        <button
          type="submit"
          disabled={saving || !courseId}
          className="ml-auto px-5 py-2.5 rounded bg-primary text-on-primary font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {saving ? "กำลังบันทึก..." : "บันทึกข้อสอบ"}
        </button>
      </div>
    </form>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  suffix,
  compact,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  suffix?: string;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "flex items-center gap-1.5" : undefined}>
      {label && <label className="text-xs text-on-surface-variant block mb-1">{label}</label>}
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          onChange={(e) => onChange(Number(e.target.value))}
          className={`px-3 py-1.5 rounded bg-surface-container-lowest border border-outline-variant/40 text-sm text-on-surface focus:outline-none focus:border-primary ${
            compact ? "w-20" : "w-full"
          }`}
        />
        {suffix && <span className="text-[11px] text-outline font-mono">{suffix}</span>}
      </div>
    </div>
  );
}

function ToggleField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2.5 px-3 py-2 rounded border border-outline-variant/30 bg-surface-container-lowest text-xs text-on-surface cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-primary" />
      {label}
    </label>
  );
}
