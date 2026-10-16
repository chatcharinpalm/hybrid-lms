"use client";

import { Suspense, useEffect, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { isStaff, storeSession, type Role } from "@/lib/auth";
import { SunsetScene } from "@/components/login/SunsetScene";
import { programTheme } from "@/lib/program";

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

/** Game-title styling over a dusk sky: ember gold → orange → crimson. */
const GOLD = "from-[#ffe08a] via-[#ff9a3d] to-[#e2401c]";
/** Fiery frame drawn as a 1.5px gradient border around a card. */
const FRAME = "bg-gradient-to-b from-[#ffd77a] via-[#f0661f] to-[#6e1238]";
const field =
  "w-full rounded-xl border-2 border-[#ff9a4d]/20 bg-[#0d050c]/80 py-3 pl-11 pr-4 text-[15px] text-white placeholder:text-white/25 outline-none transition-all focus:border-[#ffb34d] focus:shadow-[0_0_0_4px_rgba(255,140,50,0.18),0_0_22px_rgba(255,120,40,0.35)]";
const fieldIcon = "material-symbols-outlined pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-xl text-[#ffb36b]/60";
/** A chunky arcade button: glossy top edge, a solid "lip" below, presses down on click. */
const GAME_BUTTON =
  "relative flex w-full items-center justify-center gap-2 rounded-xl border-2 border-[#ffd08a]/80 bg-gradient-to-b from-[#ff9a45] via-[#e8441f] to-[#a3171f] py-3 font-display text-lg font-black italic tracking-wide text-white shadow-[inset_0_2px_0_rgba(255,255,255,0.45),0_5px_0_#5c0d12,0_12px_26px_rgba(240,80,30,0.45)] transition-all [text-shadow:0_2px_0_#6b0f0f] hover:brightness-110 active:translate-y-[4px] active:shadow-[inset_0_2px_0_rgba(255,255,255,0.35),0_1px_0_#5c0d12,0_6px_16px_rgba(240,80,30,0.4)] disabled:opacity-60";

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
  // Students first pick their programme (CED / TCT); the form below is that programme's.
  const [programs, setPrograms] = useState<Array<{ code: string; rooms: string[] }> | null>(null);
  const [program, setProgram] = useState<string | null>(null);
  const choosing = !teacherMode && !!programs && programs.length > 1 && !program;
  const theme = programTheme(program);

  useEffect(() => {
    apiFetch<Array<{ code: string; rooms: string[] }>>("/api/students/programs")
      .then(setPrograms)
      .catch(() => setPrograms([]));
  }, []);

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
        body: JSON.stringify(teacherMode ? { email, password } : { studentCode, password, program: program ?? undefined }),
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
    <div className="relative min-h-screen overflow-hidden bg-[#12071f] p-3 sm:p-5">
      <SunsetScene />
      <div className="relative mx-auto grid min-h-[calc(100vh-1.5rem)] max-w-[1280px] items-center gap-5 sm:min-h-[calc(100vh-2.5rem)] lg:grid-cols-[1fr_1.05fr]">
        {/* Left: the sign-in form, a dark glass panel in a fiery frame */}
        <div className={`relative mx-auto w-full max-w-[480px] rounded-[28px] ${FRAME} p-[1.5px] shadow-[0_30px_80px_rgba(20,0,20,0.7),0_0_40px_rgba(240,102,31,0.25)]`}>
        <div className="relative overflow-hidden rounded-[27px] bg-[#140812]/85 px-6 py-9 backdrop-blur-xl sm:px-10">
          <div className="pointer-events-none absolute -top-24 left-1/2 h-48 w-72 -translate-x-1/2 rounded-full bg-[#ff7a2f]/25 blur-3xl" />

          <form onSubmit={handleSubmit} className="relative space-y-5">
            <div className="flex flex-col items-center text-center">
              <div className={`rounded-full bg-gradient-to-br ${GOLD} p-[3px] shadow-[0_0_24px_rgba(255,140,50,0.55)]`}>
                <Image src="/brand/ce-logo.png" alt="ภาควิชาคอมพิวเตอร์ศึกษา" width={64} height={64} className="h-16 w-16 rounded-full bg-white" />
              </div>
              {/* Game-title lettering: hot gradient fill, dark bevel and a glow, with a light sweep now and then */}
              <h1
                className="title-shine mt-4 bg-clip-text pb-1 font-display text-[44px] font-black italic leading-none tracking-wide text-transparent sm:text-[52px]"
                style={{
                  backgroundImage:
                    "linear-gradient(100deg, transparent 35%, rgba(255,255,255,0.85) 50%, transparent 65%), linear-gradient(180deg, #fff6c4 0%, #ffd35a 38%, #ff8a2a 62%, #d8301a 100%)",
                  backgroundSize: "250% 100%, 100% 100%",
                  filter: "drop-shadow(0 3px 0 #5a0d0a) drop-shadow(0 0 18px rgba(255,120,40,0.55))",
                }}
              >
                ยินดีต้อนรับ
              </h1>
              <p className="mt-2 rounded-full border border-[#ffb36b]/25 bg-black/40 px-4 py-1 text-[12.5px] tracking-wide text-[#ffd9b0]/85">
                ระบบการเรียนการสอนและทดสอบออนไลน์
              </p>
            </div>

            <div className="grid grid-cols-2 gap-1.5 rounded-xl border-2 border-[#ff9a4d]/20 bg-black/50 p-1">
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
                  className={`flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-bold transition-all ${
                    as === t.id
                      ? "bg-gradient-to-b from-[#ffb057] to-[#e0501f] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.5),0_3px_0_#6b1410,0_0_16px_rgba(255,120,40,0.4)] [text-shadow:0_1px_0_#7a1a0a]"
                      : "text-white/50 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <span className="material-symbols-outlined text-base">{t.icon}</span>
                  {t.label}
                </button>
              ))}
            </div>

            <p className="text-center text-[13px] text-[#ffd9b0]/60">
              {teacherMode
                ? "เข้าสู่ระบบหลังบ้านเพื่อจัดการข้อสอบและคุมสอบ"
                : choosing
                  ? "ขั้นที่ 1: เลือกสาขาของคุณ"
                  : "เข้าสู่ระบบด้วยรหัสนักศึกษาและรหัสเข้าสอบที่ได้รับจากอาจารย์"}
            </p>

            {/* Step 1 for students: the programme, as two big buttons */}
            {choosing && (
              <div className="grid grid-cols-2 gap-3">
                {programs!.map((p) => {
                  const t = programTheme(p.code);
                  return (
                    <button
                      key={p.code}
                      type="button"
                      onClick={() => {
                        setProgram(p.code);
                        setError(null);
                      }}
                      className="group relative overflow-hidden rounded-2xl border-2 p-4 text-center transition-transform hover:-translate-y-1 active:translate-y-0"
                      style={{
                        borderColor: `${t.accent}aa`,
                        background: `linear-gradient(160deg, ${t.from}33, ${t.to}66), #0d050c`,
                        boxShadow: `0 0 22px ${t.accent}33, inset 0 1px 0 rgba(255,255,255,0.15)`,
                      }}
                    >
                      <span className="material-symbols-outlined text-[40px]" style={{ color: t.accent }}>
                        {t.icon}
                      </span>
                      <span
                        className="block font-display text-4xl font-black italic tracking-wider text-white"
                        style={{ textShadow: `0 2px 0 #000, 0 0 18px ${t.accent}` }}
                      >
                        {p.code}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Step 2: the chosen programme stays on top of the form */}
            {!teacherMode && program && (
              <div
                className="flex items-center justify-between gap-3 rounded-xl border-2 px-4 py-2.5"
                style={{ borderColor: `${theme.accent}99`, background: `linear-gradient(90deg, ${theme.from}40, ${theme.to}55)` }}
              >
                <span className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-2xl" style={{ color: theme.accent }}>
                    {theme.icon}
                  </span>
                  <span>
                    <span className="block text-[11px] text-white/60">สาขาที่เลือก</span>
                    <span className="block font-display text-2xl font-black italic leading-none text-white">{program}</span>
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setProgram(null);
                    setError(null);
                  }}
                  className="rounded-lg border border-white/20 bg-black/30 px-3 py-1.5 text-xs text-white/80 hover:bg-black/50"
                >
                  เปลี่ยนสาขา
                </button>
              </div>
            )}

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
            ) : choosing ? null : (
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

            {!choosing && (
              <button type="submit" disabled={loading} className={GAME_BUTTON}>
                {loading ? "กำลังเข้าสู่ระบบ..." : teacherMode ? "เข้าสู่ระบบหลังบ้าน" : program ? `เข้าสู่ระบบ ${program}` : "เข้าสู่ระบบ"}
                <span className="material-symbols-outlined text-xl not-italic">play_arrow</span>
              </button>
            )}

            <p className="flex items-center justify-center gap-1.5 pt-2 text-xs text-white/45">
              <span className="material-symbols-outlined text-base text-[#ffb36b]">verified_user</span>
              ระบบสอบแบบมีระบบตรวจจับการทุจริตแบบเรียลไทม์
            </p>
          </form>
        </div>
        </div>

        {/* Right: the instructor, then the department, faculty and university — a glass panel over the sky */}
        <div className="relative flex h-full flex-col overflow-hidden rounded-[28px] border border-[#ffb36b]/25 bg-[#1a0716]/35 p-6 text-white shadow-[0_30px_80px_rgba(20,0,20,0.55)] backdrop-blur-[3px] sm:p-10">
          <div className="pointer-events-none absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-[#ffd08a]/70 to-transparent" />

          <div className="relative flex flex-1 flex-col items-center justify-center gap-5 py-4 text-center">
            <div className="relative">
              <div className="absolute -inset-6 rounded-[2.4rem] bg-[#ff7a2f]/35 blur-3xl" />
              <div className={`relative h-64 w-52 overflow-hidden rounded-3xl bg-gradient-to-br ${GOLD} p-[3px] shadow-[0_20px_50px_rgba(30,0,20,0.7),0_0_30px_rgba(255,130,40,0.5)] sm:h-72 sm:w-60`}>
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
              <span className="absolute -bottom-3.5 left-1/2 -translate-x-1/2 rounded-lg border-2 border-[#ffd08a]/80 bg-gradient-to-b from-[#ff9a45] to-[#b3201f] px-4 py-1 font-display text-[13px] font-black italic tracking-widest text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_3px_0_#5c0d12] [text-shadow:0_1px_0_#6b0f0f]">
                INSTRUCTOR
              </span>
            </div>
            <div className="pt-3 [text-shadow:0_2px_10px_rgba(20,0,10,0.8)]">
              <h2 className="text-2xl font-bold">{teacher?.fullName ?? " "}</h2>
              <p className="text-sm font-medium text-[#ffd08a]">อาจารย์ผู้สอนประจำรายวิชา</p>
            </div>
            {courses.length > 0 && (
              <div className="flex max-w-md flex-wrap justify-center gap-2">
                {courses.map((c) => (
                  <span key={c.code} className="rounded-full border border-[#ffb36b]/40 bg-[#1a0716]/70 px-3 py-1.5 text-xs text-white/90 backdrop-blur-md">
                    {c.title}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="relative mt-6 flex items-center justify-end gap-4 overflow-hidden rounded-2xl border border-[#ffb36b]/25 bg-[#12040e]/75 p-4 backdrop-blur-md">
            <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-[#ffb36b]/70 to-transparent" />
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
              <p className="text-[10.5px] font-semibold uppercase text-[#ffb36b]">King Mongkut&apos;s University of Technology North Bangkok</p>
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
