"use client";

import { Suspense, useEffect, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { isStaff, storeSession, type Role } from "@/lib/auth";

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

/** Dark graphite with brushed-gold accents. */
const GOLD = "from-[#e2c08d] via-[#c9a063] to-[#a77b43]";
const field =
  "w-full rounded-xl border border-white/10 bg-black/30 py-3 pl-11 pr-4 text-[15px] text-white placeholder:text-white/25 outline-none transition-colors focus:border-[#c9a063]/70 focus:bg-black/40";
const fieldIcon = "material-symbols-outlined pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-xl text-white/35";
/** A faint blueprint grid. */
const BLUEPRINT = {
  backgroundImage:
    "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)",
  backgroundSize: "88px 88px, 88px 88px, 22px 22px, 22px 22px",
};

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

/**
 * One sign-in page for students and teachers: the form on the left, and on the
 * right the course's instructor with the department, faculty and university.
 */
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
  const [showPassword, setShowPassword] = useState(false);
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
    <div
      className="min-h-screen bg-[#09090a] p-3 sm:p-5"
      style={{ backgroundImage: "radial-gradient(ellipse at 15% 0%, rgba(201,160,99,0.10), transparent 55%)" }}
    >
      <div className="mx-auto grid min-h-[calc(100vh-1.5rem)] max-w-[1280px] items-center gap-5 sm:min-h-[calc(100vh-2.5rem)] lg:grid-cols-[1fr_1.05fr]">
        {/* Left: the sign-in form, on a dark card with a gold edge */}
        <div className="relative mx-auto w-full max-w-[480px] overflow-hidden rounded-[26px] border border-white/10 bg-gradient-to-b from-[#1c1c1e] to-[#0e0e0f] px-6 py-9 shadow-2xl shadow-black/70 sm:px-10">
          <div className={`pointer-events-none absolute inset-y-10 left-0 w-px bg-gradient-to-b from-transparent ${GOLD.split(" ")[1]} to-transparent`} />
          <div className="pointer-events-none absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-[#c9a063]/50 to-transparent" />

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="flex flex-col items-center text-center">
              <div className={`rounded-full bg-gradient-to-br ${GOLD} p-[2px] shadow-lg shadow-[#c9a063]/20`}>
                <Image src="/brand/ce-logo.png" alt="ภาควิชาคอมพิวเตอร์ศึกษา" width={64} height={64} className="h-16 w-16 rounded-full bg-white" />
              </div>
              <h1 className="mt-4 text-[26px] font-bold leading-tight text-white">ยินดีต้อนรับ</h1>
              <p className="mt-1 text-[13px] text-white/45">ระบบการเรียนการสอนและทดสอบออนไลน์</p>
            </div>

            <div className="grid grid-cols-2 gap-1 rounded-xl border border-white/10 bg-black/30 p-1">
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
                    as === t.id ? `bg-gradient-to-r ${GOLD} text-[#1a140b] shadow-md shadow-[#c9a063]/20` : "text-white/45 hover:text-white"
                  }`}
                >
                  <span className="material-symbols-outlined text-base">{t.icon}</span>
                  {t.label}
                </button>
              ))}
            </div>

            <p className="text-center text-[13px] text-white/45">
              {teacherMode
                ? "เข้าสู่ระบบหลังบ้านเพื่อจัดการข้อสอบและคุมสอบ"
                : "เข้าสู่ระบบด้วยรหัสนักศึกษาและรหัสเข้าสอบที่ได้รับจากอาจารย์"}
            </p>

            {next && !teacherMode && (
              <p className="rounded-lg border border-white/10 bg-black/30 p-2.5 text-xs text-white/60">กรุณาเข้าสู่ระบบเพื่อเข้าสู่ห้องสอบ</p>
            )}
            {justRegistered && (
              <p className="flex items-center gap-1.5 rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-2.5 text-xs text-emerald-300">
                <span className="material-symbols-outlined text-sm">check_circle</span>
                สมัครสมาชิกสำเร็จ กรุณาเข้าสู่ระบบ
              </p>
            )}

            {teacherMode ? (
              <div className="space-y-4">
                <label className="block space-y-1.5">
                  <span className="text-[13px] font-medium text-white/80">อีเมล</span>
                  <span className="relative block">
                    <span className={fieldIcon}>mail</span>
                    <input
                      type="email"
                      required
                      autoComplete="username"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className={field}
                    />
                  </span>
                </label>
                <label className="block space-y-1.5">
                  <span className="text-[13px] font-medium text-white/80">รหัสผ่าน</span>
                  <span className="relative block">
                    <span className={fieldIcon}>lock</span>
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="กรอกรหัสผ่าน"
                      className={`${field} pr-12`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/35 hover:text-white"
                    >
                      <span className="material-symbols-outlined text-xl">{showPassword ? "visibility" : "visibility_off"}</span>
                    </button>
                  </span>
                </label>
              </div>
            ) : (
              <div className="space-y-4">
                <label className="block space-y-1.5">
                  <span className="text-[13px] font-medium text-white/80">รหัสนักศึกษา</span>
                  <span className="relative block">
                    <span className={fieldIcon}>badge</span>
                    <input
                      required
                      inputMode="numeric"
                      autoComplete="username"
                      value={studentCode}
                      onChange={(e) => setStudentCode(e.target.value)}
                      placeholder="68-020416-1001-0"
                      className={`${field} font-mono`}
                    />
                  </span>
                </label>
                <label className="block space-y-1.5">
                  <span className="text-[13px] font-medium text-white/80">
                    รหัสเข้าสอบ <span className="font-normal text-white/35">(ได้รับจากอาจารย์หลังเซ็นชื่อเข้าห้อง)</span>
                  </span>
                  <span className="relative block">
                    <span className={fieldIcon}>lock</span>
                    <input
                      required
                      autoComplete="off"
                      autoCapitalize="characters"
                      spellCheck={false}
                      maxLength={12}
                      value={password}
                      onChange={(e) => setPassword(e.target.value.toUpperCase())}
                      placeholder="เช่น K7PX2M"
                      className={`${field} font-mono text-lg tracking-[0.3em] placeholder:font-sans placeholder:text-[15px] placeholder:tracking-normal`}
                    />
                  </span>
                </label>
              </div>
            )}

            {error && <div className="rounded-lg border border-red-400/30 bg-red-500/10 p-3 text-xs font-medium text-red-300">{error}</div>}

            <button
              type="submit"
              disabled={loading}
              className={`flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r ${GOLD} py-3 text-[15px] font-semibold text-[#1a140b] shadow-lg shadow-[#c9a063]/20 transition hover:brightness-110 disabled:opacity-50`}
            >
              {loading ? "กำลังเข้าสู่ระบบ..." : teacherMode ? "เข้าสู่ระบบหลังบ้าน" : "เข้าสู่ระบบ"}
              <span className="material-symbols-outlined text-lg">arrow_forward</span>
            </button>

            <p className="flex items-center justify-center gap-1.5 pt-2 text-xs text-white/35">
              <span className="material-symbols-outlined text-base text-[#c9a063]/80">verified_user</span>
              ระบบสอบแบบมีระบบตรวจจับการทุจริตแบบเรียลไทม์
            </p>
          </form>
        </div>

        {/* Right: the instructor, then the department, faculty and university — on a blueprint grid */}
        <div className="relative flex h-full flex-col overflow-hidden rounded-[26px] border border-white/10 bg-[#111113] p-6 text-white sm:p-10" style={BLUEPRINT}>
          <div className="pointer-events-none absolute -bottom-40 -left-40 h-[30rem] w-[30rem] rounded-full bg-[#c9a063] opacity-[0.12] blur-[120px]" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(0,0,0,0.65)_100%)]" />

          <div className="relative flex flex-1 flex-col items-center justify-center gap-5 py-4 text-center">
            <div className="relative">
              <div className="absolute -inset-5 rounded-[2.4rem] bg-[#c9a063]/15 blur-2xl" />
              <div className={`relative h-64 w-52 overflow-hidden rounded-3xl bg-gradient-to-br ${GOLD} p-[2px] shadow-2xl shadow-black/70 sm:h-72 sm:w-60`}>
                <div className="h-full w-full overflow-hidden rounded-[22px] bg-white">
                  <Image
                    src={teacher?.avatarUrl || "/teacher.png"}
                    alt="อาจารย์ผู้สอน"
                    width={300}
                    height={380}
                    className="h-full w-full object-cover object-top"
                    priority
                  />
                </div>
              </div>
              <span className={`absolute -bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r ${GOLD} px-3.5 py-1 text-[11px] font-bold tracking-wider text-[#1a140b] shadow-lg shadow-black/40`}>
                INSTRUCTOR
              </span>
            </div>
            <div className="pt-2">
              <h2 className="text-xl font-bold">{teacher?.fullName ?? " "}</h2>
              <p className="text-sm text-[#d9b984]">อาจารย์ผู้สอนประจำรายวิชา</p>
            </div>
            {courses.length > 0 && (
              <div className="flex max-w-md flex-wrap justify-center gap-2">
                {courses.map((c) => (
                  <span key={c.code} className="rounded-full border border-[#c9a063]/30 bg-black/40 px-3 py-1.5 text-xs text-white/80 backdrop-blur-md">
                    {c.title}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="relative mt-6 flex items-center justify-end gap-4 overflow-hidden rounded-2xl border border-white/10 bg-black/45 p-4 backdrop-blur-md">
            <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-[#c9a063]/60 to-transparent" />
            <div className="flex shrink-0 gap-2">
              <Image
                src="/brand/ce-logo.png"
                alt="ภาควิชาคอมพิวเตอร์ศึกษา"
                width={64}
                height={64}
                className="h-14 w-14 rounded-full bg-white p-0.5 shadow-lg sm:h-16 sm:w-16"
              />
              <Image
                src="/brand/fte-logo.png"
                alt="คณะครุศาสตร์อุตสาหกรรม"
                width={64}
                height={64}
                className="h-14 w-14 rounded-full bg-white p-1 shadow-lg sm:h-16 sm:w-16"
              />
            </div>
            <div className="min-w-0 text-right">
              <p className="text-[15px] font-bold leading-snug">มหาวิทยาลัยเทคโนโลยีพระจอมเกล้าพระนครเหนือ</p>
              <p className="text-[10.5px] font-semibold uppercase text-[#d9b984]">King Mongkut&apos;s University of Technology North Bangkok</p>
              <p className="mt-1 text-[11px] leading-snug text-white/55">
                ภาควิชาคอมพิวเตอร์ศึกษา สังกัดคณะครุศาสตร์อุตสาหกรรม
                <br className="hidden sm:block" /> มหาวิทยาลัยเทคโนโลยีพระจอมเกล้าพระนครเหนือ
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
