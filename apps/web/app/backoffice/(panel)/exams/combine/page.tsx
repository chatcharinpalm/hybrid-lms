"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

interface Course {
  id: string;
  title: string;
}

interface SourceExam {
  id: string;
  title: string;
  courseId: string;
  drawJson: string | null;
  _count: { questions: number };
}

/** A chapter picked for the combined exam: how many questions each student draws from it. */
interface Pick {
  examId: string;
  count: number;
}

const field = "w-full rounded border border-outline-variant/40 bg-surface-container-lowest px-3 py-2.5 text-sm text-on-surface";

/**
 * Back office: one exam from several chapters. The teacher picks the chapters
 * (existing exams, in paper order) and how many questions each student draws
 * from each; every student gets their own draw, each chapter as a part of the
 * paper with its own Option Bank. The chapters' own exams stay as they are.
 */
export default function CombineExamPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [exams, setExams] = useState<SourceExam[] | null>(null);
  const [courseId, setCourseId] = useState("");
  const [title, setTitle] = useState("");
  const [minutes, setMinutes] = useState(90);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ id: string; title: string } | null>(null);

  useEffect(() => {
    apiFetch<Course[]>("/api/courses")
      .then(async (list) => {
        setCourses(list);
        const all = await Promise.all(list.map((c) => apiFetch<SourceExam[]>(`/api/exams/course/${c.id}`).catch(() => [])));
        // Combined exams are not offered as chapters themselves.
        setExams(all.flat().filter((e) => !e.drawJson && e._count.questions > 0));
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  const byId = new Map((exams ?? []).map((e) => [e.id, e]));
  const picked = (id: string) => picks.find((p) => p.examId === id);
  const toggle = (exam: SourceExam) =>
    setPicks((list) =>
      list.some((p) => p.examId === exam.id)
        ? list.filter((p) => p.examId !== exam.id)
        : [...list, { examId: exam.id, count: Math.min(10, exam._count.questions) }]
    );
  const setCount = (examId: string, count: number) =>
    setPicks((list) => list.map((p) => (p.examId === examId ? { ...p, count } : p)));
  const move = (i: number, by: number) =>
    setPicks((list) => {
      const next = [...list];
      const [p] = next.splice(i, 1);
      next.splice(Math.max(0, Math.min(next.length, i + by)), 0, p);
      return next;
    });

  const total = picks.reduce((n, p) => n + p.count, 0);
  const problems = [
    ...(!courseId ? ["เลือกรายวิชา"] : []),
    ...(!title.trim() ? ["ใส่ชื่อแบบทดสอบ"] : []),
    ...(picks.length < 1 ? ["เลือกอย่างน้อย 1 บท"] : []),
    ...picks.flatMap((p) => {
      const max = byId.get(p.examId)?._count.questions ?? 0;
      return p.count < 1 || p.count > max ? [`"${byId.get(p.examId)?.title}": สุ่มได้ 1–${max} ข้อ`] : [];
    }),
    ...(!(minutes > 0) ? ["ใส่เวลาสอบ"] : []),
  ];

  const save = async () => {
    if (problems.length) return;
    setSaving(true);
    setError(null);
    try {
      const exam = await apiFetch<{ id: string; title: string }>("/api/exams/combine", {
        method: "POST",
        body: JSON.stringify({ courseId, title: title.trim(), durationMinutes: minutes, sources: picks }),
      });
      setSaved(exam);
      setPicks([]);
      setTitle("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-outline-variant/30 pb-4">
        <h1 className="text-lg font-semibold text-on-surface">สร้างชุดข้อสอบรวมหลายบท</h1>
        <p className="text-xs text-outline">
          เลือกบท (แบบทดสอบที่มีอยู่) และจำนวนข้อที่จะสุ่มจากแต่ละบท นักศึกษาแต่ละคนได้ชุดข้อไม่เหมือนกัน
          แต่ละบทแยกเป็นส่วนของกระดาษพร้อมคลังตัวเลือกของบทนั้น แบบทดสอบของแต่ละบทยังอยู่เหมือนเดิม
        </p>
      </div>

      {saved && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-secondary/40 bg-secondary/10 px-5 py-4">
          <div className="text-sm text-on-surface">
            <span className="material-symbols-outlined mr-1 align-middle text-secondary">task_alt</span>
            สร้าง &quot;{saved.title}&quot; แล้ว — ห้องสอบยังปิดอยู่จนกว่าจะเปิดจากหน้าคุมสอบ
          </div>
          <Link
            href={`/backoffice/exams/${saved.id}/monitor`}
            className="rounded bg-secondary px-3 py-2 text-xs font-semibold text-on-secondary hover:opacity-90"
          >
            ไปหน้าคุมสอบ
          </Link>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-[1fr_2fr_10rem]">
        <label className="space-y-1.5">
          <span className="text-xs font-medium text-on-surface-variant">1. รายวิชา</span>
          <select value={courseId} onChange={(e) => setCourseId(e.target.value)} className={field}>
            <option value="">— เลือกรายวิชา —</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1.5">
          <span className="text-xs font-medium text-on-surface-variant">2. ชื่อแบบทดสอบ</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="เช่น สอบกลางภาค บทที่ 5–7" className={field} />
        </label>
        <label className="space-y-1.5">
          <span className="text-xs font-medium text-on-surface-variant">3. เวลาสอบ (นาที)</span>
          <input type="number" min={1} max={600} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} className={field} />
        </label>
      </div>

      <section className="space-y-2">
        <h2 className="text-xs font-medium text-on-surface-variant">4. เลือกบท</h2>
        {exams === null && <p className="text-xs text-outline">กำลังโหลด...</p>}
        {exams?.length === 0 && <p className="text-xs text-outline">ยังไม่มีแบบทดสอบให้เลือก</p>}
        <div className="divide-y divide-outline-variant/20 overflow-hidden rounded-lg border border-outline-variant/30 bg-surface-container">
          {exams?.map((exam) => {
            const on = !!picked(exam.id);
            return (
              <label key={exam.id} className={`flex cursor-pointer items-center gap-3 px-4 py-3 ${on ? "bg-primary/10" : "hover:bg-surface-container-high"}`}>
                <input type="checkbox" checked={on} onChange={() => toggle(exam)} className="h-4 w-4 accent-blue-500" />
                <span className="min-w-0 flex-1 truncate text-sm text-on-surface">{exam.title}</span>
                <span className="shrink-0 text-xs text-outline">{exam._count.questions} ข้อ</span>
              </label>
            );
          })}
        </div>
      </section>

      {picks.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-medium text-on-surface-variant">5. ลำดับบทในกระดาษ และจำนวนข้อที่สุ่มต่อคน</h2>
          <div className="divide-y divide-outline-variant/20 overflow-hidden rounded-lg border border-outline-variant/30 bg-surface-container">
            {picks.map((p, i) => {
              const exam = byId.get(p.examId);
              const max = exam?._count.questions ?? 0;
              return (
                <div key={p.examId} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <span className="w-16 shrink-0 text-xs font-bold text-primary">ส่วนที่ {i * 2 + 1}–{i * 2 + 2}</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-on-surface">{exam?.title}</span>
                  <span className="flex items-center gap-1.5 text-xs text-on-surface-variant">
                    สุ่ม
                    <input
                      type="number"
                      min={1}
                      max={max}
                      value={p.count}
                      onChange={(e) => setCount(p.examId, Number(e.target.value))}
                      className="w-16 rounded border border-outline-variant/40 bg-surface-container-lowest px-2 py-1 text-center text-sm text-on-surface"
                    />
                    จาก {max} ข้อ
                  </span>
                  <span className="flex gap-1">
                    <button type="button" disabled={i === 0} onClick={() => move(i, -1)} title="เลื่อนขึ้น" className="rounded p-1 text-outline hover:bg-surface-container-highest disabled:opacity-30">
                      <span className="material-symbols-outlined text-lg">arrow_upward</span>
                    </button>
                    <button type="button" disabled={i === picks.length - 1} onClick={() => move(i, 1)} title="เลื่อนลง" className="rounded p-1 text-outline hover:bg-surface-container-highest disabled:opacity-30">
                      <span className="material-symbols-outlined text-lg">arrow_downward</span>
                    </button>
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {error && <p className="whitespace-pre-line rounded border border-error/30 bg-error/10 px-3 py-2 text-xs text-error">{error}</p>}

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-outline-variant/30 pt-4">
        <span className="text-xs text-outline">
          {problems.length ? `ยังขาด: ${problems.join(" · ")}` : `นักศึกษาแต่ละคนได้ ${total} ข้อ จาก ${picks.length} บท`}
        </span>
        <button
          type="button"
          disabled={problems.length > 0 || saving}
          onClick={save}
          className="flex items-center gap-1.5 rounded bg-tertiary px-5 py-2.5 text-sm font-semibold text-on-tertiary hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span className="material-symbols-outlined text-lg">save</span>
          {saving ? "กำลังสร้าง..." : "สร้างชุดข้อสอบรวม"}
        </button>
      </div>
    </div>
  );
}
