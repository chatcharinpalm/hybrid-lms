"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { NetworkBackground } from "@/components/ui/NetworkBackground";

interface RegisterForm {
  firstName: string;
  lastName: string;
  studentCode: string;
  faculty: string;
  major: string;
  email: string;
  password: string;
  confirmPassword: string;
}

const EMPTY_FORM: RegisterForm = {
  firstName: "",
  lastName: "",
  studentCode: "",
  faculty: "",
  major: "",
  email: "",
  password: "",
  confirmPassword: "",
};

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState<RegisterForm>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const set = (key: keyof RegisterForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (form.password !== form.confirmPassword) {
      setError("รหัสผ่านทั้งสองช่องไม่ตรงกัน");
      return;
    }
    if (form.password.length < 8) {
      setError("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร");
      return;
    }

    setLoading(true);
    try {
      await apiFetch("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
          studentCode: form.studentCode,
          faculty: form.faculty,
          major: form.major,
          email: form.email,
          password: form.password,
        }),
      });
      router.push("/login?registered=1");
    } catch (err) {
      setError(err instanceof Error ? err.message : "สมัครสมาชิกไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-6 overflow-hidden bg-surface">
      <NetworkBackground intensity={0.7} />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at 50% 25%, transparent 0%, rgba(11,19,38,0.55) 60%, rgba(11,19,38,0.92) 100%)",
        }}
      />

      <form
        onSubmit={handleSubmit}
        className="relative z-10 w-full max-w-lg rounded-xl border border-outline-variant/40 bg-surface-container/90 backdrop-blur-md p-8 space-y-5 shadow-2xl shadow-black/40"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-secondary/20 border border-secondary/40 flex items-center justify-center text-secondary">
            <span className="material-symbols-outlined text-lg">school</span>
          </div>
          <div>
            <h1 className="text-sm font-semibold text-on-surface">สมัครสมาชิกนักเรียน/นักศึกษา</h1>
            <p className="text-[11px] text-on-surface-variant">NetSec Hub — Hybrid Learning Management System</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="ชื่อจริง" value={form.firstName} onChange={set("firstName")} required />
          <Field label="นามสกุล" value={form.lastName} onChange={set("lastName")} required />
          <Field label="รหัสนักศึกษา" value={form.studentCode} onChange={set("studentCode")} required placeholder="เช่น CPE-64-001" />
          <Field label="คณะ" value={form.faculty} onChange={set("faculty")} required placeholder="เช่น วิศวกรรมศาสตร์" />
          <div className="sm:col-span-2">
            <Field label="สาขา" value={form.major} onChange={set("major")} required placeholder="เช่น วิศวกรรมคอมพิวเตอร์" />
          </div>
          <div className="sm:col-span-2">
            <Field label="อีเมล" type="email" value={form.email} onChange={set("email")} required />
          </div>
          <Field label="รหัสผ่าน" type="password" value={form.password} onChange={set("password")} required />
          <Field label="ยืนยันรหัสผ่าน" type="password" value={form.confirmPassword} onChange={set("confirmPassword")} required />
        </div>

        {error && <p className="text-xs text-error">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 rounded bg-secondary text-on-secondary font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {loading ? "กำลังสมัครสมาชิก..." : "สมัครสมาชิก"}
        </button>

        <p className="text-center text-xs text-on-surface-variant">
          มีบัญชีอยู่แล้ว?{" "}
          <Link href="/login" className="text-primary hover:opacity-80 transition-opacity">
            เข้าสู่ระบบ
          </Link>
        </p>
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
        className="w-full px-3 py-2 rounded bg-surface-container-lowest border border-outline-variant/40 text-sm text-on-surface placeholder:text-outline/60 focus:outline-none focus:border-primary"
      />
    </div>
  );
}
