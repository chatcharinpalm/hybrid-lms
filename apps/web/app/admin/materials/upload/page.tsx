"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiFetch, apiUpload } from "@/lib/api";

interface Course {
  id: string;
  code: string;
  title: string;
}

const TYPE_OPTIONS = [
  { value: "SLIDE", label: "สไลด์" },
  { value: "VIDEO", label: "วิดีโอ" },
  { value: "DOCUMENT", label: "เอกสาร" },
  { value: "LINK", label: "ลิงก์" },
] as const;

export default function UploadMaterialPage() {
  const searchParams = useSearchParams();
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseId, setCourseId] = useState(searchParams.get("courseId") ?? "");
  const [title, setTitle] = useState("");
  const [type, setType] = useState<(typeof TYPE_OPTIONS)[number]["value"]>("SLIDE");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    apiFetch<Course[]>("/api/courses")
      .then((list) => {
        setCourses(list);
        if (!courseId && list[0]) setCourseId(list[0].id);
      })
      .catch((err: Error) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setStatus(null);
    const file = fileInputRef.current?.files?.[0];
    if (!courseId || !file) {
      setError("กรุณาเลือกรายวิชาและไฟล์");
      return;
    }

    const formData = new FormData();
    formData.append("title", title);
    formData.append("type", type);
    formData.append("file", file);

    setSaving(true);
    try {
      await apiUpload(`/api/courses/${courseId}/materials`, formData);
      setStatus("อัพโหลดสำเร็จ นักศึกษาจะเห็นเอกสารนี้ในหน้าคลังเอกสารทันที");
      setTitle("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "อัพโหลดไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-base font-semibold text-on-surface">อัพโหลดเอกสารประกอบการเรียน</h1>
        <p className="text-xs text-outline mt-1">รองรับสไลด์ วิดีโอ และเอกสาร — อัพโหลดใหม่ได้ตลอดเวลา</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-surface-container border border-outline-variant/30 rounded-xl p-6 space-y-4">
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
          <label className="text-xs text-on-surface-variant block mb-1">ชื่อเอกสาร</label>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Lecture 8: Stateful Firewalls"
            className="w-full px-3 py-2 rounded bg-surface-container-lowest border border-outline-variant/40 text-sm text-on-surface focus:outline-none focus:border-primary"
          />
        </div>

        <div>
          <label className="text-xs text-on-surface-variant block mb-1">ประเภท</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as typeof type)}
            className="w-full px-3 py-2 rounded bg-surface-container-lowest border border-outline-variant/40 text-sm text-on-surface focus:outline-none focus:border-primary"
          >
            {TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs text-on-surface-variant block mb-1">ไฟล์</label>
          <input
            ref={fileInputRef}
            type="file"
            required
            className="w-full text-xs text-on-surface-variant file:mr-3 file:px-3 file:py-1.5 file:rounded file:border-0 file:bg-primary file:text-on-primary file:text-xs file:font-medium file:cursor-pointer"
          />
        </div>

        {status && <p className="text-xs text-secondary">{status}</p>}
        {error && <p className="text-xs text-error">{error}</p>}

        <button
          type="submit"
          disabled={saving || !courseId}
          className="w-full py-2.5 rounded bg-primary text-on-primary font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {saving ? "กำลังอัพโหลด..." : "อัพโหลด"}
        </button>
      </form>
    </div>
  );
}
