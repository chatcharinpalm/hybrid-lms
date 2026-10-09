"use client";

import { Suspense, useEffect, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { isStaff, storeSession, type Role } from "@/lib/auth";
import { NetworkBackground } from "@/components/ui/NetworkBackground";

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string; fullName: string; role: Role };
}

/** Courses featured on the login page, with their instructor. */
const FEATURED_COURSE_CODES = ["020413106", "DATACOM-NET"];

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

  // Students and teachers share this page; teachers land in the back office.
  const [as, setAs] = useState<"student" | "teacher">(searchParams.get("as") === "teacher" ? "teacher" : "student");
  const [studentCode, setStudentCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const teacherMode = as === "teacher";
  const switchTo = (mode: "student" | "teacher") => {
    setAs(mode);
    setPassword("");
    setError(null);
  };
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [courses, setCourses] = useState<CourseInstructor[]>([]);

  useEffect(() => {
    Promise.all(
      FEATURED_COURSE_CODES.map((code) =>
        apiFetch<CourseInstructor>(`/api/courses/by-code/${code}/instructor`).catch(() => null)
      )
    ).then((list) => setCourses(list.filter((c): c is CourseInstructor => c !== null)));
  }, []);
  const teacher = courses[0]?.teacher;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await apiFetch<LoginResponse>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(teacherMode ? { email, password } : { studentCode, password }),
      });
      const session = {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        role: data.user.role,
        fullName: data.user.fullName,
      };
      if (teacherMode) {
        if (!isStaff(data.user.role)) {
          setError("บัญชีนี้ไม่มีสิทธิ์เข้าระบบหลังบ้าน");
          return;
        }
        // Stored as the back-office session, separate from any student session in this browser.
        storeSession(session, "backoffice");
        router.push(next && next.startsWith("/backoffice/") ? next : "/backoffice");
        return;
      }
      if (data.user.role !== "STUDENT") {
        setError("บัญชีอาจารย์ กรุณาเลือกแท็บ \"อาจารย์\"");
        return;
      }
      storeSession(session, "student");
      router.push(next && !next.startsWith("/backoffice") ? next : "/exams");
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
                src={teacher?.avatarUrl || "/teacher.png"}
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
            {teacher?.fullName ?? " "}
          </h2>
          <p className="text-xs text-primary font-medium mt-0.5">
            อาจารย์ผู้สอนประจำรายวิชา
          </p>
          <div className="mt-3 w-full space-y-2">
            {courses.map((c) => (
              <div
                key={c.code}
                className="px-3 py-2 rounded-xl bg-surface-container-lowest/80 border border-outline-variant/30 text-[11px] text-on-surface-variant leading-relaxed"
              >
                <p className="font-semibold text-on-surface">รายวิชา</p>
                <p className="text-sm text-on-surface">{c.title}</p>
              </div>
            ))}
            <p className="text-[10px] text-outline font-mono">ระบบสอบแบบมีระบบตรวจจับการทุจริตแบบเรียลไทม์</p>
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

          <div className="grid grid-cols-2 gap-1 rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-1">
            {(
              [
                { id: "student", label: "นักศึกษา", icon: "school" },
                { id: "teacher", label: "อาจารย์ / ผู้ดูแลระบบ", icon: "admin_panel_settings" },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => switchTo(t.id)}
                className={`flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-semibold transition-colors ${
                  as === t.id
                    ? t.id === "teacher"
                      ? "bg-tertiary text-on-tertiary"
                      : "bg-primary text-on-primary"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                <span className="material-symbols-outlined text-base">{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>

          {next && !teacherMode && (
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

          {teacherMode ? (
          <div className="space-y-3.5">
            <div>
              <label className="text-xs text-on-surface-variant block mb-1 font-medium">อีเมล</label>
              <input
                type="email"
                required
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container-lowest border border-outline-variant/40 text-base text-on-surface focus:outline-none focus:border-tertiary transition-colors font-mono"
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
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container-lowest border border-outline-variant/40 text-base text-on-surface focus:outline-none focus:border-tertiary transition-colors"
              />
            </div>
          </div>
          ) : (
          <div className="space-y-3.5">
            <div>
              <label className="text-xs text-on-surface-variant block mb-1 font-medium">รหัสนักศึกษา</label>
              <input
                required
                inputMode="numeric"
                autoComplete="username"
                value={studentCode}
                onChange={(e) => setStudentCode(e.target.value)}
                placeholder="68-020416-1001-0"
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container-lowest border border-outline-variant/40 text-base text-on-surface placeholder:text-outline/50 focus:outline-none focus:border-primary transition-colors font-mono"
              />
            </div>
            <div>
              <label className="text-xs text-on-surface-variant block mb-1 font-medium">
                รหัสเข้าสอบ <span className="text-outline">(ได้รับจากอาจารย์หลังเซ็นชื่อเข้าห้อง)</span>
              </label>
              <input
                required
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                maxLength={12}
                value={password}
                onChange={(e) => setPassword(e.target.value.toUpperCase())}
                placeholder="เช่น K7PX2M"
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container-lowest border border-outline-variant/40 text-lg tracking-[0.3em] text-on-surface placeholder:tracking-normal placeholder:text-sm placeholder:text-outline/50 focus:outline-none focus:border-primary transition-colors font-mono"
              />
            </div>
          </div>
          )}

          {error && (
            <div className="p-3 rounded-lg bg-error/15 border border-error/30 text-xs text-error font-medium">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-2.5 rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 shadow-md flex items-center justify-center gap-2 ${
              teacherMode ? "bg-tertiary text-on-tertiary shadow-tertiary/20" : "bg-primary text-on-primary shadow-primary/20"
            }`}
          >
            <span>{loading ? "กำลังเข้าสู่ระบบ..." : teacherMode ? "เข้าสู่ระบบหลังบ้าน" : "เข้าสู่ระบบ"}</span>
            <span className="material-symbols-outlined text-sm">login</span>
          </button>
        </form>
      </div>
    </div>
  );
}
