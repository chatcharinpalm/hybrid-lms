"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { courseCover } from "@/components/exam/courseCover";

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

/** ทบทวนบทเรียน: a catalogue of subjects. Open one to choose its chapter and the part you want. */
export default function StudyCataloguePage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [chapters, setChapters] = useState<Record<string, ChapterRow[]>>({});
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Course[]>("/api/courses")
      .then(async (list) => {
        setCourses(list);
        const entries = await Promise.all(
          list.map(async (c) => [c.id, await apiFetch<ChapterRow[]>(`/api/study/courses/${c.id}/chapters`)] as const)
        );
        setChapters(Object.fromEntries(entries));
      })
      .catch(() => setError("โหลดรายการวิชาไม่สำเร็จ ลองรีเฟรชหน้านี้อีกครั้ง"));
  }, []);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? courses.filter((c) => c.title.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)) : courses;
  }, [courses, query]);

  return (
    <div className="space-y-6 rounded-xl bg-[#120a08]/85 p-6 text-[#fffaf0] shadow-lg ring-1 ring-white/10 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#fffaf0]">ทบทวนบทเรียน</h1>
          <p className="mt-1 text-sm text-[#d9ccb7]">เลือกวิชาที่ต้องการ แล้วเลือกบทและส่วนที่อยากทบทวนได้เลย</p>
        </div>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ค้นหาวิชา"
          aria-label="ค้นหาวิชา"
          className="w-full max-w-xs rounded-md border border-white/15 px-3 py-2 text-sm text-[#fffaf0] placeholder:text-[#a99c8a] focus:border-[#e8562a] focus:outline-none"
        />
      </div>

      {error && <p className="text-sm text-[#f08a80]">{error}</p>}
      {courses.length > 0 && shown.length === 0 && <p className="text-sm text-[#d9ccb7]">ไม่พบวิชาที่ค้นหา</p>}

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {shown.map((course) => {
          const index = courses.findIndex((c) => c.id === course.id);
          const cover = courseCover(index, course.title);
          const list = chapters[course.id];
          const questions = (list ?? []).reduce((n, c) => n + c._count.questions, 0);
          return (
            <Link
              key={course.id}
              href={`/study/course/${course.id}`}
              className="group flex flex-col overflow-hidden rounded-lg border border-white/10 bg-[#120a08]/85 shadow-sm transition-shadow hover:shadow-md"
            >
              <div
                className="relative flex h-40 items-center justify-center overflow-hidden"
                style={{ background: `linear-gradient(135deg, ${cover.from}, ${cover.to})` }}
              >
                <span
                  aria-hidden
                  className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-40 blur-2xl"
                  style={{ background: cover.glow }}
                />
                <span className="material-symbols-outlined relative text-[64px] text-white/95">{cover.icon}</span>
              </div>
              <div className="flex flex-1 flex-col gap-2 p-4">
                <h2 className="text-[15px] font-bold leading-snug text-[#fffaf0] group-hover:text-[#ffa387]">{course.title}</h2>
                <p className="line-clamp-2 text-xs leading-5 text-[#e3d7c4]">{course.description ?? course.code}</p>
                <div className="mt-auto flex items-center justify-between border-t border-white/10 pt-3 text-xs text-[#d9ccb7]">
                  <span>{course.code}</span>
                  <span className="font-semibold text-[#ffa387]">
                    {list ? `${list.length} บท · ${questions} ข้อทบทวน` : "กำลังโหลด..."}
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
