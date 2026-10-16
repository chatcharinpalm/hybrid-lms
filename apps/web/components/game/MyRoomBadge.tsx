"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { programOf, programTheme } from "@/lib/program";

interface Me {
  fullName: string;
  studentCode: string | null;
  section: string | null;
}

/**
 * The student's programme and room as a big banner in the programme's own
 * colour (CED ember orange, TCT electric blue), so a student always knows
 * whose exams they are looking at — only their room's are listed.
 */
export function MyRoomBadge() {
  const [me, setMe] = useState<Me | null>(null);
  useEffect(() => {
    apiFetch<Me>("/api/students/me")
      .then(setMe)
      .catch(() => undefined);
  }, []);
  if (!me?.section) return null;
  const code = programOf(me.section);
  const t = programTheme(code);
  return (
    <div
      className="relative mx-auto flex max-w-3xl items-center gap-4 overflow-hidden rounded-2xl border-2 px-5 py-4 sm:gap-6 sm:px-7"
      style={{
        borderColor: `${t.accent}aa`,
        background: `linear-gradient(110deg, ${t.from}55, ${t.to}88), #0d050c`,
        boxShadow: `0 0 30px ${t.accent}33, inset 0 1px 0 rgba(255,255,255,0.15)`,
      }}
    >
      <span className="material-symbols-outlined pointer-events-none absolute -right-4 -top-6 opacity-15" style={{ fontSize: 150, color: t.accent }}>
        {t.icon}
      </span>
      <span
        className="shrink-0 font-display text-5xl font-black italic tracking-wider text-white sm:text-6xl"
        style={{ textShadow: `0 3px 0 #000, 0 0 24px ${t.accent}` }}
      >
        {code}
      </span>
      <span className="relative min-w-0">
        <span className="block text-xs text-white/70">ห้องสอบของคุณ</span>
        <span className="block truncate text-xl font-bold text-white sm:text-2xl">ห้อง {me.section}</span>
        <span className="block truncate text-xs text-white/75">
          {me.fullName}
          {me.studentCode ? ` · ${me.studentCode}` : ""} — แสดงเฉพาะข้อสอบของห้องนี้
        </span>
      </span>
    </div>
  );
}
