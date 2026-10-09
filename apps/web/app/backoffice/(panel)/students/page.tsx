"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

interface RosterStudent {
  id: string;
  seatNumber: number;
  studentCode: string | null;
  fullName: string;
  accessCode: string | null;
}
interface Roster {
  sections: Array<{ name: string; students: RosterStudent[] }>;
}

type PrintMode = "sheet" | "slips" | null;

/**
 * Class lists, ก–ฮ, one room at a time, with each student's exam access code.
 *
 * On exam day: print the sign-in sheet (no codes on it) and the code slips;
 * hand a student their slip only after they sign, so nobody absent can sign
 * in. "สุ่มรหัสใหม่ทั้งห้อง" before an exam voids every slip from last time.
 */
export default function StudentsPage() {
  const [roster, setRoster] = useState<Roster | null>(null);
  const [section, setSection] = useState<string | null>(null);
  const [showCodes, setShowCodes] = useState(false);
  const [confirmAll, setConfirmAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [printMode, setPrintMode] = useState<PrintMode>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    const r = await apiFetch<Roster>("/api/students/roster");
    setRoster(r);
    setSection((s) => s ?? r.sections[0]?.name ?? null);
  }, []);
  useEffect(() => {
    load().catch((e) => setNotice(e instanceof Error ? e.message : "โหลดรายชื่อไม่สำเร็จ"));
  }, [load]);

  // Print once the chosen layout is on the page, then put the screen back.
  useEffect(() => {
    if (!printMode) return;
    const done = () => setPrintMode(null);
    window.addEventListener("afterprint", done, { once: true });
    const t = setTimeout(() => window.print(), 50);
    return () => {
      clearTimeout(t);
      window.removeEventListener("afterprint", done);
    };
  }, [printMode]);

  const current = roster?.sections.find((s) => s.name === section) ?? null;
  const q = search.trim().toLowerCase();
  const rows = (current?.students ?? []).filter(
    (s) => !q || s.fullName.toLowerCase().includes(q) || (s.studentCode ?? "").includes(q)
  );

  const flash = (text: string) => {
    setNotice(text);
    setTimeout(() => setNotice(null), 4000);
  };

  const regenerateOne = async (s: RosterStudent) => {
    setBusy(true);
    try {
      const r = await apiFetch<{ accessCode: string }>(`/api/students/${s.id}/access-code`, { method: "POST" });
      flash(`${s.fullName}: รหัสใหม่ ${r.accessCode} (รหัสเดิมใช้ไม่ได้แล้ว)`);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const regenerateAll = async () => {
    if (!current) return;
    setBusy(true);
    try {
      const r = await apiFetch<{ count: number }>("/api/students/access-codes", {
        method: "POST",
        body: JSON.stringify({ section: current.name }),
      });
      setConfirmAll(false);
      flash(`ห้อง ${current.name}: สุ่มรหัสใหม่ ${r.count} คนแล้ว — พิมพ์สลิปใหม่ก่อนแจก`);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const btn =
    "flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors disabled:opacity-40";

  return (
    <div className="space-y-5">
      <div className="print:hidden space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-outline-variant/30 pb-4">
          <div>
            <h1 className="text-xl font-bold text-on-surface">รายชื่อนักศึกษา & รหัสเข้าสอบ</h1>
            <p className="mt-0.5 text-xs text-on-surface-variant">
              เรียงตาม ก–ฮ · นักศึกษาเข้าระบบด้วยรหัสนักศึกษา + รหัสเข้าสอบ · แจกสลิปรหัสหลังเซ็นชื่อแล้วเท่านั้น
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!current}
              onClick={() => setPrintMode("sheet")}
              className={`${btn} border-primary/40 bg-primary/10 text-primary hover:bg-primary/20`}
            >
              <span className="material-symbols-outlined text-sm">draw</span>
              พิมพ์ใบเซ็นชื่อ
            </button>
            <button
              type="button"
              disabled={!current}
              onClick={() => setPrintMode("slips")}
              className={`${btn} border-secondary/40 bg-secondary/10 text-secondary hover:bg-secondary/20`}
            >
              <span className="material-symbols-outlined text-sm">content_cut</span>
              พิมพ์สลิปรหัส (ตัดแจก)
            </button>
            <button
              type="button"
              disabled={!current || busy}
              onClick={() => (confirmAll ? regenerateAll() : setConfirmAll(true))}
              onBlur={() => setConfirmAll(false)}
              className={`${btn} ${
                confirmAll ? "border-error bg-error text-white" : "border-error/40 bg-error/10 text-error hover:bg-error/20"
              }`}
            >
              <span className="material-symbols-outlined text-sm">lock_reset</span>
              {confirmAll ? `ยืนยันสุ่มใหม่ทั้งห้อง ${current?.name}?` : "สุ่มรหัสใหม่ทั้งห้อง"}
            </button>
          </div>
        </div>

        {notice && (
          <div className="flex items-center gap-2 rounded-xl border border-primary/40 bg-primary/10 p-3 text-xs text-on-surface">
            <span className="material-symbols-outlined text-sm text-primary">info</span>
            {notice}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-xl border border-outline-variant/30 bg-surface-container p-1">
            {roster?.sections.map((s) => (
              <button
                key={s.name}
                type="button"
                onClick={() => setSection(s.name)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                  section === s.name ? "bg-primary text-on-primary" : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                {s.name} <span className="font-mono opacity-70">({s.students.length})</span>
              </button>
            ))}
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหาชื่อหรือรหัส..."
            className="min-w-[200px] flex-1 rounded-xl border border-outline-variant/30 bg-surface-container-lowest px-3 py-2 text-xs text-on-surface focus:border-primary focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setShowCodes(!showCodes)}
            className={`${btn} border-outline-variant/40 bg-surface-container text-on-surface`}
          >
            <span className="material-symbols-outlined text-sm">{showCodes ? "visibility_off" : "visibility"}</span>
            {showCodes ? "ซ่อนรหัส" : "แสดงรหัส"}
          </button>
        </div>

        <div className="overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-outline-variant/30 bg-surface-container-highest/60 text-[11px] text-outline">
              <tr>
                <th className="w-16 px-4 py-2.5 text-center">เลขที่</th>
                <th className="px-3 py-2.5">รหัสนักศึกษา</th>
                <th className="px-3 py-2.5">ชื่อ - สกุล</th>
                <th className="px-3 py-2.5">รหัสเข้าสอบ</th>
                <th className="px-3 py-2.5 text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {rows.map((s) => (
                <tr key={s.id} className="hover:bg-surface-container-high/50">
                  <td className="px-4 py-2 text-center font-mono text-outline">{s.seatNumber}</td>
                  <td className="px-3 py-2 font-mono text-xs text-on-surface-variant">{s.studentCode}</td>
                  <td className="px-3 py-2 font-medium text-on-surface">{s.fullName}</td>
                  <td className="px-3 py-2 font-mono text-base font-bold tracking-[0.2em] text-secondary">
                    {showCodes ? s.accessCode : "••••••"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => regenerateOne(s)}
                      title="ใช้เมื่อนักศึกษาทำสลิปหาย หรือรหัสรั่ว"
                      className="rounded-lg border border-outline-variant/40 px-2.5 py-1 text-[11px] text-on-surface-variant hover:border-error hover:text-error disabled:opacity-40"
                    >
                      สุ่มรหัสใหม่
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Print layouts (only one is on the page at a time). */}
      {current && printMode && (
        <div id="print-area" className="hidden print:block">
          {printMode === "sheet" ? <SignInSheet section={current.name} students={current.students} /> : <CodeSlips section={current.name} students={current.students} />}
        </div>
      )}
    </div>
  );
}

function SignInSheet({ section, students }: { section: string; students: RosterStudent[] }) {
  return (
    <div className="font-paper text-[15pt] leading-tight text-black">
      <div className="mb-3 text-center">
        <div className="text-[18pt] font-bold">ใบเซ็นชื่อเข้าสอบ</div>
        <div>ห้อง {section} · จำนวน {students.length} คน</div>
        <div className="mt-1">
          รายวิชา ........................................................ แบบทดสอบ ........................................ วันที่ ....................
        </div>
      </div>
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {["เลขที่", "รหัสนักศึกษา", "ชื่อ - สกุล", "ลายเซ็น"].map((h) => (
              <th key={h} className="border border-black px-2 py-1 font-bold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {students.map((s) => (
            <tr key={s.id} className="break-inside-avoid">
              <td className="w-[12mm] border border-black px-2 py-1 text-center">{s.seatNumber}</td>
              <td className="w-[42mm] border border-black px-2 py-1">{s.studentCode}</td>
              <td className="border border-black px-2 py-1">{s.fullName}</td>
              <td className="w-[45mm] border border-black px-2 py-1" />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CodeSlips({ section, students }: { section: string; students: RosterStudent[] }) {
  const loginUrl = typeof window !== "undefined" ? `${window.location.origin}/login` : "/login";
  return (
    <div className="grid grid-cols-3 font-paper text-black">
      {students.map((s) => (
        <div key={s.id} className="break-inside-avoid border border-dashed border-black/60 px-3 py-2 text-[12pt] leading-snug">
          <div className="flex justify-between text-[10pt]">
            <span>ห้อง {section}</span>
            <span>เลขที่ {s.seatNumber}</span>
          </div>
          <div className="truncate font-bold">{s.fullName}</div>
          <div className="text-[11pt]">รหัสนักศึกษา {s.studentCode}</div>
          <div className="my-1 rounded border-2 border-black py-0.5 text-center font-mono text-[20pt] font-bold tracking-[0.25em]">
            {s.accessCode}
          </div>
          <div className="text-[9pt]">เข้าสอบที่ {loginUrl}</div>
        </div>
      ))}
    </div>
  );
}
