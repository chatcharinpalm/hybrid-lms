"use client";

import Link from "next/link";

export default function ExamResultPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-lg border border-outline-variant/40 bg-surface-container p-8 text-center space-y-4">
        <span className="material-symbols-outlined text-4xl text-secondary">task_alt</span>
        <h1 className="text-lg font-semibold text-on-surface">ส่งข้อสอบเรียบร้อยแล้ว</h1>
        <p className="text-xs text-on-surface-variant leading-relaxed">
          คำตอบของคุณถูกบันทึกเข้าสู่ระบบแล้ว ผลคะแนนและรายงานความประพฤติระหว่างสอบจะปรากฏในหน้าคะแนน
          &amp; ผลการเรียนหลังผู้สอนตรวจสอบเรียบร้อย
        </p>
        <Link
          href="/dashboard"
          className="inline-block px-5 py-2.5 rounded bg-primary text-on-primary font-semibold text-sm hover:opacity-90 transition-opacity"
        >
          กลับสู่แดชบอร์ด
        </Link>
      </div>
    </div>
  );
}
