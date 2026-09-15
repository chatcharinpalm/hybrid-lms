"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

interface Course {
  id: string;
  code: string;
  title: string;
  description: string | null;
}

interface Material {
  id: string;
  title: string;
  type: "SLIDE" | "VIDEO" | "DOCUMENT" | "LINK";
  fileUrl: string;
}

const TYPE_ICON: Record<Material["type"], string> = {
  SLIDE: "slideshow",
  VIDEO: "play_circle",
  DOCUMENT: "description",
  LINK: "link",
};

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [materials, setMaterials] = useState<Record<string, Material[]>>({});

  useEffect(() => {
    apiFetch<Course[]>("/api/courses")
      .then(async (list) => {
        setCourses(list);
        const entries = await Promise.all(
          list.map(async (c) => [c.id, await apiFetch<Material[]>(`/api/courses/${c.id}/materials`)] as const)
        );
        setMaterials(Object.fromEntries(entries));
      })
      .catch(() => undefined);
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-base font-semibold text-on-surface">คลังเอกสารประกอบการเรียน</h1>
        <p className="text-xs text-outline">สไลด์ วิดีโอ และเอกสารประกอบรายวิชา (Onsite &amp; Online)</p>
      </div>

      {courses.map((course) => (
        <div key={course.id} className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-xs font-mono bg-surface-container-high text-on-surface-variant">
              {course.code}
            </span>
            <h2 className="text-sm font-semibold text-on-surface">{course.title}</h2>
          </div>
          <div className="rounded-lg border border-outline-variant/30 divide-y divide-outline-variant/20 overflow-hidden">
            {(materials[course.id] ?? []).map((m) => (
              <a
                key={m.id}
                href={m.fileUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 px-4 py-3 bg-surface-container hover:bg-surface-container-high transition-colors text-xs text-on-surface"
              >
                <span className="material-symbols-outlined text-primary text-lg">{TYPE_ICON[m.type]}</span>
                {m.title}
              </a>
            ))}
            {(materials[course.id] ?? []).length === 0 && (
              <p className="px-4 py-3 text-xs text-on-surface-variant">ยังไม่มีเอกสารสำหรับวิชานี้</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
