"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { NetworkBackground } from "@/components/ui/NetworkBackground";

interface LoginResponse {
  accessToken: string;
  user: { id: string; email: string; fullName: string; role: "ADMIN" | "TEACHER" | "STUDENT" };
}

type LoginTab = "STUDENT" | "STAFF";

const TAB_COPY: Record<LoginTab, { title: string; hint: string; icon: string; demoEmail: string }> = {
  STUDENT: {
    title: "เข้าสู่ระบบสำหรับนักเรียน",
    hint: "เข้าดูบทเรียน เช็คชื่อ และเข้าสอบ",
    icon: "school",
    demoEmail: "student@netsechub.dev",
  },
  STAFF: {
    title: "เข้าสู่ระบบสำหรับอาจารย์ / ผู้ดูแลระบบ",
    hint: "จัดการรายวิชา ข้อสอบ และเอกสารประกอบการเรียน",
    icon: "admin_panel_settings",
    demoEmail: "teacher@netsechub.dev",
  },
};

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const justRegistered = searchParams.get("registered") === "1";

  const [tab, setTab] = useState<LoginTab>("STUDENT");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const copy = TAB_COPY[tab];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await apiFetch<LoginResponse>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      window.localStorage.setItem("accessToken", data.accessToken);
      window.localStorage.setItem("role", data.user.role);
      window.localStorage.setItem("fullName", data.user.fullName);

      // `next` (a specific page the user was trying to reach, e.g. an exam
      // lobby) always wins; otherwise land on the right home for the
      // account's *actual* role, regardless of which tab was selected.
      const destination = next || (data.user.role === "STUDENT" ? "/dashboard" : "/admin");
      router.push(destination);
    } catch (err) {
      setError(err instanceof Error ? err.message : "เข้าสู่ระบบไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-6 overflow-hidden bg-surface">
      <NetworkBackground />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at 50% 35%, transparent 0%, rgba(11,19,38,0.55) 60%, rgba(11,19,38,0.92) 100%)",
        }}
      />

      <form
        onSubmit={handleSubmit}
        className="relative z-10 w-full max-w-sm rounded-xl border border-outline-variant/40 bg-surface-container/90 backdrop-blur-md p-8 space-y-5 shadow-2xl shadow-black/40"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary-container flex items-center justify-center text-on-primary-container font-mono font-bold text-xs">
            LMS
          </div>
          <div>
            <h1 className="text-sm font-semibold text-on-surface">NetSec Hub</h1>
            <p className="text-[11px] text-on-surface-variant">Hybrid Learning Management System</p>
          </div>
        </div>

        {/* Role tabs */}
        <div className="grid grid-cols-2 gap-1.5 p-1 rounded-lg bg-surface-container-lowest border border-outline-variant/30">
          {(Object.keys(TAB_COPY) as LoginTab[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-medium transition-colors ${
                tab === key
                  ? "bg-primary text-on-primary shadow-sm"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              <span className="material-symbols-outlined text-base">{TAB_COPY[key].icon}</span>
              {key === "STUDENT" ? "นักเรียน" : "อาจารย์"}
            </button>
          ))}
        </div>

        <div>
          <p className="text-xs font-semibold text-on-surface">{copy.title}</p>
          <p className="text-[11px] text-on-surface-variant mt-0.5">{copy.hint}</p>
        </div>

        {next && (
          <p className="text-xs text-on-surface-variant bg-surface-container-lowest border border-outline-variant/30 rounded p-2.5">
            กรุณาเข้าสู่ระบบเพื่อดำเนินการต่อ
          </p>
        )}

        {justRegistered && (
          <p className="text-xs text-secondary bg-secondary/10 border border-secondary/30 rounded p-2.5 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm">check_circle</span>
            สมัครสมาชิกสำเร็จ กรุณาเข้าสู่ระบบ
          </p>
        )}

        <div className="space-y-3">
          <div>
            <label className="text-xs text-on-surface-variant block mb-1">อีเมล</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={copy.demoEmail}
              className="w-full px-3 py-2 rounded bg-surface-container-lowest border border-outline-variant/40 text-sm text-on-surface placeholder:text-outline/60 focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="text-xs text-on-surface-variant block mb-1">รหัสผ่าน</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 rounded bg-surface-container-lowest border border-outline-variant/40 text-sm text-on-surface focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        {error && <p className="text-xs text-error">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 rounded bg-primary text-on-primary font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
        </button>

        {tab === "STUDENT" && (
          <Link
            href="/register"
            className="block w-full text-center py-2.5 rounded border border-secondary/40 text-secondary font-semibold text-sm hover:bg-secondary/10 transition-colors"
          >
            สมัครสมาชิกนักเรียน/นักศึกษา
          </Link>
        )}

        <a
          href="/dashboard"
          className="block text-center text-xs text-on-surface-variant hover:text-on-surface transition-colors"
        >
          กลับไปดูหน้าเว็บโดยไม่เข้าสู่ระบบ
        </a>
      </form>
    </div>
  );
}
