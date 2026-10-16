"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { courseCover } from "@/components/exam/courseCover";
import { Emblem, GAME_BUTTON, GameFrame } from "@/components/game/GameFrame";
import { MyRoomBadge } from "@/components/game/MyRoomBadge";

interface Course {
  id: string;
  title: string;
  description: string | null;
}

interface ExamSummary {
  id: string;
  title: string;
  description: string | null;
  durationMinutes: number;
  status: "DRAFT" | "SCHEDULED" | "OPEN" | "CLOSED";
  passScorePercent: number;
  maxAttempts: number;
}

/** "แบบทดสอบ บทที่ 6 เรื่อง ..." → "บทที่ 6" for the card's badge. */
const chapterOf = (title: string) => title.match(/บทที่\s*\d+/)?.[0] ?? null;

/** One course's exams, after the student picked the course in the exam center. */
export default function CourseExamsPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const [course, setCourse] = useState<Course | null>(null);
  const [courseIndex, setCourseIndex] = useState(0);
  const [exams, setExams] = useState<ExamSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Back goes to the student's room in the exam center.
  const [myRoom, setMyRoom] = useState<string | null>(null);
  useEffect(() => {
    apiFetch<{ section: string | null }>("/api/students/me")
      .then((me) => setMyRoom(me.section))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    Promise.all([apiFetch<Course[]>("/api/courses"), apiFetch<ExamSummary[]>(`/api/exams/course/${courseId}`)])
      .then(([courses, list]) => {
        const index = courses.findIndex((c) => c.id === courseId);
        if (index < 0) throw new Error("ไม่พบรายวิชานี้ หรือรายวิชาถูกปิดการแสดงผล");
        setCourse(courses[index]);
        setCourseIndex(index);
        // Chapter order, as the papers are numbered.
        setExams([...list].sort((a, b) => a.title.localeCompare(b.title, "th", { numeric: true })));
      })
      .catch((err: Error) => setError(err.message));
  }, [courseId]);

  const cover = courseCover(courseIndex, course?.title ?? "");

  return (
    <div className="space-y-8 py-2">
      <Link
        href={myRoom ? `/exams?room=${encodeURIComponent(myRoom)}` : "/exams"}
        className="inline-flex items-center gap-1 text-sm text-[#e8b64c]/80 hover:text-[#ffd98a]"
      >
        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        เลือกรายวิชาอื่น
      </Link>

      {error && <p className="text-sm text-error">{error}</p>}

      {course && (
        <GameFrame>
          <div className="flex flex-col items-center gap-6 p-7 text-center sm:flex-row sm:text-left">
            <Emblem icon={cover.icon} from={cover.from} to={cover.to} size={96} />
            <div className="max-w-3xl space-y-2">
              <span className="inline-block rounded border border-[#e9c27a]/30 bg-black/40 px-2.5 py-0.5 text-[11px] font-medium text-[#e9c27a]/80">
                ห้องสอบของรายวิชา
              </span>
              <h1 className="font-display text-2xl font-black italic leading-tight text-[#f6dfa0] [text-shadow:0_2px_0_#3a1606,0_0_20px_rgba(255,150,60,0.4)] sm:text-3xl">
                {course.title}
              </h1>
              {course.description && <p className="text-sm leading-relaxed text-[#f2dcb0]/80">{course.description}</p>}
            </div>
          </div>
        </GameFrame>
      )}

      <MyRoomBadge />

      {exams?.length === 0 && (
        <GameFrame>
          <p className="p-10 text-center text-sm text-[#f2dcb0]/80">ยังไม่มีแบบทดสอบของห้องคุณในรายวิชานี้</p>
        </GameFrame>
      )}

      <div className="grid grid-cols-1 gap-x-6 gap-y-8 pt-3 lg:grid-cols-2">
        {exams?.map((exam) => (
          <ExamCard key={exam.id} exam={exam} />
        ))}
      </div>
    </div>
  );
}

function ExamCard({ exam }: { exam: ExamSummary }) {
  const open = exam.status === "OPEN";
  const chapter = chapterOf(exam.title);
  return (
    <GameFrame hot={open} className="h-full">
      <div className="flex h-full flex-col p-6">
        <div className="flex items-center justify-between gap-3">
          {chapter ? (
            <span className="rounded border border-[#e9c27a]/40 bg-black/40 px-2.5 py-1 font-display text-sm font-black italic tracking-wide text-[#f6c95a]">
              {chapter}
            </span>
          ) : (
            <span />
          )}
          <span
            className={`flex items-center gap-1.5 rounded-md border px-3 py-1 text-xs font-semibold ${
              open ? "border-[#ff8a7a]/50 bg-[#ff3b30]/15 text-[#ffb4a8]" : "border-white/10 bg-black/30 text-white/55"
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${open ? "animate-pulse bg-[#ff5a4a]" : "bg-white/30"}`} />
            {open ? "เปิดห้องสอบแล้ว" : "ห้องสอบยังปิด"}
          </span>
        </div>

        <h2 className="mt-4 text-base font-bold leading-snug text-[#f6c95a] [text-shadow:0_2px_0_rgba(0,0,0,0.6)]">{exam.title}</h2>

        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <Chip icon="schedule">{exam.durationMinutes} นาที</Chip>
          {exam.description && <Chip icon="format_list_numbered">{exam.description}</Chip>}
          <Chip icon="replay">สิทธิ์สอบ {exam.maxAttempts > 0 ? `${exam.maxAttempts} ครั้ง` : "ไม่จำกัด"}</Chip>
          <Chip icon="verified">ผ่าน {exam.passScorePercent}%</Chip>
        </div>

        <div className="mt-auto flex items-center justify-end border-t border-[#e9c27a]/15 pt-5">
          {open ? (
            <Link href={`/exam/${exam.id}/lobby`} className={GAME_BUTTON}>
              เริ่มทำแบบทดสอบ
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </Link>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/40 px-5 py-2.5 text-sm font-medium text-white/45">
              <span className="material-symbols-outlined text-[18px]">hourglass_top</span>
              รอผู้คุมสอบเปิดห้อง
            </span>
          )}
        </div>
      </div>
    </GameFrame>
  );
}

function Chip({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-[#e9c27a]/20 bg-black/35 px-2.5 py-1.5 font-medium text-[#f2dcb0]/85">
      <span className="material-symbols-outlined text-[15px] text-[#e9b04a]">{icon}</span>
      {children}
    </span>
  );
}
