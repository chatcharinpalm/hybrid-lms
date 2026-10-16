"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/api";

type ReviewMode = "AFTER_SUBMIT" | "AFTER_CLOSE" | "NEVER";

interface KeyQuestion {
  id: string;
  order: number;
  type: string;
  prompt: string;
  explanation: string | null;
  correct: { code: string | null; label: string } | null;
}

interface AnswerKey {
  exam: { id: string; title: string; reviewMode: ReviewMode };
  questions: KeyQuestion[];
}

const MODES: Array<{ id: ReviewMode; title: string; hint: string; icon: string }> = [
  { id: "AFTER_SUBMIT", title: "ทันทีหลังส่ง", hint: "ส่งเสร็จเห็นเลยว่าผิดข้อไหน เฉลย และคำอธิบาย", icon: "bolt" },
  { id: "AFTER_CLOSE", title: "หลังปิดห้องสอบ", hint: "เห็นคะแนนทันที แต่เฉลยแสดงเมื่อปิดห้องแล้ว (กันบอกต่อ/สอบซ้ำจำเฉลย)", icon: "lock_clock" },
  { id: "NEVER", title: "ไม่แสดงเฉลย", hint: "นักศึกษาเห็นแค่คะแนน", icon: "visibility_off" },
];

/**
 * Back office: the exam's answer key, question by question in the paper's order,
 * where the teacher writes the explanation students read when they review their
 * paper — and chooses when they may review it.
 */
export default function AnswerKeyPage() {
  const { examId } = useParams<{ examId: string }>();
  const [data, setData] = useState<AnswerKey | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<AnswerKey>(`/api/exams/${examId}/answer-key`)
      .then((d) => {
        setData(d);
        setDrafts(Object.fromEntries(d.questions.map((q) => [q.id, q.explanation ?? ""])));
      })
      .catch((err: Error) => setError(err.message));
  }, [examId]);

  const flash = (text: string) => {
    setNotice(text);
    setTimeout(() => setNotice(null), 3000);
  };

  if (error) return <p className="text-sm text-error">{error}</p>;
  if (!data) return <p className="text-sm text-on-surface-variant">กำลังโหลดเฉลย...</p>;

  const changed = data.questions.filter((q) => (q.explanation ?? "") !== (drafts[q.id] ?? ""));
  const written = data.questions.filter((q) => (drafts[q.id] ?? "").trim()).length;

  const setMode = async (reviewMode: ReviewMode) => {
    await apiFetch(`/api/exams/${examId}/settings`, { method: "PATCH", body: JSON.stringify({ reviewMode }) });
    setData({ ...data, exam: { ...data.exam, reviewMode } });
    flash("บันทึกการแสดงเฉลยแล้ว");
  };

  const save = async () => {
    setSaving(true);
    try {
      await apiFetch(`/api/exams/${examId}/explanations`, {
        method: "PUT",
        body: JSON.stringify({ items: changed.map((q) => ({ questionId: q.id, explanation: drafts[q.id] ?? "" })) }),
      });
      setData({ ...data, questions: data.questions.map((q) => ({ ...q, explanation: (drafts[q.id] ?? "").trim() || null })) });
      flash(`บันทึกคำอธิบาย ${changed.length} ข้อแล้ว`);
    } catch (err) {
      flash(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-24">
      <div>
        <Link href="/backoffice/monitor" className="inline-flex items-center gap-1 text-xs text-on-surface-variant hover:text-on-surface">
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          กลับไปหน้าคุมสอบ
        </Link>
        <h1 className="mt-2 text-xl font-bold text-on-surface">เฉลยและคำอธิบาย</h1>
        <p className="mt-0.5 text-xs text-on-surface-variant">{data.exam.title}</p>
      </div>

      {/* When students see their marked paper */}
      <section className="space-y-2">
        <h2 className="text-sm font-bold text-on-surface">นักศึกษาเห็นเฉลยเมื่อไหร่</h2>
        <div className="grid gap-2 md:grid-cols-3">
          {MODES.map((m) => {
            const active = data.exam.reviewMode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => !active && setMode(m.id)}
                className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-colors ${
                  active ? "border-primary bg-primary/10" : "border-outline-variant/30 bg-surface-container hover:bg-surface-container-high"
                }`}
              >
                <span className={`material-symbols-outlined text-xl ${active ? "text-primary" : "text-outline"}`}>{m.icon}</span>
                <span>
                  <span className={`block text-sm font-bold ${active ? "text-primary" : "text-on-surface"}`}>{m.title}</span>
                  <span className="mt-0.5 block text-[11px] leading-relaxed text-on-surface-variant">{m.hint}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-bold text-on-surface">คำอธิบายรายข้อ</h2>
          <span className="text-xs text-on-surface-variant">
            เขียนแล้ว {written}/{data.questions.length} ข้อ · ข้อที่ไม่มีคำอธิบายจะแสดงแค่เฉลย
          </span>
        </div>
        {data.questions.map((q) => (
          <div key={q.id} className="grid gap-3 rounded-xl border border-outline-variant/30 bg-surface-container p-4 lg:grid-cols-[1fr_1fr]">
            <div className="min-w-0 space-y-2">
              <p className="text-sm text-on-surface">
                <b className="mr-1.5 text-primary">ข้อ {q.order}</b>
                <span className="whitespace-pre-line">{q.prompt}</span>
              </p>
              {q.correct ? (
                <p className="inline-flex items-center gap-1.5 rounded-lg border border-secondary/40 bg-secondary/10 px-2.5 py-1 text-xs text-secondary">
                  <span className="material-symbols-outlined text-[15px]">check_circle</span>
                  เฉลย: {q.correct.code ? <b>[{q.correct.code}]</b> : null} {q.correct.label}
                </p>
              ) : (
                <p className="text-xs text-outline">{q.type === "ESSAY" ? "ข้อเขียน — อาจารย์ตรวจเอง" : "ยังไม่มีเฉลย"}</p>
              )}
            </div>
            <textarea
              value={drafts[q.id] ?? ""}
              onChange={(e) => setDrafts((d) => ({ ...d, [q.id]: e.target.value }))}
              rows={3}
              placeholder="คำอธิบายว่าทำไมคำตอบนี้ถูก (ไม่บังคับ)"
              className="w-full resize-y rounded-lg border border-outline-variant/40 bg-surface-container-lowest p-3 text-sm text-on-surface outline-none placeholder:text-outline focus:border-primary"
            />
          </div>
        ))}
      </section>

      {/* Save bar */}
      <div className="fixed bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-2xl border border-outline-variant/40 bg-surface-container-high px-4 py-2.5 shadow-2xl md:left-[calc(50%+7.5rem)]">
        <span className="text-xs text-on-surface-variant">
          {notice ?? (changed.length ? `แก้ไขแล้ว ${changed.length} ข้อ ยังไม่บันทึก` : "บันทึกครบแล้ว")}
        </span>
        <button
          type="button"
          disabled={!changed.length || saving}
          onClick={save}
          className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-on-primary disabled:opacity-40"
        >
          <span className="material-symbols-outlined text-lg">save</span>
          {saving ? "กำลังบันทึก..." : "บันทึก"}
        </button>
      </div>
    </div>
  );
}
