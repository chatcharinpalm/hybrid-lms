"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { ENDED_REASON_TH } from "@/lib/exportExamExcel";
import { exportGradebookExcel, type Gradebook, type GradebookAttempt } from "@/lib/exportGradebookExcel";

const COURSE_KEY = "backoffice.gradebook.course";
const shortTitle = (t: string) => t.match(/บทที่\s*\d+/)?.[0] ?? (t.length > 18 ? `${t.slice(0, 18)}…` : t);
const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "-";

/**
 * Back office only: the course's gradebook — every student against every exam,
 * with every sitting kept (retakes, remedial re-sits, reset attempts), so the
 * teacher sees who has sat what and how they did, room by room.
 */
export default function GradebookPage() {
  const [courses, setCourses] = useState<Array<{ id: string; title: string }>>([]);
  const [courseId, setCourseIdState] = useState<string | null>(null);
  const [book, setBook] = useState<Gradebook | null>(null);
  const [room, setRoom] = useState("ALL");
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState<{ studentId: string; examId: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const setCourseId = (id: string) => {
    setCourseIdState(id);
    setRoom("ALL");
    try {
      localStorage.setItem(COURSE_KEY, id);
    } catch {}
  };

  useEffect(() => {
    apiFetch<Array<{ id: string; title: string }>>("/api/courses")
      .then((list) => {
        setCourses(list);
        let saved: string | null = null;
        try {
          saved = localStorage.getItem(COURSE_KEY);
        } catch {}
        setCourseIdState(list.some((c) => c.id === saved) ? saved : list[0]?.id ?? null);
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  useEffect(() => {
    if (!courseId) return;
    setBook(null);
    apiFetch<Gradebook>(`/api/exams/gradebook/${courseId}`)
      .then(setBook)
      .catch((err: Error) => setError(err.message));
  }, [courseId]);

  /**
   * Re-score: the chosen sittings stop counting (they stay in the record, struck through).
   * The student can then sit the exam again.
   */
  const resetSittings = async (ids: string[], label: string) => {
    if (!courseId || !window.confirm(`รีคะแนนของ${label}?\nครั้งที่เลือกจะไม่นับในคะแนน แต่ยังเก็บไว้ในประวัติ`)) return;
    setResetting(true);
    setResetError(null);
    try {
      for (const id of ids) {
        await apiFetch(`/api/exams/attempts/${id}/control/reset`, { method: "POST", body: JSON.stringify({ reason: "รีคะแนนจากสมุดคะแนน" }) });
      }
      setBook(await apiFetch<Gradebook>(`/api/exams/gradebook/${courseId}`));
    } catch (err) {
      setResetError(err instanceof Error ? err.message : "รีคะแนนไม่สำเร็จ");
    } finally {
      setResetting(false);
    }
  };

  // Every sitting per student per exam, oldest first.
  const sittings = useMemo(() => {
    const map = new Map<string, GradebookAttempt[]>();
    for (const a of book?.attempts ?? []) {
      const key = `${a.studentId}:${a.examId}`;
      map.set(key, [...(map.get(key) ?? []), a]);
    }
    return map;
  }, [book]);

  if (error) return <p className="text-sm text-error">{error}</p>;

  const rooms = [...new Set((book?.students ?? []).map((s) => s.section ?? "ไม่ระบุห้อง"))];
  const q = search.trim().toLowerCase();
  const students = (book?.students ?? []).filter(
    (s) =>
      (room === "ALL" || (s.section ?? "ไม่ระบุห้อง") === room) &&
      (!q || s.fullName.toLowerCase().includes(q) || (s.studentCode ?? "").toLowerCase().includes(q))
  );
  const counted = (list: GradebookAttempt[] | undefined) => (list ?? []).filter((a) => !a.archivedAt && a.status !== "IN_PROGRESS");
  const latest = (list: GradebookAttempt[] | undefined) => counted(list).at(-1);
  const detailStudent = detail && book?.students.find((s) => s.id === detail.studentId);
  const detailExam = detail && book?.exams.find((e) => e.id === detail.examId);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-on-surface">สมุดคะแนน</h1>
          <p className="mt-0.5 text-xs text-on-surface-variant">
            ทุกครั้งที่นักศึกษาสอบถูกเก็บไว้ ทั้งสอบซ้ำ สอบแก้ และรอบที่ถูกรีเซ็ต — ในช่องแสดงคะแนนครั้งล่าสุด กดช่องเพื่อดูทุกครั้ง
          </p>
        </div>
        {book && (
          <button
            type="button"
            disabled={exporting}
            onClick={async () => {
              setExporting(true);
              try {
                await exportGradebookExcel(book, room === "ALL" ? null : room);
              } finally {
                setExporting(false);
              }
            }}
            className="flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-600/15 px-3 py-2 text-xs font-bold text-emerald-400 hover:bg-emerald-600/25 disabled:opacity-60"
          >
            <span className={`material-symbols-outlined text-sm ${exporting ? "animate-spin" : ""}`}>{exporting ? "sync" : "download"}</span>
            Export สมุดคะแนน{room === "ALL" ? " (แยกชีตตามห้อง)" : ` (${room})`}
          </button>
        )}
      </div>

      {/* Course and room */}
      <div className="flex flex-wrap items-center gap-2">
        {courses.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCourseId(c.id)}
            className={`flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-sm ${
              courseId === c.id
                ? "border-primary bg-primary/15 font-bold text-primary"
                : "border-outline-variant/30 bg-surface-container text-on-surface-variant hover:text-on-surface"
            }`}
          >
            <span className="material-symbols-outlined text-lg">menu_book</span>
            <span className="max-w-[22rem] truncate">{c.title}</span>
          </button>
        ))}
      </div>

      {!book ? (
        <p className="text-sm text-on-surface-variant">กำลังโหลดสมุดคะแนน...</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-xl border border-outline-variant/30 bg-surface-container p-1">
              {["ALL", ...rooms].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRoom(r)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                    room === r ? "bg-primary text-on-primary" : "text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  {r === "ALL" ? "ทุกห้อง" : r}
                </button>
              ))}
            </div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหาชื่อ / รหัสนักศึกษา"
              className="w-56 rounded-xl border border-outline-variant/30 bg-surface-container px-3 py-2 text-xs text-on-surface outline-none focus:border-primary"
            />
            <span className="ml-auto flex flex-wrap items-center gap-3 text-[11px] text-on-surface-variant">
              <Legend className="bg-secondary/20 text-secondary">ผ่าน</Legend>
              <Legend className="bg-error/20 text-error">ไม่ผ่าน</Legend>
              <Legend className="bg-tertiary/20 text-tertiary">กำลังสอบ</Legend>
              <span>×2 = สอบ 2 ครั้ง</span>
            </span>
          </div>

          {book.exams.length === 0 ? (
            <p className="text-sm text-on-surface-variant">รายวิชานี้ยังไม่มีแบบทดสอบ</p>
          ) : (
            <div className="overflow-auto rounded-xl border border-outline-variant/30 bg-surface-container">
              <table className="w-full border-collapse text-xs">
                <thead className="sticky top-0 z-10 bg-surface-container-high">
                  <tr className="text-on-surface-variant">
                    <th className="px-3 py-2.5 text-left font-semibold">เลขที่</th>
                    <th className="px-3 py-2.5 text-left font-semibold">รหัสนักศึกษา</th>
                    <th className="px-3 py-2.5 text-left font-semibold">ชื่อ-สกุล</th>
                    {book.exams.map((e) => (
                      <th key={e.id} title={e.title} className="px-2 py-2.5 text-center font-semibold whitespace-nowrap">
                        {shortTitle(e.title)}
                        <span className="block text-[10px] font-normal text-outline">
                          เต็ม {e.totalQuestions}
                          {e.isHidden ? " · ซ่อน" : ""}
                          {e.sections ? ` · ${e.sections.length} ห้อง` : ""}
                        </span>
                      </th>
                    ))}
                    <th className="px-3 py-2.5 text-center font-semibold">สอบแล้ว</th>
                  </tr>
                </thead>
                <tbody>
                  {(room === "ALL" ? rooms : [room]).map((r) => {
                    const inRoom = students.filter((s) => (s.section ?? "ไม่ระบุห้อง") === r);
                    if (!inRoom.length) return null;
                    return (
                      <Fragment key={r}>
                        {room === "ALL" && (
                          <tr>
                            <td colSpan={book.exams.length + 4} className="bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary">
                              ห้อง {r} ({inRoom.length} คน)
                            </td>
                          </tr>
                        )}
                        {inRoom.map((s) => {
                          // Exams set for this student's room (or for every room).
                          const forRoom = (e: (typeof book.exams)[number]) => !e.sections || e.sections.includes(s.section ?? "");
                          const assigned = book.exams.filter(forRoom);
                          const done = assigned.filter((e) => latest(sittings.get(`${s.id}:${e.id}`))).length;
                          return (
                            <tr key={s.id} className="border-t border-outline-variant/20 hover:bg-surface-container-high/60">
                              <td className="px-3 py-1.5 text-on-surface-variant">{s.seatNumber}</td>
                              <td className="px-3 py-1.5 font-mono text-on-surface-variant whitespace-nowrap">{s.studentCode}</td>
                              <td className="px-3 py-1.5 text-on-surface whitespace-nowrap">{s.fullName}</td>
                              {book.exams.map((e) => {
                                const list = sittings.get(`${s.id}:${e.id}`);
                                const last = latest(list);
                                const running = list?.some((a) => !a.archivedAt && a.status === "IN_PROGRESS");
                                return (
                                  <td key={e.id} className="px-1 py-1 text-center">
                                    {list?.length ? (
                                      <button
                                        type="button"
                                        onClick={() => setDetail({ studentId: s.id, examId: e.id })}
                                        className={`min-w-[4.5rem] rounded-md px-2 py-1 font-mono font-bold ${
                                          running && !last
                                            ? "bg-tertiary/20 text-tertiary"
                                            : last?.passed
                                              ? "bg-secondary/20 text-secondary"
                                              : last
                                                ? "bg-error/20 text-error"
                                                : "bg-surface-container-highest text-outline"
                                        }`}
                                      >
                                        {last ? `${last.scorePoints ?? 0}/${e.totalQuestions}` : running ? "กำลังสอบ" : "รีเซ็ต"}
                                        {list.length > 1 && <span className="ml-1 text-[10px] font-normal opacity-80">×{list.length}</span>}
                                      </button>
                                    ) : forRoom(e) ? (
                                      <span className="text-outline/50">—</span>
                                    ) : (
                                      <span title="ชุดนี้ไม่ได้กำหนดให้ห้องนี้สอบ" className="text-[10px] text-outline/40">
                                        ไม่ใช่ห้องนี้
                                      </span>
                                    )}
                                  </td>
                                );
                              })}
                              <td className="px-3 py-1.5 text-center text-on-surface-variant">
                                {done}/{assigned.length}
                              </td>
                            </tr>
                          );
                        })}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Every sitting of one student on one exam */}
      {detail && detailStudent && detailExam && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4" onClick={() => setDetail(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-2xl rounded-2xl border border-outline-variant/40 bg-surface-container p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-on-surface">{detailStudent.fullName}</h2>
                <p className="text-xs text-on-surface-variant">
                  {detailStudent.studentCode} · {detailStudent.section} · {detailExam.title}
                </p>
              </div>
              <button type="button" onClick={() => setDetail(null)} className="text-on-surface-variant hover:text-on-surface">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <table className="mt-4 w-full text-xs">
              <thead className="text-on-surface-variant">
                <tr>
                  <th className="py-1.5 text-left">ครั้งที่</th>
                  <th className="py-1.5 text-left">เริ่ม</th>
                  <th className="py-1.5 text-left">ส่ง</th>
                  <th className="py-1.5 text-center">คะแนน</th>
                  <th className="py-1.5 text-center">ผล</th>
                  <th className="py-1.5 text-left">หมายเหตุ</th>
                  <th className="py-1.5 text-right">รีคะแนน</th>
                </tr>
              </thead>
              <tbody>
                {(sittings.get(`${detail.studentId}:${detail.examId}`) ?? []).map((a, i) => (
                  <tr key={a.id} className={`border-t border-outline-variant/20 ${a.archivedAt ? "text-outline line-through decoration-outline/40" : "text-on-surface"}`}>
                    <td className="py-1.5">{i + 1}</td>
                    <td className="py-1.5">{fmtDate(a.startedAt)}</td>
                    <td className="py-1.5">{fmtDate(a.submittedAt)}</td>
                    <td className="py-1.5 text-center font-mono font-bold">
                      {a.scorePoints ?? "-"}/{detailExam.totalQuestions}
                    </td>
                    <td className="py-1.5 text-center">
                      {a.status === "IN_PROGRESS" ? "กำลังสอบ" : a.passed ? "ผ่าน" : a.passed === false ? "ไม่ผ่าน" : "-"}
                    </td>
                    <td className="py-1.5 text-on-surface-variant no-underline">
                      {[
                        a.archivedAt && "ถูกรีเซ็ต (ไม่นับ)",
                        a.endedReason && ENDED_REASON_TH[a.endedReason],
                        a.violationCount > 0 && `ทุจริต ${a.violationCount} ครั้ง`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </td>
                    <td className="py-1.5 text-right">
                      {!a.archivedAt && a.status !== "IN_PROGRESS" && (
                        <button
                          type="button"
                          disabled={resetting}
                          onClick={() => resetSittings([a.id], `${detailStudent.fullName} ครั้งที่ ${i + 1} ของ ${detailExam.title}`)}
                          className="rounded-md border border-error/40 px-2 py-0.5 text-[11px] font-bold text-error hover:bg-error/10 disabled:opacity-50"
                        >
                          รีคะแนน
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {resetError && <p className="mt-3 text-xs text-error">{resetError}</p>}
            {(() => {
              const live = (sittings.get(`${detail.studentId}:${detail.examId}`) ?? []).filter((a) => !a.archivedAt && a.status !== "IN_PROGRESS");
              return live.length > 0 ? (
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    disabled={resetting}
                    onClick={() => resetSittings(live.map((a) => a.id), `${detailStudent.fullName} ทั้ง ${live.length} ครั้งของ ${detailExam.title}`)}
                    className="rounded-lg border border-error/40 bg-error/10 px-3 py-1.5 text-xs font-bold text-error hover:bg-error/20 disabled:opacity-50"
                  >
                    {resetting ? "กำลังรีคะแนน..." : "รีคะแนนชุดนี้ทั้งหมด"}
                  </button>
                </div>
              ) : null;
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

function Legend({ className, children }: { className: string; children: React.ReactNode }) {
  return <span className={`rounded px-1.5 py-0.5 font-semibold ${className}`}>{children}</span>;
}
