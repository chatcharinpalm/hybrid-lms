"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import type { PortalMenu, PortalSettings } from "@/lib/portalSettings";

interface Course {
  id: string;
  title: string;
  termLabel: string | null;
  isHidden: boolean;
  examCount: number;
  openExamCount: number;
}

const MENUS: Array<{ key: PortalMenu; label: string; icon: string; hint: string }> = [
  { key: "courses", label: "คอร์สเรียน", icon: "cast_for_education", hint: "หน้ารวมรายวิชาและเอกสารประกอบการเรียน" },
  { key: "attendance", label: "เช็คชื่อเข้าเรียน", icon: "co_present", hint: "หน้าเช็คชื่อของนักศึกษา" },
];

/** What students see: hide whole courses, or menus of the student site. */
export default function CoursesVisibilityPage() {
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [hiddenMenus, setHiddenMenus] = useState<PortalMenu[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Course[]>("/api/courses")
      .then(setCourses)
      .catch((err: Error) => setError(err.message));
    apiFetch<PortalSettings>("/api/settings/portal")
      .then((s) => setHiddenMenus(s.hiddenMenus))
      .catch((err: Error) => setError(err.message));
  }, []);

  const toggleCourse = async (course: Course) => {
    setBusy(course.id);
    setError(null);
    try {
      const updated = await apiFetch<Course>(`/api/courses/${course.id}/visibility`, {
        method: "POST",
        body: JSON.stringify({ isHidden: !course.isHidden }),
      });
      setCourses((list) => list?.map((c) => (c.id === course.id ? { ...c, isHidden: updated.isHidden } : c)) ?? null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const toggleMenu = async (menu: PortalMenu) => {
    if (!hiddenMenus) return;
    const next = hiddenMenus.includes(menu) ? hiddenMenus.filter((m) => m !== menu) : [...hiddenMenus, menu];
    setBusy(menu);
    setError(null);
    try {
      const saved = await apiFetch<PortalSettings>("/api/settings/portal", {
        method: "PUT",
        body: JSON.stringify({ hiddenMenus: next }),
      });
      setHiddenMenus(saved.hiddenMenus);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-outline-variant/30 pb-4">
        <div>
          <h1 className="text-lg font-semibold text-on-surface">รายวิชา &amp; การแสดงผล</h1>
          <p className="text-xs text-outline">เลือกว่านักศึกษาจะเห็นรายวิชาและเมนูใดบ้าง มีผลทันที</p>
        </div>
        <Link
          href="/backoffice/courses/new"
          className="flex items-center gap-1.5 rounded bg-tertiary px-3 py-2 text-xs font-semibold text-on-tertiary hover:opacity-90"
        >
          <span className="material-symbols-outlined text-base">add</span>
          สร้างรายวิชา
        </Link>
      </div>

      {error && <p className="rounded border border-error/30 bg-error/10 px-3 py-2 text-xs text-error">{error}</p>}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-on-surface">รายวิชา</h2>
        {courses === null && <p className="text-xs text-outline">กำลังโหลด...</p>}
        <div className="divide-y divide-outline-variant/20 overflow-hidden rounded-lg border border-outline-variant/30 bg-surface-container">
          {courses?.map((course) => (
            <div key={course.id} className={`flex items-center gap-4 px-5 py-4 ${course.isHidden ? "opacity-60" : ""}`}>
              <span className="material-symbols-outlined text-2xl text-outline">
                {course.isHidden ? "visibility_off" : "visibility"}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-on-surface">{course.title}</div>
                <div className="text-xs text-outline">
                  แบบทดสอบ {course.examCount} ชุด · เปิดห้องอยู่ {course.openExamCount}
                  {course.termLabel ? ` · ปีการศึกษา ${course.termLabel}` : ""}
                </div>
              </div>
              <span className={`text-xs font-medium ${course.isHidden ? "text-error" : "text-secondary"}`}>
                {course.isHidden ? "ซ่อนจากนักศึกษา" : "นักศึกษาเห็น"}
              </span>
              <Switch on={!course.isHidden} disabled={busy === course.id} onClick={() => toggleCourse(course)} />
            </div>
          ))}
        </div>
        <p className="text-xs text-outline">
          รายวิชาที่ซ่อน: ไม่แสดงในศูนย์สอบและคอร์สเรียน และนักศึกษาเริ่มทำแบบทดสอบของรายวิชานั้นไม่ได้ (หลังบ้านยังเห็นและคุมสอบได้ตามปกติ)
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-on-surface">เมนูฝั่งนักศึกษา</h2>
        <div className="divide-y divide-outline-variant/20 overflow-hidden rounded-lg border border-outline-variant/30 bg-surface-container">
          {MENUS.map((menu) => {
            const shown = !hiddenMenus?.includes(menu.key);
            return (
              <div key={menu.key} className={`flex items-center gap-4 px-5 py-4 ${shown ? "" : "opacity-60"}`}>
                <span className="material-symbols-outlined text-2xl text-outline">{menu.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-on-surface">{menu.label}</div>
                  <div className="text-xs text-outline">{menu.hint}</div>
                </div>
                <span className={`text-xs font-medium ${shown ? "text-secondary" : "text-error"}`}>
                  {shown ? "แสดงอยู่" : "ซ่อนอยู่"}
                </span>
                <Switch on={shown} disabled={hiddenMenus === null || busy === menu.key} onClick={() => toggleMenu(menu.key)} />
              </div>
            );
          })}
          <div className="flex items-center gap-4 px-5 py-4 opacity-70">
            <span className="material-symbols-outlined text-2xl text-outline">assignment_turned_in</span>
            <div className="flex-1">
              <div className="text-sm font-semibold text-on-surface">ศูนย์สอบ</div>
              <div className="text-xs text-outline">แสดงเสมอ (หน้าหลักของนักศึกษา)</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function Switch({ on, disabled, onClick }: { on: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={onClick}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${on ? "bg-secondary" : "bg-surface-container-highest"}`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}
