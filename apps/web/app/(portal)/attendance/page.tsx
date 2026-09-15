"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { isLoggedIn, loginUrl } from "@/lib/auth";

export default function AttendancePage() {
  const [sessionId, setSessionId] = useState("");
  const [token, setToken] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    setLoggedIn(isLoggedIn());
  }, []);

  const checkInOnsite = async () => {
    setStatus(null);
    try {
      await apiFetch(`/api/attendance/sessions/${sessionId}/check-in/onsite`, {
        method: "POST",
        body: JSON.stringify({ token }),
      });
      setStatus("เช็คชื่อสำเร็จ (Onsite)");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "เช็คชื่อไม่สำเร็จ");
    }
  };

  const checkInOnline = async () => {
    setStatus(null);
    try {
      await apiFetch(`/api/attendance/sessions/${sessionId}/check-in/online`, { method: "POST" });
      setStatus("เช็คชื่อสำเร็จ (Online)");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "เช็คชื่อไม่สำเร็จ");
    }
  };

  if (loggedIn === null) return null;

  if (!loggedIn) {
    return (
      <div className="max-w-md rounded-lg border border-outline-variant/40 bg-surface-container p-8 text-center space-y-4">
        <span className="material-symbols-outlined text-4xl text-primary">lock</span>
        <h1 className="text-sm font-semibold text-on-surface">กรุณาเข้าสู่ระบบเพื่อเช็คชื่อ</h1>
        <p className="text-xs text-on-surface-variant leading-relaxed">
          การเช็คชื่อต้องผูกกับบัญชีนักเรียนเพื่อบันทึกการเข้าเรียนรายบุคคล
        </p>
        <Link
          href={loginUrl("/attendance")}
          className="inline-block px-5 py-2.5 rounded bg-primary text-on-primary font-semibold text-sm hover:opacity-90 transition-opacity"
        >
          เข้าสู่ระบบ
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-base font-semibold text-on-surface">เช็คชื่อเข้าเรียน (Hybrid Attendance)</h1>
        <p className="text-xs text-outline">
          สแกน QR Code สำหรับผู้เรียน Onsite หรือกดเข้าร่วมสำหรับผู้เรียนออนไลน์
        </p>
      </div>

      <div className="rounded-xl border border-outline-variant/30 bg-surface-container p-5 space-y-4">
        <div>
          <label className="text-xs text-on-surface-variant block mb-1">Session ID</label>
          <input
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
            placeholder="class-session-uuid"
            className="w-full px-3 py-2 rounded bg-surface-container-lowest border border-outline-variant/40 font-mono text-xs text-on-surface focus:outline-none focus:border-primary"
          />
        </div>

        <div>
          <label className="text-xs text-on-surface-variant block mb-1">
            QR Token (สแกนจากหน้าจอในห้องเรียน)
          </label>
          <input
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="e.g. a1b2c3d4e5"
            className="w-full px-3 py-2 rounded bg-surface-container-lowest border border-outline-variant/40 font-mono text-xs text-on-surface focus:outline-none focus:border-primary"
          />
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={checkInOnsite}
            className="flex-1 py-2 rounded bg-surface-container-high border border-outline-variant/40 text-on-surface text-xs font-medium hover:bg-surface-bright transition-colors flex items-center justify-center gap-1.5"
          >
            <span className="material-symbols-outlined text-base">qr_code_scanner</span>
            เช็คชื่อ Onsite
          </button>
          <button
            type="button"
            onClick={checkInOnline}
            className="flex-1 py-2 rounded bg-primary text-on-primary text-xs font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5"
          >
            <span className="material-symbols-outlined text-base">videocam</span>
            เข้าร่วมออนไลน์
          </button>
        </div>

        {status && <p className="text-xs text-on-surface-variant">{status}</p>}
      </div>

      <p className="text-[11px] text-outline leading-relaxed">
        หมายเหตุ: ระบบสร้าง QR Token แบบหมุนเวียนทุก 30 วินาทีจาก endpoint{" "}
        <code className="font-mono">GET /api/attendance/sessions/:sessionId/qr-token</code> ซึ่งผู้สอนเปิดแสดงบนจอในห้องเรียน
      </p>
    </div>
  );
}
