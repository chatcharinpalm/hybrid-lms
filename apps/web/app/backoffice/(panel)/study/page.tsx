"use client";

import { useEffect, useState } from "react";
import { apiFetch, apiUpload } from "@/lib/api";
import { importChapter } from "@/lib/study/importChapter";

interface Course {
  id: string;
  code: string;
  title: string;
}

interface ChapterRow {
  id: string;
  number: number;
  title: string;
  published: boolean;
  _count: { sections: number; questions: number; worksheets: number };
}

interface ChapterFull {
  id: string;
  number: number;
  title: string;
  sections: { title: string; blocks: unknown[] }[];
  questions: { text: string; choices: unknown[]; answerIndex: number; explanation: string | null }[];
  worksheets: { title: string; blocks: unknown[]; answers: unknown[] | null }[];
}

const EXAMPLE_CONTENT = `{
  "sections": [
    { "title": "1. หัวข้อ", "blocks": [ { "type": "text", "text": "เนื้อหา..." } ] }
  ],
  "questions": [
    { "text": "คำถาม?", "choices": [ { "label": "ก.", "text": "ตัวเลือก 1" }, { "label": "ข.", "text": "ตัวเลือก 2" } ], "answerIndex": 1, "explanation": "คำอธิบาย" }
  ],
  "worksheets": [
    { "title": "ใบงานที่ 1", "blocks": [ { "type": "text", "text": "โจทย์..." } ], "answers": [ { "type": "text", "text": "เฉลย..." } ] }
  ]
}`;

/** Lessons for review (ทบทวนบทเรียน). Separate from the exam centre. */
export default function BackofficeStudyPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseId, setCourseId] = useState<string>("");
  const [chapters, setChapters] = useState<ChapterRow[]>([]);
  const [newNumber, setNewNumber] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [json, setJson] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [importNumber, setImportNumber] = useState("");
  const [importTitle, setImportTitle] = useState("");
  const [lessonFile, setLessonFile] = useState<File | undefined>();
  const [quizFile, setQuizFile] = useState<File | undefined>();
  const [worksheetFile, setWorksheetFile] = useState<File | undefined>();
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Course[]>("/api/courses")
      .then((list) => {
        setCourses(list);
        if (list[0]) setCourseId(list[0].id);
      })
      .catch(() => setMessage("โหลดรายวิชาไม่สำเร็จ"));
  }, []);

  async function loadChapters(id: string) {
    setChapters(await apiFetch<ChapterRow[]>(`/api/study/courses/${id}/chapters`));
  }

  useEffect(() => {
    if (courseId) loadChapters(courseId).catch(() => setMessage("โหลดบทเรียนไม่สำเร็จ"));
    setEditingId(null);
  }, [courseId]);

  async function createChapter() {
    setMessage(null);
    try {
      await apiFetch(`/api/study/courses/${courseId}/chapters`, {
        method: "POST",
        body: JSON.stringify({ number: Number(newNumber), title: newTitle }),
      });
      setNewNumber("");
      setNewTitle("");
      await loadChapters(courseId);
      setMessage("สร้างบทเรียนแล้ว (ยังไม่เผยแพร่)");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "สร้างบทเรียนไม่สำเร็จ");
    }
  }

  async function togglePublished(ch: ChapterRow) {
    await apiFetch(`/api/study/chapters/${ch.id}`, {
      method: "PATCH",
      body: JSON.stringify({ published: !ch.published }),
    });
    await loadChapters(courseId);
  }

  async function removeChapter(ch: ChapterRow) {
    if (!window.confirm(`ลบบทที่ ${ch.number} ${ch.title} พร้อมหัวข้อ แบบทดสอบ และใบงานทั้งหมด?`)) return;
    await apiFetch(`/api/study/chapters/${ch.id}`, { method: "DELETE" });
    await loadChapters(courseId);
  }

  async function openEditor(ch: ChapterRow) {
    setMessage(null);
    const full = await apiFetch<ChapterFull>(`/api/study/chapters/${ch.id}`);
    setJson(
      JSON.stringify(
        {
          sections: full.sections.map((s) => ({ title: s.title, blocks: s.blocks })),
          questions: full.questions.map((q) => ({
            text: q.text,
            choices: q.choices,
            answerIndex: q.answerIndex,
            explanation: q.explanation,
          })),
          worksheets: full.worksheets.map((w) => ({ title: w.title, blocks: w.blocks, answers: w.answers })),
        },
        null,
        2
      )
    );
    setEditingId(ch.id);
  }

  async function saveContent() {
    if (!editingId) return;
    setMessage(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      setMessage("รูปแบบ JSON ไม่ถูกต้อง ตรวจเครื่องหมายจุลภาคและวงเล็บ");
      return;
    }
    try {
      const res = await apiFetch<{ sections: number; questions: number; worksheets: number }>(
        `/api/study/chapters/${editingId}/content`,
        { method: "PUT", body: JSON.stringify(parsed) }
      );
      setMessage(`บันทึกแล้ว: ${res.sections} หัวข้อ, ${res.questions} ข้อทบทวน, ${res.worksheets} ใบงาน`);
      await loadChapters(courseId);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    }
  }

  async function runImport() {
    const number = Number(importNumber);
    if (!courseId || !Number.isInteger(number) || number < 1 || (!lessonFile && !quizFile && !worksheetFile)) return;
    setImporting(true);
    setMessage(null);
    setProgress("เริ่มนำเข้า...");
    try {
      const res = await importChapter({
        courseId,
        number,
        title: importTitle.trim() || `บทที่ ${number}`,
        lesson: lessonFile,
        quiz: quizFile,
        worksheet: worksheetFile,
        onProgress: setProgress,
      });
      const warn = res.warnings.length ? ` (${res.warnings.join("; ")})` : "";
      setMessage(
        `นำเข้าบทที่ ${number} แล้ว: ${res.sections} หัวข้อ, ${res.pictures} รูป, ${res.questions} ข้อทบทวน, ${res.worksheets} ใบงาน${warn} — ยังเป็นฉบับร่าง นักศึกษายังไม่เห็น`
      );
      await loadChapters(courseId);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "นำเข้าไม่สำเร็จ");
    } finally {
      setImporting(false);
      setProgress(null);
    }
  }

  async function uploadPicture(file: File | undefined) {
    if (!file) return;
    setMessage(null);
    setUploadedUrl(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await apiUpload<{ url: string }>("/api/study/media", form);
      setUploadedUrl(res.url);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "อัปโหลดรูปไม่สำเร็จ");
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-base font-semibold text-on-surface">บทเรียนทบทวน</h1>
        <p className="text-xs text-outline">
          นักศึกษาเข้าดูได้จากเมนู "ทบทวนบทเรียน" เมื่อเผยแพร่แล้ว ไม่เกี่ยวกับห้องสอบ
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-xs text-outline" htmlFor="study-course">
          รายวิชา
        </label>
        <select
          id="study-course"
          value={courseId}
          onChange={(e) => setCourseId(e.target.value)}
          className="rounded-md border border-outline-variant/40 bg-surface px-2 py-1 text-sm text-on-surface"
        >
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </div>

      {message && <p className="text-sm text-on-surface-variant">{message}</p>}

      <div className="rounded-lg border border-outline-variant/30 divide-y divide-outline-variant/20 overflow-hidden">
        {chapters.length === 0 && <p className="px-4 py-3 text-xs text-outline">ยังไม่มีบทเรียนทบทวนในวิชานี้</p>}
        {chapters.map((ch) => (
          <div key={ch.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="text-sm text-on-surface">
                บทที่ {ch.number} {ch.title}
              </p>
              <p className="text-xs text-outline">
                {ch._count.sections} หัวข้อ · {ch._count.questions} ข้อทบทวน · {ch._count.worksheets} ใบงาน ·{" "}
                {ch.published ? "เผยแพร่แล้ว" : "ฉบับร่าง (นักศึกษายังไม่เห็น)"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => openEditor(ch)} className="rounded-md border border-outline-variant/40 px-3 py-1 text-xs text-on-surface hover:bg-surface-container-low">
                แก้ไขเนื้อหา
              </button>
              <button type="button" onClick={() => togglePublished(ch)} className="rounded-md border border-outline-variant/40 px-3 py-1 text-xs text-on-surface hover:bg-surface-container-low">
                {ch.published ? "ซ่อนจากนักศึกษา" : "เผยแพร่"}
              </button>
              <button type="button" onClick={() => removeChapter(ch)} className="rounded-md border border-error/40 px-3 py-1 text-xs text-error hover:bg-error/10">
                ลบ
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-outline-variant/30 p-4 space-y-3">
        <h2 className="text-sm font-semibold text-on-surface">เพิ่มบทใหม่</h2>
        <div className="flex flex-wrap gap-2">
          <input
            aria-label="หมายเลขบท"
            inputMode="numeric"
            placeholder="บทที่"
            value={newNumber}
            onChange={(e) => setNewNumber(e.target.value)}
            className="w-20 rounded-md border border-outline-variant/40 bg-surface px-2 py-1 text-sm"
          />
          <input
            aria-label="ชื่อบท"
            placeholder="ชื่อบท"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="min-w-[16rem] flex-1 rounded-md border border-outline-variant/40 bg-surface px-2 py-1 text-sm"
          />
          <button
            type="button"
            onClick={createChapter}
            disabled={!newNumber || !newTitle || !courseId}
            className="rounded-md bg-primary px-3 py-1 text-xs text-on-primary disabled:opacity-50"
          >
            สร้าง
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-outline-variant/30 p-4 space-y-3">
        <h2 className="text-sm font-semibold text-on-surface">นำเข้าจากไฟล์ Word</h2>
        <p className="text-xs text-outline">
          เลือกไฟล์ของบทนั้น รูปในไฟล์จะถูกอัปโหลดให้อัตโนมัติ นำเข้าเป็นฉบับร่างก่อน ตรวจแล้วค่อยกดเผยแพร่
        </p>
        <div className="flex flex-wrap gap-2">
          <input
            aria-label="หมายเลขบท"
            inputMode="numeric"
            placeholder="บทที่"
            value={importNumber}
            onChange={(e) => setImportNumber(e.target.value)}
            className="w-20 rounded-md border border-outline-variant/40 bg-surface px-2 py-1 text-sm"
          />
          <input
            aria-label="ชื่อบทสำหรับนำเข้า"
            placeholder="ชื่อบท (ถ้าเป็นบทใหม่)"
            value={importTitle}
            onChange={(e) => setImportTitle(e.target.value)}
            className="min-w-[16rem] flex-1 rounded-md border border-outline-variant/40 bg-surface px-2 py-1 text-sm"
          />
        </div>
        <div className="grid gap-2 text-xs text-on-surface sm:grid-cols-3">
          <label className="space-y-1 rounded-md border border-outline-variant/30 p-3">
            <span className="block text-sm font-semibold text-on-surface">บทเรียน</span>
            <span className="block text-outline">ไฟล์ใบเนื้อหา (.docx) → หัวข้อและรูปประกอบ</span>
            <input type="file" accept=".docx" onChange={(e) => setLessonFile(e.target.files?.[0])} />
            {lessonFile && <span className="block text-primary">{lessonFile.name}</span>}
          </label>
          <label className="space-y-1 rounded-md border border-outline-variant/30 p-3">
            <span className="block text-sm font-semibold text-on-surface">ชุดข้อสอบทบทวน</span>
            <span className="block text-outline">ไฟล์ชุดข้อสอบ (.docx) → ข้อปรนัยพร้อมเฉลย และข้ออัตนัย</span>
            <input type="file" accept=".docx" onChange={(e) => setQuizFile(e.target.files?.[0])} />
            {quizFile && <span className="block text-primary">{quizFile.name}</span>}
          </label>
          <label className="space-y-1 rounded-md border border-outline-variant/30 p-3">
            <span className="block text-sm font-semibold text-on-surface">ใบงาน</span>
            <span className="block text-outline">ไฟล์ใบงาน (.docx) → โจทย์และรูปประกอบ</span>
            <input type="file" accept=".docx" onChange={(e) => setWorksheetFile(e.target.files?.[0])} />
            {worksheetFile && <span className="block text-primary">{worksheetFile.name}</span>}
          </label>
        </div>
        <p className="text-xs text-outline">
          เลือกเฉพาะไฟล์ที่ต้องการนำเข้า ส่วนที่ไม่ได้เลือกจะคงเดิม
        </p>
        <button
          type="button"
          onClick={runImport}
          disabled={importing || !courseId || !importNumber || (!lessonFile && !quizFile && !worksheetFile)}
          className="rounded-md bg-primary px-3 py-1 text-xs text-on-primary disabled:opacity-50"
        >
          {importing ? progress ?? "กำลังนำเข้า..." : "นำเข้า"}
        </button>
      </div>

      <div className="rounded-lg border border-outline-variant/30 p-4 space-y-3">
        <h2 className="text-sm font-semibold text-on-surface">อัปโหลดรูปประกอบบทเรียน</h2>
        <p className="text-xs text-outline">
          อัปโหลดแล้วได้ลิงก์รูป คัดลอกไปใส่ในบล็อก {"{ \"type\": \"image\", \"url\": \"...\" }"} ของ JSON ด้านล่าง
        </p>
        <input type="file" accept="image/*" onChange={(e) => uploadPicture(e.target.files?.[0])} className="text-xs" />
        {uploadedUrl && (
          <p className="break-all text-xs text-on-surface">
            ลิงก์รูป: <code>{uploadedUrl}</code>
          </p>
        )}
      </div>

      {editingId && (
        <div className="rounded-lg border border-outline-variant/30 p-4 space-y-3">
          <h2 className="text-sm font-semibold text-on-surface">แก้ไขเนื้อหา (JSON)</h2>
          <p className="text-xs text-outline">
            ใช้โครงสร้าง sections / questions / worksheets ตัวอย่าง: <code className="whitespace-pre">{EXAMPLE_CONTENT.split("\n")[0]}</code>
          </p>
          <textarea
            aria-label="เนื้อหาบทเรียน JSON"
            value={json}
            onChange={(e) => setJson(e.target.value)}
            spellCheck={false}
            className="h-96 w-full rounded-md border border-outline-variant/40 bg-surface p-3 font-mono text-xs text-on-surface"
          />
          <div className="flex gap-2">
            <button type="button" onClick={saveContent} className="rounded-md bg-primary px-3 py-1 text-xs text-on-primary">
              บันทึกเนื้อหา
            </button>
            <button type="button" onClick={() => setEditingId(null)} className="rounded-md border border-outline-variant/40 px-3 py-1 text-xs text-on-surface">
              ปิด
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
