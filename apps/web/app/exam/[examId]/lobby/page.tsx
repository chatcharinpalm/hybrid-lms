"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { isLoggedIn, loginUrl } from "@/lib/auth";
import { NetworkBackground } from "@/components/ui/NetworkBackground";

const RULES = [
  {
    title: "1. โหมดเต็มหน้าจอ (Fullscreen Lockdown)",
    body: "ระบบจะบังคับเข้าสู่โหมดเต็มหน้าจอทันทีที่เริ่มทำข้อสอบ การออกจากโหมดนี้จะถูกบันทึกเป็นการทุจริตทุกครั้ง",
  },
  {
    title: "2. นโยบาย Single-Window Lockout",
    body: "ห้ามสลับแท็บ ย่อหน้าต่าง หรือคลิกออกจากหน้าต่างสอบ ระบบตรวจจับด้วย visibilitychange และ window blur",
  },
  {
    title: "3. การบล็อกคัดลอก/วาง และคีย์ลัด",
    body: "ปิดใช้งานคลิกขวา, Ctrl+C/V/X, F12 และคีย์ลัดเปิด DevTools ตลอดระยะเวลาสอบ",
  },
  {
    title: "4. การสุ่มลำดับข้อสอบ",
    body: "ลำดับคำถามและตัวเลือกจะถูกสุ่มเฉพาะบุคคล เพื่อป้องกันการทุจริตแบบดูคำตอบข้ามเครื่อง",
  },
];

export default function ExamLobbyPage() {
  const { examId } = useParams<{ examId: string }>();
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    setLoggedIn(isLoggedIn());
  }, []);

  if (loggedIn === null) return null;

  if (!loggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-lg border border-outline-variant/40 bg-surface-container p-8 text-center space-y-4">
          <span className="material-symbols-outlined text-4xl text-primary">lock</span>
          <h1 className="text-sm font-semibold text-on-surface">กรุณาเข้าสู่ระบบเพื่อเข้าสอบ</h1>
          <p className="text-xs text-on-surface-variant leading-relaxed">
            การเข้าสอบต้องยืนยันตัวตนด้วยบัญชีนักเรียน เพื่อบันทึกผลคะแนนและตรวจสอบพฤติกรรมระหว่างสอบรายบุคคล
          </p>
          <Link
            href={loginUrl(`/exam/${examId}/lobby`)}
            className="inline-block px-5 py-2.5 rounded bg-primary text-on-primary font-semibold text-sm hover:opacity-90 transition-opacity"
          >
            เข้าสู่ระบบ
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center p-6 overflow-hidden bg-surface">
      <NetworkBackground intensity={0.6} />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at 50% 30%, transparent 0%, rgba(11,19,38,0.6) 65%, rgba(11,19,38,0.94) 100%)",
        }}
      />
      <div className="relative z-10 max-w-xl w-full rounded-lg border border-outline-variant/40 bg-surface-container/90 backdrop-blur-md p-6 space-y-5 shadow-2xl shadow-black/40">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-xl">policy</span>
          <h1 className="text-sm font-semibold text-on-surface">ระเบียบและข้อบังคับการสอบวัดผล</h1>
        </div>

        <div className="space-y-3">
          {RULES.map((rule) => (
            <div key={rule.title} className="p-3 rounded bg-surface-container-lowest border border-outline-variant/20">
              <strong className="text-on-surface block font-medium mb-1 text-xs">{rule.title}</strong>
              <p className="text-xs text-on-surface-variant leading-relaxed">{rule.body}</p>
            </div>
          ))}
        </div>

        <Link
          href={`/exam/${examId}/session`}
          className="block w-full text-center py-2.5 rounded bg-primary text-on-primary font-semibold text-sm hover:opacity-90 transition-opacity"
        >
          รับทราบระเบียบ และเข้าสู่ห้องสอบ
        </Link>
      </div>
    </div>
  );
}
