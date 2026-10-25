"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { exportExamExcelById } from "@/lib/exportExamExcel";
import { ConfirmDelete } from "@/components/backoffice/ConfirmDelete";
import { RoomPicker, roomsLabel } from "@/components/backoffice/RoomPicker";
import { CloseButton, LiveRooms, OpenButton, useLiveExams } from "@/components/backoffice/LiveRooms";

interface CourseExam {
  id: string;
  title: string;
  description: string;
  durationMinutes: number;
  status: string;
  courseId: string;
  isHidden: boolean;
  /** Rooms that sit it; null = every room. */
  sections: string[] | null;
}

/** "ห้องที่สอบ": set which rooms see and sit this exam, saved as soon as a room is tapped. */
function RoomsRow({ exam, rooms, onChange }: { exam: CourseExam; rooms: string[]; onChange: (sections: string[] | null) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (rooms.length < 2) return null;
  const save = async (sections: string[] | null) => {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/exams/${exam.id}/settings`, { method: "PATCH", body: JSON.stringify({ sections }) });
      onChange(sections);
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-outline-variant/20 bg-surface-container-lowest/60 px-2.5 py-2">
      <span className="flex items-center gap-1 text-[11px] font-semibold text-on-surface-variant">
        <span className="material-symbols-outlined text-[15px]">meeting_room</span>
        ห้องที่สอบ
      </span>
      <RoomPicker rooms={rooms} value={exam.sections} onChange={save} disabled={busy} />
      {error && <span className="text-[11px] text-error">{error}</span>}
    </div>
  );
}

/** The exam's name, with a pencil to rename it (saved to the server; students see the new name). */
function TitleEditor({ exam, onChange }: { exam: CourseExam; onChange: (title: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(exam.title);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    const title = value.trim();
    if (!title) {
      setError("ใส่ชื่อข้อสอบ");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/exams/${exam.id}/settings`, { method: "PATCH", body: JSON.stringify({ title }) });
      onChange(title);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };
  if (!editing) {
    return (
      <div className="flex items-center gap-2">
        <h4 className="text-sm font-semibold text-on-surface">{exam.title}</h4>
        <button
          type="button"
          title="แก้ชื่อข้อสอบ"
          onClick={() => {
            setValue(exam.title);
            setEditing(true);
          }}
          className="material-symbols-outlined text-[16px] text-outline hover:text-primary"
        >
          edit
        </button>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        maxLength={300}
        autoFocus
        className="min-w-0 flex-1 rounded-md border border-outline-variant/40 bg-surface-container-lowest px-2 py-1 text-sm text-on-surface"
      />
      <button type="button" onClick={save} disabled={busy} className="px-2 py-1 rounded-md text-xs font-bold bg-primary/15 text-primary border border-primary/40 disabled:opacity-50">
        บันทึก
      </button>
      <button type="button" onClick={() => setEditing(false)} disabled={busy} className="px-2 py-1 rounded-md text-xs text-outline border border-outline-variant/30">
        ยกเลิก
      </button>
      {error && <span className="text-[11px] text-error">{error}</span>}
    </div>
  );
}

/** Hides the exam from students (not listed, cannot be started) or shows it again. */
function HideButton({ exam, onChange }: { exam: CourseExam; onChange: (hidden: boolean) => void }) {
  const [busy, setBusy] = useState(false);
  const toggle = async () => {
    setBusy(true);
    try {
      await apiFetch(`/api/exams/${exam.id}/settings`, { method: "PATCH", body: JSON.stringify({ isHidden: !exam.isHidden }) });
      onChange(!exam.isHidden);
    } finally {
      setBusy(false);
    }
  };
  return (
    <button
      type="button"
      disabled={busy}
      onClick={toggle}
      title={exam.isHidden ? "นักศึกษามองไม่เห็นชุดนี้ — กดเพื่อแสดง" : "ซ่อนชุดนี้จากนักศึกษา"}
      className={`px-3 py-1.5 rounded-lg text-xs border flex items-center gap-1.5 disabled:opacity-50 ${
        exam.isHidden
          ? "bg-tertiary/15 text-tertiary border-tertiary/40 font-bold"
          : "bg-surface-container-highest text-on-surface border-outline-variant/30 hover:text-primary"
      }`}
    >
      <span className="material-symbols-outlined text-sm">{exam.isHidden ? "visibility_off" : "visibility"}</span>
      {exam.isHidden ? "ซ่อนอยู่" : "ซ่อน"}
    </button>
  );
}

function ExportExcelButton({ examId }: { examId: string }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const run = async () => {
    setBusy("กำลังเตรียม...");
    setError(null);
    try {
      await exportExamExcelById(examId, (done, total) => setBusy(`โหลดคำตอบ ${done}/${total}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "ส่งออกไม่สำเร็จ");
    } finally {
      setBusy(null);
    }
  };
  return (
    <button
      type="button"
      disabled={Boolean(busy)}
      onClick={run}
      title={error ?? "ผลสอบ คำตอบรายข้อ การทุจริต และการสั่งการ (ทุกห้อง)"}
      className={`px-3 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-1.5 disabled:opacity-60 ${
        error
          ? "bg-error/10 text-error border-error/40"
          : "bg-emerald-600/15 text-emerald-400 border-emerald-500/40 hover:bg-emerald-600/25"
      }`}
    >
      <span className={`material-symbols-outlined text-sm ${busy ? "animate-spin" : ""}`}>{busy ? "sync" : "download"}</span>
      {busy ?? (error ? "ส่งออกไม่สำเร็จ ลองใหม่" : "Export Excel")}
    </button>
  );
}

const STATUS_TH: Record<string, string> = { DRAFT: "ฉบับร่าง", SCHEDULED: "ตั้งเวลาไว้", OPEN: "เปิดห้องสอบ", CLOSED: "ปิดห้องสอบ" };
const COURSE_KEY = "backoffice.monitor.course";

export default function AdminMonitorHubPage() {
  const [courses, setCourses] = useState<Array<{ id: string; title: string }>>([]);
  const [exams, setExams] = useState<CourseExam[]>([]);
  const [roomsByCourse, setRoomsByCourse] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  // The course in view ("all" = every course); remembered on this computer.
  const [courseId, setCourseIdState] = useState("all");
  const setCourseId = (id: string) => {
    setCourseIdState(id);
    try {
      localStorage.setItem(COURSE_KEY, id);
    } catch {}
  };

  // Bumped after a room is opened or closed here, so the lists and the live panel reload.
  const [version, setVersion] = useState(0);
  const { live, reload: reloadLive } = useLiveExams(version);
  const changed = () => {
    setVersion((v) => v + 1);
    reloadLive();
  };
  // Keep each card's status in step with the live panel (it polls every few seconds).
  useEffect(() => {
    if (!live) return;
    const open = new Map(live.map((e) => [e.id, e]));
    setExams((list) =>
      list.map((e) => {
        const l = open.get(e.id);
        if (l) return e.status === "OPEN" && e.durationMinutes === l.durationMinutes ? e : { ...e, status: "OPEN", sections: l.sections, durationMinutes: l.durationMinutes };
        return e.status === "OPEN" ? { ...e, status: "CLOSED" } : e;
      })
    );
  }, [live]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(COURSE_KEY);
      if (saved) setCourseIdState(saved);
    } catch {}
    apiFetch<Array<{ id: string; title: string }>>("/api/courses")
      .then(async (list) => {
        setCourses(list);
        const [perCourse, rooms] = await Promise.all([
          Promise.all(list.map((c) => apiFetch<CourseExam[]>(`/api/exams/course/${c.id}`).catch(() => [] as CourseExam[]))),
          Promise.all(list.map((c) => apiFetch<string[]>(`/api/exams/rooms/${c.id}`).catch(() => [] as string[]))),
        ]);
        setExams(perCourse.flat());
        setRoomsByCourse(Object.fromEntries(list.map((c, i) => [c.id, rooms[i]])));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [version]);
  const allRooms = [...new Set(Object.values(roomsByCourse).flat())].sort();

  // Only courses that have exams get a tab; a remembered course that is gone falls back to all.
  const withExams = courses.filter((c) => exams.some((e) => e.courseId === c.id));
  const current = withExams.some((c) => c.id === courseId) ? courseId : "all";
  const shown = withExams.filter((c) => current === "all" || c.id === current);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-on-surface">
            ศูนย์ควบคุมการสอบสด (Live Exam Monitoring Center)
          </h1>
          <p className="text-xs text-on-surface-variant mt-1">
            เปิด/ปิดห้องสอบได้จากหน้านี้ — เปิดหลายบทพร้อมกันได้ แต่ละชุดกำหนดห้องที่สอบแยกกัน
          </p>
        </div>
      </div>

      <LiveRooms live={live} allRooms={allRooms} onChanged={changed} />

      {loading ? (
        <div className="py-6 text-center text-xs text-outline">กำลังโหลดรายการข้อสอบ...</div>
      ) : exams.length === 0 ? (
        <div className="py-6 text-center text-xs text-outline">ยังไม่มีแบบทดสอบ</div>
      ) : (
        <div className="space-y-6">
          {/* One tab per course: pick the subject first, then its exams. */}
          <div className="flex flex-wrap gap-2">
            {[{ id: "all", title: "ทุกรายวิชา" }, ...withExams].map((c) => {
              const count = c.id === "all" ? exams.length : exams.filter((e) => e.courseId === c.id).length;
              const open = (c.id === "all" ? exams : exams.filter((e) => e.courseId === c.id)).filter((e) => e.status === "OPEN").length;
              const active = current === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCourseId(c.id)}
                  className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm transition-colors ${
                    active
                      ? "border-primary bg-primary/15 font-bold text-primary"
                      : "border-outline-variant/30 bg-surface-container text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                  }`}
                >
                  <span className="material-symbols-outlined text-lg">{c.id === "all" ? "apps" : "menu_book"}</span>
                  <span className="max-w-[22rem] truncate">{c.title}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] ${active ? "bg-primary/20" : "bg-surface-container-highest"}`}>{count}</span>
                  {open > 0 && (
                    <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-bold text-emerald-400">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                      เปิดสอบ {open}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {shown.map((course) => (
            <section key={course.id} className="space-y-3">
              <h3 className="flex items-center gap-2 border-b border-outline-variant/30 pb-2 text-sm font-bold text-on-surface">
                <span className="material-symbols-outlined text-lg text-primary">menu_book</span>
                {course.title}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {exams.filter((ex) => ex.courseId === course.id).map((ex) => (
                  <div
                    key={ex.id}
                    className={`p-5 rounded-xl bg-surface-container border flex flex-col gap-3 ${
                      ex.isHidden ? "border-dashed border-tertiary/40 opacity-75" : "border-outline-variant/30"
                    }`}
                  >
                    <div>
                      {ex.status === "OPEN" ? (
                        <span className="mb-1.5 inline-flex items-center gap-1.5 rounded-full border border-emerald-500/50 bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-bold text-emerald-400">
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                          เปิดสอบอยู่ · {roomsLabel(ex.sections)}
                        </span>
                      ) : (
                        <span className="mb-1.5 inline-flex items-center gap-1 rounded-full border border-outline-variant/40 px-2.5 py-0.5 text-[11px] text-outline">
                          <span className="material-symbols-outlined text-[13px]">lock</span>
                          ปิดอยู่
                        </span>
                      )}
                      <TitleEditor exam={ex} onChange={(title) => setExams((list) => list.map((e) => (e.id === ex.id ? { ...e, title } : e)))} />
                      <p className="text-xs text-outline mt-0.5">
                        เวลา: {ex.durationMinutes} นาที •{" "}
                        <span className={ex.status === "OPEN" ? "font-bold text-emerald-400" : ""}>{STATUS_TH[ex.status] ?? ex.status}</span>
                        {ex.isHidden && <span className="font-bold text-tertiary"> • ซ่อนจากนักศึกษา</span>}
                        {" • "}ห้อง: <span className={ex.sections ? "font-bold text-primary" : ""}>{roomsLabel(ex.sections)}</span>
                      </p>
                    </div>
                    <RoomsRow
                      exam={ex}
                      rooms={roomsByCourse[ex.courseId] ?? []}
                      onChange={(sections) => setExams((list) => list.map((e) => (e.id === ex.id ? { ...e, sections } : e)))}
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      {ex.status === "OPEN" ? (
                        <CloseButton examId={ex.id} onDone={changed} />
                      ) : (
                        <OpenButton exam={ex} rooms={roomsByCourse[ex.courseId] ?? []} onDone={changed} />
                      )}
                      <Link
                        href={`/backoffice/exams/${ex.id}/monitor`}
                        className="px-3 py-1.5 rounded-lg bg-primary/15 border border-primary/40 text-xs font-bold text-primary hover:bg-primary/25 transition-colors flex items-center gap-1.5"
                      >
                        <span className="material-symbols-outlined text-sm">live_tv</span>
                        <span>คุมสอบ</span>
                      </Link>
                      <Link
                        href={`/backoffice/exams/${ex.id}/answers`}
                        className="px-3 py-1.5 rounded-lg bg-surface-container-highest hover:bg-surface-container-high border border-outline-variant/30 text-xs text-on-surface hover:text-primary transition-colors flex items-center gap-1.5"
                      >
                        <span className="material-symbols-outlined text-sm">fact_check</span>
                        <span>เฉลย & คำอธิบาย</span>
                      </Link>
                      <ExportExcelButton examId={ex.id} />
                      <HideButton
                        exam={ex}
                        onChange={(hidden) => setExams((list) => list.map((e) => (e.id === ex.id ? { ...e, isHidden: hidden } : e)))}
                      />
                      <ConfirmDelete
                        title={ex.title}
                        consequences={["ข้อสอบทุกข้อในชุดนี้", "ผลสอบและคำตอบของนักศึกษาทุกคน", "บันทึกการทุจริตของชุดนี้"]}
                        onDelete={async () => {
                          await apiFetch(`/api/exams/${ex.id}`, { method: "DELETE" });
                          setExams((list) => list.filter((e) => e.id !== ex.id));
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
