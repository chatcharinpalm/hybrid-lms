"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { isStaff, storeSession, type Role } from "@/lib/auth";

interface LoginResponse {
  accessToken: string;
  user: { id: string; email: string; fullName: string; role: Role };
}

export default function BackofficeLoginPage() {
  return (
    <Suspense fallback={null}>
      <BackofficeLoginForm />
    </Suspense>
  );
}

function BackofficeLoginForm() {
  const router = useRouter();
  const next = useSearchParams().get("next");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await apiFetch<LoginResponse>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      if (!isStaff(data.user.role)) {
        setError("บัญชีนี้ไม่มีสิทธิ์เข้าระบบหลังบ้าน");
        return;
      }
      storeSession({ accessToken: data.accessToken, role: data.user.role, fullName: data.user.fullName });
      router.push(next && next.startsWith("/backoffice") && next !== "/backoffice/login" ? next : "/backoffice");
    } catch (err) {
      setError(err instanceof Error ? err.message : "เข้าสู่ระบบไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-surface-container-lowest">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl border border-tertiary/30 bg-surface-container p-7 space-y-5 shadow-2xl shadow-black/40"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-tertiary/15 border border-tertiary/40 flex items-center justify-center text-tertiary">
            <span className="material-symbols-outlined">admin_panel_settings</span>
          </div>
          <div>
            <h1 className="text-base font-semibold text-on-surface">ระบบหลังบ้าน (Back Office)</h1>
            <p className="text-xs text-on-surface-variant">สำหรับอาจารย์และผู้ดูแลระบบเท่านั้น</p>
          </div>
        </div>

        <div className="space-y-3.5">
          <div>
            <label className="text-xs text-on-surface-variant block mb-1 font-medium">อีเมล</label>
            <input
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container-lowest border border-outline-variant/40 text-sm text-on-surface focus:outline-none focus:border-tertiary transition-colors font-mono"
            />
          </div>
          <div>
            <label className="text-xs text-on-surface-variant block mb-1 font-medium">รหัสผ่าน</label>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container-lowest border border-outline-variant/40 text-sm text-on-surface focus:outline-none focus:border-tertiary transition-colors font-mono"
            />
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-error/15 border border-error/30 text-xs text-error font-medium">{error}</div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 rounded-xl bg-tertiary text-on-tertiary font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <span>{loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบหลังบ้าน"}</span>
          <span className="material-symbols-outlined text-sm">login</span>
        </button>
      </form>
    </div>
  );
}
