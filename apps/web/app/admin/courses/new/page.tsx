"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

export default function NewCoursePage() {
  const router = useRouter();
  const [form, setForm] = useState({ code: "", title: "", description: "", termLabel: "" });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const course = await apiFetch<{ id: string }>("/api/courses", {
        method: "POST",
        body: JSON.stringify(form),
      });
      router.push(`/admin/materials/upload?courseId=${course.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "สร้างรายวิชาไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-base font-semibold text-on-surface">สร้างรายวิชาใหม่</h1>
        <p className="text-xs text-outline mt-1">ข้อมูลนี้จะปรากฏในหน้าเอกสารประกอบการเรียนและศูนย์สอบของนักศึกษา</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-surface-container border border-outline-variant/30 rounded-xl p-6 space-y-4">
        <Field label="รหัสวิชา" placeholder="CPE-321" value={form.code} onChange={set("code")} required />
        <Field
          label="ชื่อวิชา"
          placeholder="Network Architecture & Cyber Defense"
          value={form.title}
          onChange={set("title")}
          required
        />
        <Field label="ภาคการศึกษา" placeholder="2/2567" value={form.termLabel} onChange={set("termLabel")} />
        <div>
          <label className="text-xs text-on-surface-variant block mb-1">คำอธิบายรายวิชา</label>
          <textarea
            value={form.description}
            onChange={set("description")}
            rows={3}
            className="w-full px-3 py-2 rounded bg-surface-container-lowest border border-outline-variant/40 text-sm text-on-surface focus:outline-none focus:border-primary resize-none"
          />
        </div>

        {error && <p className="text-xs text-error">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="w-full py-2.5 rounded bg-primary text-on-primary font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {saving ? "กำลังบันทึก..." : "สร้างรายวิชา"}
        </button>
      </form>
    </div>
  );
}

function Field({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="text-xs text-on-surface-variant block mb-1">{label}</label>
      <input
        {...props}
        className="w-full px-3 py-2 rounded bg-surface-container-lowest border border-outline-variant/40 text-sm text-on-surface focus:outline-none focus:border-primary"
      />
    </div>
  );
}
