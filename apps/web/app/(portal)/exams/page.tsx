"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { programOf, programTheme } from "@/lib/program";
import { courseCover } from "@/components/exam/courseCover";
import { Emblem, GAME_BUTTON, GameFrame, GameHeading } from "@/components/game/GameFrame";
import { MyRoomBadge } from "@/components/game/MyRoomBadge";

interface Course {
  id: string;
  title: string;
  description: string | null;
  termLabel: string | null;
  examCount: number;
  openExamCount: number;
}

interface Me {
  fullName: string;
  section: string | null;
}

export default function ExamsPage() {
  return (
    <Suspense fallback={null}>
      <ExamCenter />
    </Suspense>
  );
}

/**
 * The exam center, one choice at a time: programme (CED / TCT) → room → course.
 * Only the student's own programme and room can be picked (the others show,
 * locked, so the layout of the department is clear); each course's exams have
 * their own page.
 */
function ExamCenter() {
  const params = useSearchParams();
  const [me, setMe] = useState<Me | null>(null);
  const [programs, setPrograms] = useState<Array<{ code: string; rooms: string[] }> | null>(null);

  useEffect(() => {
    apiFetch<Me>("/api/students/me").then(setMe).catch(() => setMe({ fullName: "", section: null }));
    apiFetch<Array<{ code: string; rooms: string[] }>>("/api/students/programs").then(setPrograms).catch(() => setPrograms([]));
  }, []);

  if (!me || !programs) return <p className="py-10 text-center text-sm text-[#e8b64c]/80">กำลังโหลด...</p>;

  const myProgram = programOf(me.section);
  const room = params.get("room");
  const program = params.get("program") ?? programOf(room);
  // A student without a room (or a single-room department) goes straight to the courses.
  const skipSteps = !me.section || programs.length === 0;

  if (skipSteps || (room && room === me.section)) return <CourseStep program={program} room={me.section} />;

  if (program === myProgram) {
    const rooms = programs.find((p) => p.code === program)?.rooms ?? [me.section!];
    return (
      <div className="space-y-10 py-6">
        <Crumbs program={program} />
        <GameHeading title={`สาขา ${program} — เลือกห้องของคุณ`} sub="กดห้องที่คุณเรียน เพื่อดูรายวิชาและข้อสอบของห้องนั้น" />
        <div className="flex flex-wrap justify-center gap-6">
          {rooms.map((r) => (
            <ChoiceTile key={r} code={program} label={`ห้อง ${r}`} href={`/exams?room=${encodeURIComponent(r)}`} locked={r !== me.section} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10 py-6">
      <GameHeading title="ศูนย์สอบ — เลือกสาขา" sub="เลือกสาขาของคุณก่อน แล้วเลือกห้อง" />
      <div className="flex flex-wrap justify-center gap-6">
        {programs.map((p) => (
          <ChoiceTile key={p.code} code={p.code} label={`สาขา ${p.code}`} href={`/exams?program=${p.code}`} locked={p.code !== myProgram} big />
        ))}
      </div>
    </div>
  );
}

/** ศูนย์สอบ › CED › ห้อง CED 1 DE-RA — each step a link back. */
function Crumbs({ program, room }: { program: string | null; room?: string | null }) {
  const t = programTheme(program);
  return (
    <nav className="flex flex-wrap items-center justify-center gap-1.5 text-sm text-[#f2dcb0]/70">
      <Link href="/exams" className="hover:text-white">ศูนย์สอบ</Link>
      {program && (
        <>
          <span className="material-symbols-outlined text-base">chevron_right</span>
          <Link href={`/exams?program=${program}`} className="font-bold hover:brightness-125" style={{ color: t.accent }}>
            {program}
          </Link>
        </>
      )}
      {room && (
        <>
          <span className="material-symbols-outlined text-base">chevron_right</span>
          <span className="font-semibold text-white">ห้อง {room}</span>
        </>
      )}
    </nav>
  );
}

/** A big programme or room button in the programme's colour; other programmes'/rooms' are shown locked. */
function ChoiceTile({ code, label, href, locked, big }: { code: string | null; label: string; href: string; locked: boolean; big?: boolean }) {
  const t = programTheme(code);
  const body = (
    <div
      className={`relative flex flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border-2 px-6 text-center transition-transform ${
        big ? "h-56 w-64" : "h-40 w-64"
      } ${locked ? "cursor-not-allowed opacity-35 grayscale" : "hover:-translate-y-1.5"}`}
      style={{
        borderColor: `${t.accent}${locked ? "55" : "cc"}`,
        background: `linear-gradient(160deg, ${t.from}44, ${t.to}88), #0d050c`,
        boxShadow: locked ? "none" : `0 0 30px ${t.accent}44, inset 0 1px 0 rgba(255,255,255,0.15)`,
      }}
    >
      <span className="material-symbols-outlined" style={{ fontSize: big ? 52 : 36, color: t.accent }}>
        {locked ? "lock" : t.icon}
      </span>
      {big ? (
        <span className="font-display text-6xl font-black italic tracking-wider text-white" style={{ textShadow: `0 3px 0 #000, 0 0 22px ${t.accent}` }}>
          {code}
        </span>
      ) : (
        <span className="text-xl font-bold text-white">{label}</span>
      )}
      <span className="text-xs text-white/70">{locked ? "ไม่ใช่ของคุณ" : big ? "สาขาของคุณ — กดเพื่อเลือกห้อง" : "ห้องของคุณ — กดเพื่อดูรายวิชา"}</span>
    </div>
  );
  return locked ? <div title="ไม่ใช่สาขา/ห้องของคุณ">{body}</div> : <Link href={href}>{body}</Link>;
}

/** Step 3: the room's courses, each a card to its exams. */
function CourseStep({ program, room }: { program: string | null; room: string | null }) {
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Course[]>("/api/courses")
      .then(setCourses)
      .catch((err: Error) => setError(err.message));
  }, []);

  // Only courses with exams for the student's room (the counts already leave out other rooms').
  const mine = (courses ?? []).filter((c) => c.examCount > 0);

  return (
    <div className="space-y-10 py-6">
      {room && <Crumbs program={program ?? programOf(room)} room={room} />}
      <GameHeading
        title="เลือกรายวิชาที่จะสอบ"
        sub="เลือกรายวิชา แล้วรอผู้คุมสอบเปิดห้อง — ระบบป้องกันการทุจริตจะเริ่มทำงานเมื่อเข้าสู่ข้อสอบ"
      />
      <MyRoomBadge />

      {error && <p className="text-center text-sm text-error">{error}</p>}
      {courses === null && !error && <p className="text-center text-sm text-[#e8b64c]/80">กำลังโหลดรายวิชา...</p>}
      {courses && mine.length === 0 && (
        <GameFrame className="mx-auto max-w-md">
          <p className="p-10 text-center text-sm text-[#f2dcb0]/80">ยังไม่มีข้อสอบของห้องคุณ — รออาจารย์เปิดชุดข้อสอบให้ห้องคุณ</p>
        </GameFrame>
      )}

      <div className="flex flex-wrap justify-center gap-7 pt-4">
        {mine.map((course, i) => (
          <CourseCard key={course.id} course={course} index={i} />
        ))}
      </div>
    </div>
  );
}

/** A tall "choose your mode" card per course; one with an open exam room burns red. */
function CourseCard({ course, index }: { course: Course; index: number }) {
  const cover = courseCover(index, course.title);
  const open = course.openExamCount > 0;
  return (
    <Link href={`/exams/${course.id}`} className="group block w-full max-w-[300px] transition-transform duration-300 hover:-translate-y-1.5">
      <GameFrame hot={open} className="h-full">
        <div className="flex h-full min-h-[470px] flex-col items-center px-5 pb-6 pt-7 text-center">
          <span className="rounded border border-[#e9c27a]/30 bg-black/40 px-2.5 py-0.5 text-[11px] font-medium text-[#e9c27a]/80">
            {course.termLabel ? `ปีการศึกษา ${course.termLabel}` : "รายวิชา"}
          </span>
          <h2 className="mt-3 min-h-[3.2em] text-[17px] font-bold leading-snug text-[#f6c95a] [text-shadow:0_2px_0_rgba(0,0,0,0.6)]">
            {course.title}
          </h2>

          <div className="my-4 transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-6">
            <Emblem icon={cover.icon} from={cover.from} to={cover.to} size={84} />
          </div>

          {course.description && <p className="line-clamp-4 text-[13px] leading-relaxed text-[#f2dcb0]/85">{course.description}</p>}

          <ul className="mt-4 w-full space-y-1.5 text-left text-[12.5px] text-[#f2dcb0]/75">
            <Check>แบบทดสอบ {course.examCount} ชุด</Check>
            <Check>ข้อสอบเติมคำจากคลังตัวเลือก สลับลำดับรายบุคคล</Check>
            <Check>ส่งแล้วทราบคะแนนทันที</Check>
          </ul>

          <div className="mt-auto w-full space-y-3 pt-5">
            <div
              className={`flex items-center justify-center gap-1.5 rounded-md border px-2 py-1 text-[12px] font-semibold ${
                open ? "border-[#ff8a7a]/50 bg-[#ff3b30]/15 text-[#ffb4a8]" : "border-white/10 bg-black/30 text-white/55"
              }`}
            >
              {open && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#ff5a4a]" />}
              {open ? `เปิดห้องสอบอยู่ ${course.openExamCount} ห้อง` : "ยังไม่เปิดห้องสอบ"}
            </div>
            <span className={`${GAME_BUTTON} w-full`}>
              เข้าห้องสอบ
              <span className="material-symbols-outlined text-[18px] transition-transform group-hover:translate-x-0.5">arrow_forward</span>
            </span>
          </div>
        </div>
      </GameFrame>
    </Link>
  );
}

function Check({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-1.5">
      <span className="material-symbols-outlined mt-px text-[16px] text-[#e9b04a]">shield</span>
      <span>{children}</span>
    </li>
  );
}
