"use client";

import { Suspense, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { storeSession, type Role } from "@/lib/auth";
import { NetworkBackground } from "@/components/ui/NetworkBackground";

interface LoginResponse {
  accessToken: string;
  user: { id: string; email: string; fullName: string; role: Role };
}

/** Course whose instructor is featured on the login page. */
const FEATURED_COURSE_CODE = "CPE-321";

interface CourseInstructor {
  code: string;
  title: string;
  teacher: { fullName: string; avatarUrl: string | null };
}


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

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [course, setCourse] = useState<CourseInstructor | null>(null);

  useEffect(() => {
    apiFetch<CourseInstructor>(`/api/courses/by-code/${FEATURED_COURSE_CODE}/instructor`)
      .then(setCourse)
      .catch(() => undefined);
  }, []);

  const handleQuickLogin = (quickEmail: string, quickPass: string = "Password123!") => {
    setEmail(quickEmail);
    setPassword(quickPass);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await apiFetch<LoginResponse>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      // Staff sign in through the separate back office, never here.
      if (data.user.role !== "STUDENT") {
        setError("บัญชีนี้ไม่ใช่บัญชีนักเรียน");
        return;
      }
      storeSession({ accessToken: data.accessToken, role: data.user.role, fullName: data.user.fullName });
      router.push(next || "/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "เข้าสู่ระบบไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 sm:p-6 overflow-hidden bg-surface">
      <NetworkBackground />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at 50% 35%, transparent 0%, rgba(11,19,38,0.65) 60%, rgba(11,19,38,0.95) 100%)",
        }}
      />

      <div className="relative z-10 w-full max-w-4xl grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
        {/* Left Side: Instructor Profile & Course Banner */}
        <div className="md:col-span-5 bg-surface-container/85 border border-outline-variant/40 rounded-2xl p-6 backdrop-blur-md shadow-2xl flex flex-col items-center text-center">
          <div className="relative mb-4 group">
            <div className="w-32 h-32 sm:w-36 sm:h-36 rounded-2xl overflow-hidden border-2 border-primary/50 shadow-xl shadow-primary/10 relative mx-auto bg-surface-container-lowest">
              <Image
                src={course?.teacher.avatarUrl || "/teacher.png"}
                alt="อาจารย์ผู้สอน"
                width={200}
                height={200}
                className="object-cover w-full h-full object-top group-hover:scale-105 transition-transform duration-300"
                priority
              />
            </div>
            <div className="absolute -bottom-2 inset-x-0 mx-auto w-max px-3 py-0.5 rounded-full text-[11px] font-bold tracking-wide uppercase bg-primary text-on-primary shadow-md">
              INSTRUCTOR
            </div>
          </div>

          <h2 className="text-base font-bold text-on-surface mt-2">
            {course?.teacher.fullName ?? " "}
          </h2>
          <p className="text-xs text-primary font-medium mt-0.5">
            อาจารย์ผู้สอนประจำรายวิชา
          </p>
          <div className="mt-3 px-3 py-2 rounded-xl bg-surface-container-lowest/80 border border-outline-variant/30 text-[11px] text-on-surface-variant leading-relaxed">
            <p className="font-semibold text-on-surface">รายวิชา {course?.code ?? FEATURED_COURSE_CODE}</p>
            <p>{course?.title ?? "Microprocessor & System Bus Architecture"}</p>
            <p className="text-[10px] text-outline mt-1 font-mono">ระบบสอบแบบมีระบบตรวจจับการทุจริตแบบเรียลไทม์</p>
          </div>

          {/* Quick Demo Logins Helper */}
          <div className="w-full mt-4 pt-3 border-t border-outline-variant/30 space-y-1.5 text-left">
            <p className="text-[10px] uppercase tracking-wider text-outline font-bold">
              ⚡ บัญชีทดสอบด่วน (คลิกเพื่อกรอก):
            </p>
            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => handleQuickLogin("student01@netsechub.dev")}
                className="px-2.5 py-1.5 rounded-lg bg-surface-container-lowest border border-outline-variant/30 hover:border-secondary/50 text-[11px] text-on-surface-variant hover:text-on-surface flex items-center justify-between transition-colors"
              >
                <span>🎓 นักศึกษา 01 (Student)</span>
                <span className="font-mono text-[10px] text-secondary">student01@netsechub.dev</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Side: Login Form */}
        <form
          onSubmit={handleSubmit}
          className="md:col-span-7 rounded-2xl border border-outline-variant/40 bg-surface-container/90 backdrop-blur-md p-6 sm:p-8 space-y-5 shadow-2xl shadow-black/40"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-container flex items-center justify-center text-on-primary-container font-mono font-bold text-xs">
              LMS
            </div>
            <div>
              <h1 className="text-base font-semibold text-on-surface">ระบบการเรียนการสอนและทดสอบออนไลน์</h1>
              <p className="text-xs text-on-surface-variant">Hybrid Learning & Secure Exam System</p>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-on-surface">เข้าสู่ระบบสำหรับนักเรียน/นักศึกษา</p>
            <p className="text-[11px] text-on-surface-variant mt-0.5">เข้าดูบทเรียน เช็คชื่อ และเข้าทำแบบทดสอบ</p>
          </div>

          {next && (
            <p className="text-xs text-on-surface-variant bg-surface-container-lowest border border-outline-variant/30 rounded-lg p-2.5">
              กรุณาเข้าสู่ระบบเพื่อเข้าสู่ห้องสอบ
            </p>
          )}

          {justRegistered && (
            <p className="text-xs text-secondary bg-secondary/10 border border-secondary/30 rounded-lg p-2.5 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm">check_circle</span>
              สมัครสมาชิกสำเร็จ กรุณาเข้าสู่ระบบ
            </p>
          )}

          <div className="space-y-3.5">
            <div>
              <label className="text-xs text-on-surface-variant block mb-1 font-medium">อีเมล (Email)</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="student01@netsechub.dev"
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container-lowest border border-outline-variant/40 text-sm text-on-surface placeholder:text-outline/60 focus:outline-none focus:border-primary transition-colors font-mono"
              />
            </div>
            <div>
              <label className="text-xs text-on-surface-variant block mb-1 font-medium">รหัสผ่าน (Password)</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container-lowest border border-outline-variant/40 text-sm text-on-surface focus:outline-none focus:border-primary transition-colors font-mono"
              />
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-error/15 border border-error/30 text-xs text-error font-medium">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-primary text-on-primary font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 shadow-md shadow-primary/20 flex items-center justify-center gap-2"
          >
            <span>{loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}</span>
            <span className="material-symbols-outlined text-sm">login</span>
          </button>

          <Link
            href="/register"
            className="block w-full text-center py-2.5 rounded-xl border border-secondary/40 text-secondary font-semibold text-xs hover:bg-secondary/10 transition-colors"
          >
            สมัครสมาชิกนักศึกษาใหม่ (Self Registration)
          </Link>

          <div className="flex items-center justify-between text-xs text-on-surface-variant pt-2">
            <Link
              href="/dashboard"
              className="hover:text-on-surface transition-colors"
            >
              ← ดูหน้าบทเรียนทั่วไป
            </Link>
            <span className="text-[11px] text-outline">
              รหัสผ่านเริ่มต้น: Password123!
            </span>
          </div>
        </form>
      </div>
    </div>
  );
}
