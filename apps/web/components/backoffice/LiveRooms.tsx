"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { OpenRoomDialog } from "./OpenRoomDialog";

export interface LiveExam {
  id: string;
  title: string;
  courseId: string;
  courseTitle: string;
  sections: string[] | null;
  durationMinutes: number;
  rooms: Array<{ room: string; students: number; inProgress: number; submitted: number }>;
}

/** "แบบทดสอบ บทที่ 7 เรื่อง …" → "บทที่ 7"; other titles shortened. */
export const chapterLabel = (title: string) => title.match(/บทที่\s*\d+|ใบเนื้อหาที่\s*\d+/)?.[0] ?? (title.length > 28 ? `${title.slice(0, 28)}…` : title);

/** Polls what is open now (every 5 s). `version` forces a reload after an open/close elsewhere on the page. */
export function useLiveExams(version: number) {
  const [live, setLive] = useState<LiveExam[] | null>(null);
  const load = useCallback(() => {
    apiFetch<LiveExam[]>("/api/exams/live/summary").then(setLive).catch(() => undefined);
  }, []);
  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load, version]);
  return { live, reload: load };
}

/**
 * The top of the back office: every room with the exams open for it now, and
 * every open exam with its rooms' progress — so with several chapters running
 * at once the proctor sees at a glance who is sitting what, and can close a
 * room from here.
 */
export function LiveRooms({ live, allRooms, onChanged }: { live: LiveExam[] | null; allRooms: string[]; onChanged: () => void }) {
  if (!live) return null;
  const openFor = (room: string) => live.filter((e) => !e.sections || e.sections.includes(room));

  return (
    <section className="space-y-3 rounded-2xl border border-outline-variant/30 bg-surface-container p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-bold text-on-surface">
          <span className={`h-2.5 w-2.5 rounded-full ${live.length ? "animate-pulse bg-emerald-400" : "bg-outline"}`} />
          สถานะห้องสอบตอนนี้
        </h2>
        <span className="text-xs text-on-surface-variant">
          {live.length ? `เปิดอยู่ ${live.length} ชุด` : "ยังไม่มีชุดที่เปิดสอบ"} · อัปเดตทุก 5 วินาที
        </span>
      </div>

      {/* Room by room: what each room can sit now */}
      {allRooms.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {allRooms.map((room) => {
            const exams = openFor(room);
            return (
              <div
                key={room}
                className={`rounded-xl border px-3 py-2.5 ${
                  exams.length ? "border-emerald-500/40 bg-emerald-500/10" : "border-outline-variant/30 bg-surface-container-lowest/60"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-on-surface">{room}</span>
                  <span className={`text-[11px] font-bold ${exams.length ? "text-emerald-400" : "text-outline"}`}>
                    {exams.length ? `กำลังเปิด ${exams.length} ชุด` : "ว่าง"}
                  </span>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {exams.length === 0 && <span className="text-[11px] text-outline">ไม่มีข้อสอบที่เปิดให้ห้องนี้</span>}
                  {exams.map((e) => {
                    const r = e.rooms.find((x) => x.room === room);
                    return (
                      <Link
                        key={e.id}
                        href={`/backoffice/exams/${e.id}/monitor`}
                        title={e.title}
                        className="rounded-md border border-emerald-500/40 bg-surface-container px-2 py-0.5 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/20"
                      >
                        {chapterLabel(e.title)}
                        {r ? ` · สอบ ${r.inProgress} ส่ง ${r.submitted}/${r.students}` : ""}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Exam by exam */}
      {live.length > 0 && (
        <div className="grid gap-2 lg:grid-cols-2">
          {live.map((e) => (
            <LiveExamRow key={e.id} exam={e} onChanged={onChanged} />
          ))}
        </div>
      )}
    </section>
  );
}

function LiveExamRow({ exam, onChanged }: { exam: LiveExam; onChanged: () => void }) {
  const students = exam.rooms.reduce((n, r) => n + r.students, 0);
  const inProgress = exam.rooms.reduce((n, r) => n + r.inProgress, 0);
  const submitted = exam.rooms.reduce((n, r) => n + r.submitted, 0);
  return (
    <div className="rounded-xl border border-emerald-500/30 bg-surface-container-lowest/60 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-on-surface" title={exam.title}>
            <span className="mr-1.5 inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-400 align-middle" />
            {exam.title}
          </p>
          <p className="truncate text-[11px] text-on-surface-variant">
            {exam.courseTitle} · {exam.durationMinutes} นาที · ห้อง: {exam.sections?.join(", ") ?? "ทุกห้อง"}
          </p>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <Link
            href={`/backoffice/exams/${exam.id}/monitor`}
            className="flex items-center gap-1 rounded-lg border border-primary/40 bg-primary/15 px-2.5 py-1.5 text-xs font-bold text-primary hover:bg-primary/25"
          >
            <span className="material-symbols-outlined text-sm">live_tv</span>
            คุมสอบ
          </Link>
          <CloseButton examId={exam.id} onDone={onChanged} />
        </div>
      </div>
      <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-surface-container-highest">
        <div className="bg-secondary" style={{ width: `${students ? (submitted / students) * 100 : 0}%` }} />
        <div className="bg-tertiary" style={{ width: `${students ? (inProgress / students) * 100 : 0}%` }} />
      </div>
      <p className="mt-1 text-[11px] text-on-surface-variant">
        <b className="text-tertiary">กำลังสอบ {inProgress}</b> · <b className="text-secondary">ส่งแล้ว {submitted}</b> · ทั้งหมด {students} คน
      </p>
    </div>
  );
}

/** Closes the room (hands in every paper still open); asks once more before doing it. */
export function CloseButton({ examId, onDone, size = "sm" }: { examId: string; onDone: () => void; size?: "sm" | "md" }) {
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      await apiFetch(`/api/exams/${examId}/status`, { method: "POST", body: JSON.stringify({ status: "CLOSED" }) });
      onDone();
    } finally {
      setBusy(false);
      setArmed(false);
    }
  };
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => (armed ? run() : setArmed(true))}
      onBlur={() => setArmed(false)}
      className={`flex items-center gap-1 rounded-lg border font-bold disabled:opacity-50 ${size === "md" ? "px-3 py-1.5 text-xs" : "px-2.5 py-1.5 text-xs"} ${
        armed ? "border-error bg-error text-white" : "border-error/40 bg-error/10 text-error hover:bg-error/20"
      }`}
    >
      <span className="material-symbols-outlined text-sm">lock</span>
      {busy ? "กำลังปิด..." : armed ? "ยืนยันปิด + ส่งทุกคน?" : "ปิดห้องสอบ"}
    </button>
  );
}

/** Opens the room from the exam list, asking rooms and minutes first. */
export function OpenButton({
  exam,
  rooms,
  onDone,
}: {
  exam: { id: string; title: string; durationMinutes: number; sections: string[] | null };
  rooms: string[];
  onDone: () => void;
}) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const open = async (minutes: number, sections: string[] | null) => {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/exams/${exam.id}/status`, {
        method: "POST",
        body: JSON.stringify({ status: "OPEN", durationMinutes: minutes, sections }),
      });
      setAsking(false);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "เปิดไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <button
        type="button"
        onClick={() => setAsking(true)}
        title={error ?? undefined}
        className="flex items-center gap-1 rounded-lg border border-secondary/40 bg-secondary/15 px-3 py-1.5 text-xs font-bold text-secondary hover:bg-secondary/25"
      >
        <span className="material-symbols-outlined text-sm">lock_open</span>
        เปิดห้องสอบ
      </button>
      {asking && (
        <OpenRoomDialog
          examTitle={exam.title}
          currentMinutes={exam.durationMinutes}
          rooms={rooms}
          currentRooms={exam.sections}
          busy={busy}
          onCancel={() => setAsking(false)}
          onOpen={open}
        />
      )}
    </>
  );
}
