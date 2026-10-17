"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { courseCover } from "@/components/exam/courseCover";
import { RibbonCard } from "@/components/study/RibbonCard";

interface Course {
  id: string;
  code: string;
  title: string;
  description: string | null;
}

interface ChapterRow {
  id: string;
  number: number;
  title: string;
  _count: { sections: number; questions: number; worksheets: number };
}

/** One subject: its chapters as cards. Each chapter opens its own menu of parts. */
export default function StudyCoursePage({ params }: { params: { courseId: string } }) {
  const [course, setCourse] = useState<Course | null>(null);
  const [index, setIndex] = useState(0);
  const [chapters, setChapters] = useState<ChapterRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([apiFetch<Course[]>("/api/courses"), apiFetch<ChapterRow[]>(`/api/study/courses/${params.courseId}/chapters`)])
      .then(([courses, list]) => {
        const i = courses.findIndex((c) => c.id === params.courseId);
        if (i < 0) throw new Error("not found");
        setCourse(courses[i]);
        setIndex(i);
        setChapters(list);
      })
      .catch(() => setError("ไม่พบวิชานี้ หรือยังไม่เปิดให้ทบทวน"));
  }, [params.courseId]);

  if (error) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-error">{error}</p>
        <Link href="/study" className="text-xs text-primary underline">
          กลับไปรายการวิชา
        </Link>
      </div>
    );
  }
  if (!course || !chapters) return <p className="text-sm text-outline">กำลังโหลดวิชา...</p>;

  const cover = courseCover(index, course.title);

  return (
    <div className="space-y-6 rounded-xl bg-[#120a08]/85 p-6 text-[#fffaf0] shadow-lg ring-1 ring-white/10 md:p-8">
      <Link href="/study" className="text-xs text-[#d9ccb7] hover:text-[#ffa387]">
        ← รายการวิชาทั้งหมด
      </Link>

      <div
        className="relative flex flex-col justify-end gap-2 overflow-hidden rounded-lg p-6 text-white"
        style={{ background: `linear-gradient(135deg, ${cover.from}, ${cover.to})` }}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full opacity-40 blur-3xl"
          style={{ background: cover.glow }}
        />
        <p className="relative text-xs text-white/80">{course.code}</p>
        <h1 className="relative text-xl font-bold">{course.title}</h1>
        {course.description && <p className="relative max-w-2xl text-sm text-white/90">{course.description}</p>}
      </div>

      <div>
        <h2 className="text-base font-bold text-[#fffaf0]">บทเรียนทั้งหมด ({chapters.length} บท)</h2>
        <p className="mt-1 text-sm text-[#d9ccb7]">เลือกบทที่ต้องการ แล้วเลือกส่วนที่อยากทบทวนได้ตามลำดับที่สะดวก</p>
      </div>

      {chapters.length === 0 ? (
        <p className="rounded-lg border border-dashed border-white/15 p-6 text-sm text-[#d9ccb7]">ยังไม่มีบทเรียนทบทวนในวิชานี้</p>
      ) : (
        <div className="grid gap-8 sm:grid-cols-2 xl:grid-cols-3">
          {chapters.map((ch, i) => {
            const look = [
              { from: "#7a1838", to: "#f0661f", glow: "#ffd27a" },
              { from: "#2c0c35", to: "#c0306a", glow: "#ff9ac0" },
              { from: "#4a1030", to: "#e8a13a", glow: "#ffe08a" },
              { from: "#12071f", to: "#8a2be2", glow: "#d7a6ff" },
            ][i % 4];
            return (
              <Link key={ch.id} href={`/study/${ch.id}`} className="block">
                <RibbonCard
                  ribbon={`บทที่ ${ch.number}`}
                  caption={`${ch.title}\n${ch._count.sections} หัวข้อ · ${ch._count.questions} ข้อทบทวน · ${ch._count.worksheets} ใบงาน`}
                  icon="auto_stories"
                  {...look}
                />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
