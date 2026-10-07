"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { RowActions, StudentControls } from "@/components/backoffice/StudentControls";

interface ProctorStudent {
  studentId: string;
  fullName: string;
  email: string;
  studentCode: string;
  faculty: string;
  major: string;
  avatarUrl?: string | null;
  status: "NOT_STARTED" | "IN_PROGRESS" | "SUBMITTED" | "AUTO_SUBMITTED";
  endedReason: string | null;
  questionSecondsLeft: number | null;
  attemptId: string | null;
  startedAt: string | null;
  submittedAt: string | null;
  currentQuestionIndex: number;
  answeredCount: number;
  totalQuestions: number;
  violationCount: number;
  scorePoints: number | null;
  scorePercent: number | null;
  passed: boolean | null;
  violations: Array<{
    id: string;
    type: string;
    occurredAt: string;
    detail: any;
  }>;
}

interface ProctorData {
  exam: {
    id: string;
    title: string;
    totalQuestions: number;
    durationMinutes: number;
    timePerQuestionSeconds: number | null;
    maxViolations: number;
    status: string;
  };
  students: ProctorStudent[];
  recentViolations: Array<{
    id: string;
    studentName: string;
    studentCode: string;
    type: string;
    occurredAt: string;
    questionNumber: number;
    detail: any;
  }>;
  summary: {
    totalStudents: number;
    inProgress: number;
    submitted: number;
    autoSubmitted: number;
    notStarted: number;
    violatorCount: number;
  };
}

const ENDED_REASON_TH: Record<string, string> = {
  STUDENT: "ผู้สอบกดส่งเอง",
  TIMEOUT: "หมดเวลา",
  VIOLATIONS: "โกงครบกำหนด",
  ADMIN_FORCED: "ผู้คุมสอบสั่งส่ง",
  EXAM_CLOSED: "ปิดห้องสอบ",
};

const AUDIT_ACTION_TH: Record<string, string> = {
  EXAM_OPEN: "เปิดห้องสอบ",
  EXAM_CLOSED: "ปิดห้องสอบ",
  ATTEMPT_FORCE_SUBMIT: "บังคับส่ง",
  ATTEMPT_RESET: "รีเซ็ตให้สอบใหม่",
  ATTEMPT_FORGIVE_VIOLATIONS: "ล้างการโกง",
  ATTEMPT_ADD_TIME: "เพิ่มเวลา",
  ATTEMPT_MESSAGE: "ส่งข้อความเตือน",
};

interface AuditEntry {
  id: string;
  action: string;
  actorName: string;
  createdAt: string;
  metadata: Record<string, unknown> | null;
}

const VIOLATION_TRANSLATION: Record<string, string> = {
  TAB_HIDDEN: "สลับแท็บ / ย่อหน้าต่าง",
  WINDOW_BLUR: "คลิกออกนอกหน้าต่างสอบ",
  FULLSCREEN_EXIT: "ออกจากโหมดเต็มหน้าจอ",
  COPY_ATTEMPT: "พยายามคัดลอกข้อความ (Copy)",
  PASTE_ATTEMPT: "พยายามวางข้อความ (Paste)",
  CUT_ATTEMPT: "พยายามตัดข้อความ (Cut)",
  CONTEXT_MENU_ATTEMPT: "เปิดเมนูคลิกขวา",
  DEVTOOLS_SHORTCUT: "พยายามเปิด DevTools / F12",
  PRINT_SCREEN: "พยายามจับภาพหน้าจอ",
  MULTIPLE_DISPLAYS_DETECTED: "ต่อจอภาพหลายจอ",
};

export default function LiveProctorPage() {
  const { examId } = useParams<{ examId: string }>();
  const router = useRouter();

  const [data, setData] = useState<ProctorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmStatus, setConfirmStatus] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const [lastViolationAlert, setLastViolationAlert] = useState<{
    studentName: string;
    studentCode: string;
    type: string;
    questionNumber: number;
    time: string;
  } | null>(null);

  const prevViolationsCountRef = useRef<number>(0);

  const fetchData = useCallback(async () => {
    try {
      const [res, audit] = await Promise.all([
        apiFetch<ProctorData>(`/api/exams/${examId}/proctor`),
        apiFetch<AuditEntry[]>(`/api/exams/${examId}/audit`).catch(() => [] as AuditEntry[]),
      ]);
      setData(res);
      setAuditLog(audit);
      setError(null);

      // Check if new violation occurred since last fetch
      if (res.recentViolations.length > 0) {
        const latest = res.recentViolations[0];
        const latestTime = new Date(latest.occurredAt).getTime();
        const now = Date.now();

        // If occurred within last 20 seconds and count changed
        if (
          now - latestTime < 30000 &&
          res.recentViolations.length > prevViolationsCountRef.current
        ) {
          setLastViolationAlert({
            studentName: latest.studentName,
            studentCode: latest.studentCode,
            type: VIOLATION_TRANSLATION[latest.type] || latest.type,
            questionNumber: latest.questionNumber,
            time: new Date(latest.occurredAt).toLocaleTimeString("th-TH"),
          });
        }
      }
      prevViolationsCountRef.current = res.recentViolations.length;
    } catch (err: any) {
      setError(err.message || "Failed to load live proctoring data");
    } finally {
      setLoading(false);
    }
  }, [examId]);

  useEffect(() => {
    fetchData();

    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchData();
    }, 3000); // 3-second live refresh

    return () => clearInterval(interval);
  }, [examId, autoRefresh, fetchData]);

  const showNotice = (text: string) => {
    setNotice(text);
    setTimeout(() => setNotice(null), 4000);
    fetchData();
  };

  const toggleExamStatus = async (next: "OPEN" | "CLOSED") => {
    setStatusBusy(true);
    try {
      const r = await apiFetch<{ submitted: number }>(`/api/exams/${examId}/status`, {
        method: "POST",
        body: JSON.stringify({ status: next }),
      });
      setConfirmStatus(false);
      showNotice(next === "OPEN" ? "เปิดห้องสอบแล้ว" : `ปิดห้องสอบแล้ว (ส่งข้อสอบอัตโนมัติ ${r.submitted} คน)`);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "ทำรายการไม่สำเร็จ");
    } finally {
      setStatusBusy(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="min-h-[500px] flex items-center justify-center text-on-surface-variant text-sm">
        <span className="material-symbols-outlined text-2xl animate-spin mr-2 text-primary">
          sync
        </span>
        กำลังเชื่อมต่อระบบฐานข้อมูลคุมสอบสด (Live Proctoring)...
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="p-6 rounded-xl border border-error/40 bg-surface-container max-w-lg mx-auto text-center space-y-3">
        <span className="material-symbols-outlined text-3xl text-error">error</span>
        <h2 className="text-sm font-semibold text-on-surface">เกิดข้อผิดพลาดในการโหลดข้อมูล</h2>
        <p className="text-xs text-on-surface-variant">{error}</p>
        <button
          onClick={fetchData}
          className="px-4 py-2 rounded-lg bg-primary text-on-primary text-xs font-medium"
        >
          ลองใหม่อีกครั้ง
        </button>
      </div>
    );
  }

  if (!data) return null;

  const selectedStudent = data.students.find((s) => s.studentId === selectedStudentId) ?? null;
  const nameById = new Map(data.students.map((s) => [s.studentId, `(${s.studentCode}) ${s.fullName}`]));
  const perQuestionMinutes = data.exam.timePerQuestionSeconds ? data.exam.timePerQuestionSeconds / 60 : null;
  const examOpen = data.exam.status === "OPEN";

  // Filter students
  const filteredStudents = data.students.filter((s) => {
    const matchesSearch =
      s.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.studentCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.email.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (statusFilter === "ALL") return true;
    if (statusFilter === "IN_PROGRESS") return s.status === "IN_PROGRESS";
    if (statusFilter === "SUBMITTED") return s.status === "SUBMITTED" || s.status === "AUTO_SUBMITTED";
    if (statusFilter === "VIOLATION") return s.violationCount > 0;
    if (statusFilter === "NOT_STARTED") return s.status === "NOT_STARTED";
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-outline-variant/30 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-primary/10 text-primary border border-primary/30">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              LIVE PROCTORING
            </span>
            <span className="text-xs font-mono text-outline">
              XAMPP MySQL: hybrid_lms
            </span>
          </div>
          <h1 className="text-xl font-bold text-on-surface mt-1">
            ห้องควบคุมการสอบสด (Live Proctor Dashboard)
          </h1>
          <p className="text-xs text-on-surface-variant mt-0.5">
            {data.exam.title} • จำนวน {data.exam.totalQuestions} ข้อ
            {perQuestionMinutes ? ` • จำกัดเวลาข้อละ ${perQuestionMinutes} นาที` : ""}
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${
              examOpen
                ? "bg-secondary/15 text-secondary border-secondary/40"
                : "bg-surface-container-highest text-outline border-outline-variant/30"
            }`}
          >
            {examOpen ? "● ห้องสอบเปิดอยู่" : "ห้องสอบปิด"}
          </span>
          {examOpen ? (
            <button
              type="button"
              disabled={statusBusy}
              onClick={() => (confirmStatus ? toggleExamStatus("CLOSED") : setConfirmStatus(true))}
              onBlur={() => setConfirmStatus(false)}
              className={`px-3 py-2 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition-colors disabled:opacity-50 ${
                confirmStatus
                  ? "bg-error text-white border-error"
                  : "bg-error/10 text-error border-error/40 hover:bg-error/20"
              }`}
            >
              <span className="material-symbols-outlined text-sm">lock</span>
              {confirmStatus ? "ยืนยันปิดและส่งข้อสอบทุกคน?" : "ปิดห้องสอบ"}
            </button>
          ) : (
            <button
              type="button"
              disabled={statusBusy}
              onClick={() => toggleExamStatus("OPEN")}
              className="px-3 py-2 rounded-xl text-xs font-bold border flex items-center gap-1.5 bg-secondary/15 text-secondary border-secondary/40 hover:bg-secondary/25 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-sm">lock_open</span>
              เปิดห้องสอบ
            </button>
          )}
          <button
            type="button"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-2 rounded-xl text-xs font-medium border flex items-center gap-1.5 transition-colors ${
              autoRefresh
                ? "bg-secondary/15 text-secondary border-secondary/40"
                : "bg-surface-container text-on-surface-variant border-outline-variant/30"
            }`}
          >
            <span className={`material-symbols-outlined text-sm ${autoRefresh ? "animate-spin" : ""}`}>
              sync
            </span>
            <span>{autoRefresh ? "อัปเดตอัตโนมัติ (3 วิ)" : "หยุดอัปเดตชั่วคราว"}</span>
          </button>

          <button
            type="button"
            onClick={fetchData}
            className="px-3 py-2 rounded-xl text-xs font-medium bg-surface-container hover:bg-surface-container-high border border-outline-variant/30 text-on-surface flex items-center gap-1.5 transition-colors"
          >
            <span className="material-symbols-outlined text-sm">refresh</span>
            <span>รีเฟรชข้อมูล</span>
          </button>

          <Link
            href="/backoffice"
            className="px-3 py-2 rounded-xl text-xs font-medium bg-surface-container border border-outline-variant/30 text-on-surface-variant hover:text-on-surface transition-colors"
          >
            กลับสู่แดชบอร์ด
          </Link>
        </div>
      </div>

      {notice && (
        <div className="p-3 rounded-xl bg-primary/10 border border-primary/40 text-xs text-on-surface flex items-center gap-2">
          <span className="material-symbols-outlined text-sm text-primary">info</span>
          {notice}
        </div>
      )}

      {/* Real-time Cheating Alarm Banner */}
      {lastViolationAlert && (
        <div className="p-4 rounded-xl bg-gradient-to-r from-error/25 to-amber-500/20 border-2 border-error/60 text-on-surface shadow-lg shadow-error/10 flex items-start justify-between gap-3 animate-bounce">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-error flex items-center justify-center text-white shrink-0 shadow">
              <span className="material-symbols-outlined text-xl">gpp_bad</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-error uppercase tracking-wider">
                  ⚠️ ตรวจพบพฤติกรรมส่อทุจริตแบบเรียลไทม์!
                </span>
                <span className="text-[11px] font-mono text-outline">
                  {lastViolationAlert.time}
                </span>
              </div>
              <p className="text-sm font-semibold text-on-surface mt-0.5">
                นักศึกษา: <strong className="text-error">{lastViolationAlert.studentName}</strong> ({lastViolationAlert.studentCode})
              </p>
              <p className="text-xs text-on-surface-variant mt-0.5">
                เหตุการณ์: <span className="font-semibold text-amber-300">{lastViolationAlert.type}</span> ขณะกำลังทำ <strong className="text-primary font-mono">ข้อที่ {lastViolationAlert.questionNumber}</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setLastViolationAlert(null)}
            className="text-outline hover:text-on-surface p-1"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="p-4 rounded-xl bg-surface-container border border-outline-variant/30">
          <div className="flex items-center justify-between text-outline text-xs">
            <span>นักศึกษาทั้งหมด</span>
            <span className="material-symbols-outlined text-base">groups</span>
          </div>
          <div className="text-2xl font-bold font-mono text-on-surface mt-2">
            {data.summary.totalStudents} <span className="text-xs font-normal text-outline">คน</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-surface-container border border-primary/30">
          <div className="flex items-center justify-between text-primary text-xs">
            <span>กำลังสอบอยู่</span>
            <span className="material-symbols-outlined text-base animate-pulse">pending</span>
          </div>
          <div className="text-2xl font-bold font-mono text-primary mt-2">
            {data.summary.inProgress} <span className="text-xs font-normal text-outline">คน</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-surface-container border border-secondary/30">
          <div className="flex items-center justify-between text-secondary text-xs">
            <span>ส่งข้อสอบแล้ว</span>
            <span className="material-symbols-outlined text-base">task_alt</span>
          </div>
          <div className="text-2xl font-bold font-mono text-secondary mt-2">
            {data.summary.submitted} <span className="text-xs font-normal text-outline">คน</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-surface-container border border-error/40">
          <div className="flex items-center justify-between text-error text-xs">
            <span>ถูกปรับส่ง/ทุจริต</span>
            <span className="material-symbols-outlined text-base">gpp_bad</span>
          </div>
          <div className="text-2xl font-bold font-mono text-error mt-2">
            {data.summary.autoSubmitted} <span className="text-xs font-normal text-outline">คน</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-surface-container border border-amber-500/40">
          <div className="flex items-center justify-between text-amber-400 text-xs">
            <span>พบประวัติการโกง</span>
            <span className="material-symbols-outlined text-base">shield_alert</span>
          </div>
          <div className="text-2xl font-bold font-mono text-amber-400 mt-2">
            {data.summary.violatorCount} <span className="text-xs font-normal text-outline">คน</span>
          </div>
        </div>
      </div>

      {/* Main Content Layout: Table & Realtime Violation Ticker */}
      <div className="grid grid-cols-1 2xl:grid-cols-12 gap-6">
        {/* Left Column: Student Monitor Table (8 cols) */}
        <div className="2xl:col-span-8 space-y-4">
          {/* Filters & Search */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-surface-container p-3.5 rounded-xl border border-outline-variant/30">
            <div className="relative flex-1">
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-outline text-sm">
                search
              </span>
              <input
                type="text"
                placeholder="ค้นหาชื่อ, รหัสนักศึกษา, อีเมล..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-surface-container-lowest border border-outline-variant/30 text-xs text-on-surface placeholder:text-outline focus:outline-none focus:border-primary font-mono"
              />
            </div>

            <div className="flex items-center gap-1 overflow-x-auto">
              {[
                { id: "ALL", label: "ทั้งหมด" },
                { id: "IN_PROGRESS", label: "กำลังสอบ" },
                { id: "SUBMITTED", label: "ส่งแล้ว" },
                { id: "VIOLATION", label: "มีประวัติโกง" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                    statusFilter === tab.id
                      ? "bg-primary text-on-primary shadow-sm"
                      : "bg-surface-container-lowest text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Student Grid Table */}
          <div className="rounded-xl border border-outline-variant/30 bg-surface-container overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-container-highest/60 text-outline border-b border-outline-variant/30 text-[11px] uppercase tracking-wider font-mono">
                  <tr>
                    <th className="py-3 px-4">รหัส / นักศึกษา</th>
                    <th className="py-3 px-3">สถานะ</th>
                    <th className="py-3 px-3">ความคืบหน้า (ทำถึงข้อไหน)</th>
                    <th className="py-3 px-3">คะแนน</th>
                    <th className="py-3 px-3 text-center">การฝ่าฝืน</th>
                    <th className="py-3 px-3 text-right">การจัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/20">
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-outline">
                        ไม่พบข้อมูลนักศึกษาตามเงื่อนไขที่เลือก
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((s) => {
                      const isViolator = s.violationCount > 0;
                      const isAutoSubmitted = s.status === "AUTO_SUBMITTED";
                      const currentQNum = s.currentQuestionIndex + 1;
                      const progressPercent = Math.min(
                        Math.round((s.answeredCount / s.totalQuestions) * 100),
                        100
                      );

                      return (
                        <tr
                          key={s.studentId}
                          className={`hover:bg-surface-container-high/50 transition-colors ${
                            isAutoSubmitted
                              ? "bg-error/5"
                              : isViolator
                              ? "bg-amber-500/5"
                              : ""
                          }`}
                        >
                          {/* Student Info */}
                          <td className="py-3 px-4">
                            <div className="font-semibold text-on-surface flex items-center gap-2">
                              <span>{s.fullName}</span>
                              {isViolator && (
                                <span className="material-symbols-outlined text-xs text-amber-400">
                                  warning
                                </span>
                              )}
                            </div>
                            <div className="font-mono text-[11px] text-outline mt-0.5">
                              {s.studentCode} • {s.major}
                            </div>
                          </td>

                          {/* Status Badge */}
                          <td className="py-3 px-3 whitespace-nowrap">
                            {s.status === "NOT_STARTED" && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-surface-container-highest text-outline border border-outline-variant/30">
                                ยังไม่เริ่ม
                              </span>
                            )}
                            {s.status === "IN_PROGRESS" && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-primary/15 text-primary border border-primary/30 flex items-center gap-1 w-max">
                                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
                                กำลังสอบ
                              </span>
                            )}
                            {s.status === "SUBMITTED" && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-secondary/15 text-secondary border border-secondary/30">
                                ส่งแล้ว
                              </span>
                            )}
                            {s.status === "AUTO_SUBMITTED" && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-error/20 text-error border border-error/40 font-bold">
                                ถูกปรับตก / ส่งอัตโนมัติ
                              </span>
                            )}
                            {s.endedReason && (
                              <div className="text-[10px] text-outline mt-1">
                                {ENDED_REASON_TH[s.endedReason] ?? s.endedReason}
                              </div>
                            )}
                          </td>

                          {/* Progress: Current Question */}
                          <td className="py-3 px-3 min-w-[150px]">
                            {s.status === "NOT_STARTED" ? (
                              <span className="text-outline text-[11px]">-</span>
                            ) : (
                              <div>
                                <div className="flex items-center justify-between text-[11px] mb-1">
                                  <span className="font-mono font-bold text-primary">
                                    {s.status === "IN_PROGRESS"
                                      ? `ข้อที่ ${currentQNum} / ${s.totalQuestions}`
                                      : `เสร็จสิ้น (${s.answeredCount}/${s.totalQuestions})`}
                                  </span>
                                  <span className="text-[10px] text-outline font-mono">
                                    {s.questionSecondsLeft !== null
                                      ? `เหลือ ${Math.floor(s.questionSecondsLeft / 60)}:${String(s.questionSecondsLeft % 60).padStart(2, "0")}`
                                      : `${progressPercent}%`}
                                  </span>
                                </div>
                                <div className="w-full h-1.5 rounded-full bg-surface-container-lowest overflow-hidden border border-outline-variant/20">
                                  <div
                                    className={`h-full transition-all duration-500 ${
                                      isAutoSubmitted ? "bg-error" : "bg-primary"
                                    }`}
                                    style={{ width: `${progressPercent}%` }}
                                  />
                                </div>
                              </div>
                            )}
                          </td>

                          {/* Score */}
                          <td className="py-3 px-3 font-mono">
                            {s.scorePoints !== null ? (
                              <div>
                                <span className="font-bold text-on-surface">
                                  {s.scorePoints} / {s.totalQuestions}
                                </span>
                                <span className="text-[10px] text-outline ml-1">
                                  ({s.scorePercent}%)
                                </span>
                              </div>
                            ) : (
                              <span className="text-outline text-[11px]">-</span>
                            )}
                          </td>

                          {/* Violations Count Badge */}
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded font-mono text-[11px] font-bold ${
                                s.violationCount === 0
                                  ? "bg-surface-container-lowest text-outline border border-outline-variant/30"
                                  : s.violationCount >= data.exam.maxViolations
                                  ? "bg-error text-white font-black animate-pulse"
                                  : "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                              }`}
                            >
                              {s.violationCount} / {data.exam.maxViolations}
                            </span>
                          </td>

                          {/* Action Button */}
                          <td className="py-3 px-3">
                            <div className="flex items-center justify-end gap-1.5">
                              {s.attemptId && (
                                <RowActions
                                  key={s.attemptId}
                                  attemptId={s.attemptId}
                                  status={s.status}
                                  timed={Boolean(data.exam.timePerQuestionSeconds)}
                                  onDone={(text) => showNotice(`${s.fullName}: ${text}`)}
                                />
                              )}
                              <button
                                type="button"
                                title="ดูประวัติและตัวเลือกเพิ่มเติม"
                                onClick={() => setSelectedStudentId(s.studentId)}
                                className="px-2.5 py-1.5 rounded-lg bg-surface-container-highest hover:bg-surface-container-high border border-outline-variant/30 text-[11px] text-on-surface hover:text-primary transition-colors flex items-center gap-1 whitespace-nowrap"
                              >
                                <span className="material-symbols-outlined text-sm">more_horiz</span>
                                เพิ่มเติม
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column: Live Violation Feed Ticker (4 cols) */}
        <div className="2xl:col-span-4 grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-1 gap-4 items-start">
          <div className="rounded-xl border border-outline-variant/30 bg-surface-container p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-outline-variant/20 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-base text-error">
                  notifications_active
                </span>
                <h3 className="text-xs font-bold text-on-surface uppercase tracking-wide">
                  ประวัติการทุจริตสด (Live Feed)
                </h3>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-error/15 text-error border border-error/30 font-bold">
                {data.recentViolations.length} รายการ
              </span>
            </div>

            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {data.recentViolations.length === 0 ? (
                <div className="py-12 text-center text-outline text-xs">
                  <span className="material-symbols-outlined text-2xl text-secondary block mb-1">
                    verified_user
                  </span>
                  ยังไม่พบการกระทำทุจริตในขณะนี้
                </div>
              ) : (
                data.recentViolations.map((v) => (
                  <div
                    key={v.id}
                    className="p-3 rounded-xl bg-surface-container-lowest border border-outline-variant/30 space-y-1 hover:border-error/50 transition-colors text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-error font-mono flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs">warning</span>
                        {VIOLATION_TRANSLATION[v.type] || v.type}
                      </span>
                      <span className="text-[10px] text-outline font-mono">
                        {new Date(v.occurredAt).toLocaleTimeString("th-TH")}
                      </span>
                    </div>

                    <div className="text-on-surface font-medium flex items-center justify-between pt-0.5">
                      <span>{v.studentName}</span>
                      <span className="font-mono text-[10px] text-outline">
                        {v.studentCode}
                      </span>
                    </div>

                    <div className="text-[11px] text-primary font-mono pt-0.5 flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs">target</span>
                      <span>ขณะกำลังทำข้อที่ {v.questionNumber}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Back-office action history */}
          <div className="rounded-xl border border-outline-variant/30 bg-surface-container p-4 space-y-3">
            <div className="flex items-center gap-2 border-b border-outline-variant/20 pb-2.5">
              <span className="material-symbols-outlined text-base text-tertiary">history</span>
              <h3 className="text-xs font-bold text-on-surface uppercase tracking-wide">ประวัติการสั่งการของผู้คุมสอบ</h3>
            </div>
            <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
              {auditLog.length === 0 ? (
                <p className="py-6 text-center text-outline text-xs">ยังไม่มีการสั่งการ</p>
              ) : (
                auditLog.map((a) => {
                  const studentId = typeof a.metadata?.studentId === "string" ? a.metadata.studentId : null;
                  const extra =
                    a.action === "ATTEMPT_MESSAGE"
                      ? `"${String(a.metadata?.message ?? "")}"`
                      : a.action === "ATTEMPT_ADD_TIME"
                        ? `+${Number(a.metadata?.seconds ?? 0) / 60} นาที`
                        : "";
                  return (
                    <div key={a.id} className="p-2.5 rounded-lg bg-surface-container-lowest border border-outline-variant/20 text-[11px]">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-tertiary">{AUDIT_ACTION_TH[a.action] ?? a.action}</span>
                        <span className="font-mono text-[10px] text-outline">
                          {new Date(a.createdAt).toLocaleTimeString("th-TH")}
                        </span>
                      </div>
                      {studentId && <div className="text-on-surface mt-0.5">{nameById.get(studentId) ?? studentId}</div>}
                      {extra && <div className="text-on-surface-variant mt-0.5 break-words">{extra}</div>}
                      <div className="text-outline text-[10px] mt-0.5">โดย {a.actorName}</div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal: Student Detail & Full Violation Timeline */}
      {selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border border-outline-variant/40 bg-surface-container p-6 space-y-5 shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-outline-variant/20 pb-4">
              <div>
                <h3 className="text-base font-bold text-on-surface">
                  ประวัติการสอบ: {selectedStudent.fullName}
                </h3>
                <p className="text-xs font-mono text-outline mt-0.5">
                  รหัส: {selectedStudent.studentCode} • {selectedStudent.email}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStudentId(null)}
                className="w-8 h-8 rounded-lg bg-surface-container-highest hover:bg-surface-container-high flex items-center justify-center text-outline hover:text-on-surface transition-colors"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            {/* Quick Status Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-surface-container-lowest border border-outline-variant/20 text-center">
                <span className="text-[10px] text-outline block">สถานะปัจจุบัน</span>
                <span className="text-xs font-bold text-primary mt-1 block">
                  {selectedStudent.status === "IN_PROGRESS"
                    ? `ทำถึงข้อ ${selectedStudent.currentQuestionIndex + 1}`
                    : selectedStudent.status}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-surface-container-lowest border border-outline-variant/20 text-center">
                <span className="text-[10px] text-outline block">ตอบไปแล้ว</span>
                <span className="text-xs font-bold text-on-surface mt-1 block font-mono">
                  {selectedStudent.answeredCount} / {selectedStudent.totalQuestions} ข้อ
                </span>
              </div>
              <div className="p-3 rounded-xl bg-surface-container-lowest border border-outline-variant/20 text-center">
                <span className="text-[10px] text-outline block">จำนวนครั้งที่โกง</span>
                <span className="text-xs font-bold text-error mt-1 block font-mono">
                  {selectedStudent.violationCount} / {data.exam.maxViolations} ครั้ง
                </span>
              </div>
            </div>

            {selectedStudent.attemptId && (
              <div className="p-4 rounded-xl bg-surface-container-lowest/60 border border-outline-variant/30">
                <StudentControls
                  key={selectedStudent.attemptId}
                  attemptId={selectedStudent.attemptId}
                  status={selectedStudent.status}
                  timed={Boolean(data.exam.timePerQuestionSeconds)}
                  onDone={(text) => {
                    showNotice(`${selectedStudent.fullName}: ${text}`);
                  }}
                />
              </div>
            )}

            {/* Violation List */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm text-error">shield</span>
                บันทึกการกระทำทุจริตทั้งหมด ({selectedStudent.violations.length} รายการ)
              </h4>

              <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                {selectedStudent.violations.length === 0 ? (
                  <p className="text-xs text-secondary p-4 bg-secondary/10 border border-secondary/20 rounded-xl text-center">
                    ✨ นักศึกษาคนนี้ไม่มีประวัติการฝ่าฝืนกฎ ปฏิบัติตัวถูกต้องตลอดการสอบ
                  </p>
                ) : (
                  selectedStudent.violations.map((v, i) => {
                    const qIdx = v.detail?.questionIndex;
                    const qNum = typeof qIdx === "number" ? qIdx + 1 : "-";

                    return (
                      <div
                        key={v.id}
                        className="p-3 rounded-xl bg-surface-container-lowest border border-error/30 space-y-1.5 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-error flex items-center gap-1 font-mono">
                            <span>#{i + 1}</span>
                            <span>{VIOLATION_TRANSLATION[v.type] || v.type}</span>
                          </span>
                          <span className="font-mono text-[10px] text-outline">
                            {new Date(v.occurredAt).toLocaleString("th-TH")}
                          </span>
                        </div>

                        <div className="text-[11px] text-on-surface-variant flex items-center gap-2">
                          <span className="text-primary font-mono font-semibold">
                            ขณะทำข้อที่ {qNum}
                          </span>
                          {v.detail && (
                            <span className="text-outline text-[10px] font-mono truncate max-w-xs">
                              {JSON.stringify(v.detail)}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedStudentId(null)}
                className="px-4 py-2 rounded-xl bg-primary text-on-primary font-medium text-xs hover:opacity-90 transition-opacity"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
