"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

interface CourseExam {
  id: string;
  title: string;
  description: string;
  durationMinutes: number;
  status: string;
  courseId: string;
}

export default function AdminMonitorHubPage() {
  const [exams, setExams] = useState<CourseExam[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Look up exams for CPE-321 or all exams
    apiFetch<any[]>("/api/courses")
      .then(async (courses) => {
        const allExams: CourseExam[] = [];
        for (const c of courses) {
          const courseExams = await apiFetch<CourseExam[]>(`/api/exams/course/${c.id}`).catch(() => []);
          allExams.push(...courseExams);
        }
        setExams(allExams);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-on-surface">
            ศูนย์ควบคุมการสอบสด (Live Exam Monitoring Center)
          </h1>
          <p className="text-xs text-on-surface-variant mt-1">
            เลือกแบบทดสอบเพื่อเปิดจอสังเกตการณ์คุมสอบแบบเรียลไทม์ พร้อมระบบแจ้งเตือนการทุจริตทันที
          </p>
        </div>
      </div>

      {/* Featured Microprocessor & Bus Exam */}
      <div className="rounded-2xl border-2 border-primary/50 bg-gradient-to-r from-primary/10 via-surface-container to-surface-container p-6 shadow-xl space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-primary text-on-primary uppercase tracking-wider">
              ⭐ RECOMMENDED EXAM
            </span>
            <h2 className="text-lg font-bold text-on-surface pt-1">
              ข้อสอบท้ายบทที่ 5 เรื่อง Microprocessor and Bus
            </h2>
            <p className="text-xs text-on-surface-variant max-w-2xl leading-relaxed">
              แบบทดสอบท้ายบทที่ 5 (42 ข้อ จำกัดเวลาข้อละ 5 นาที) สลับลำดับคำถามและตัวเลือกแบบรายบุคคลสำหรับนักศึกษาทั้ง 30 คน พร้อมระบบตรวจจับการโกงขั้นสูงและรูปแจ้งเตือน "ฮั่นแน่จะทำไรฉันรู้นะ"
            </p>
          </div>

          <Link
            href="/backoffice/exams/667e74ba-a2ee-499c-9ce9-c8e7c32ab029/monitor"
            className="px-5 py-2.5 rounded-xl bg-primary text-on-primary font-bold text-xs hover:opacity-90 transition-opacity flex items-center gap-2 shadow-lg shadow-primary/20 shrink-0"
          >
            <span className="material-symbols-outlined text-sm">live_tv</span>
            <span>เปิดหน้าคุมสอบ</span>
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs">
          <div className="p-2.5 rounded-xl bg-surface-container-lowest/80 border border-outline-variant/30">
            <span className="text-outline text-[11px] block">จำนวนนักศึกษา</span>
            <span className="font-mono font-bold text-on-surface text-sm mt-0.5 block">30 คน</span>
          </div>
          <div className="p-2.5 rounded-xl bg-surface-container-lowest/80 border border-outline-variant/30">
            <span className="text-outline text-[11px] block">เวลาต่อข้อ</span>
            <span className="font-mono font-bold text-primary text-sm mt-0.5 block">5 นาที / ข้อ</span>
          </div>
          <div className="p-2.5 rounded-xl bg-surface-container-lowest/80 border border-outline-variant/30">
            <span className="text-outline text-[11px] block">จำนวนข้อสอบ</span>
            <span className="font-mono font-bold text-on-surface text-sm mt-0.5 block">42 ข้อ</span>
          </div>
          <div className="p-2.5 rounded-xl bg-surface-container-lowest/80 border border-outline-variant/30">
            <span className="text-outline text-[11px] block">ฐานข้อมูล</span>
            <span className="font-mono font-bold text-secondary text-sm mt-0.5 block">XAMPP MySQL</span>
          </div>
        </div>
      </div>

      {/* Other Exams List */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-outline uppercase tracking-wider">
          แบบทดสอบทั้งหมดในระบบ
        </h3>

        {loading ? (
          <div className="py-6 text-center text-xs text-outline">กำลังโหลดรายการข้อสอบ...</div>
        ) : exams.length === 0 ? (
          <div className="py-6 text-center text-xs text-outline">ยังไม่มีข้อสอบอื่น</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {exams.map((ex) => (
              <div
                key={ex.id}
                className="p-5 rounded-xl bg-surface-container border border-outline-variant/30 flex items-center justify-between gap-4"
              >
                <div>
                  <h4 className="text-sm font-semibold text-on-surface">{ex.title}</h4>
                  <p className="text-xs text-outline mt-0.5">
                    เวลา: {ex.durationMinutes} นาที • สถานะ: {ex.status}
                  </p>
                </div>
                <Link
                  href={`/backoffice/exams/${ex.id}/monitor`}
                  className="px-3 py-1.5 rounded-lg bg-surface-container-highest hover:bg-surface-container-high border border-outline-variant/30 text-xs text-on-surface hover:text-primary transition-colors flex items-center gap-1.5 shrink-0"
                >
                  <span className="material-symbols-outlined text-sm">visibility</span>
                  <span>คุมสอบ</span>
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
