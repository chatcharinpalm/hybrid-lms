"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getStoredRole, isLoggedIn, isStaff, loginUrl } from "@/lib/auth";
import { AdminShell } from "@/components/layout/AdminShell";

type CheckState = "checking" | "denied" | "unauthenticated" | "allowed";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<CheckState>("checking");

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace(loginUrl("/admin"));
      setState("unauthenticated");
      return;
    }
    setState(isStaff(getStoredRole()) ? "allowed" : "denied");
  }, [router]);

  if (state === "checking" || state === "unauthenticated") return null;

  if (state === "denied") {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-3">
          <span className="material-symbols-outlined text-4xl text-error">block</span>
          <h1 className="text-sm font-semibold text-on-surface">ไม่มีสิทธิ์เข้าถึงหน้านี้</h1>
          <p className="text-xs text-on-surface-variant">ระบบหลังบ้านเปิดให้เฉพาะบัญชีครู/ผู้ดูแลระบบเท่านั้น</p>
          <a href="/dashboard" className="inline-block text-xs text-primary hover:opacity-80 transition-opacity">
            กลับสู่หน้าเว็บหลัก
          </a>
        </div>
      </div>
    );
  }

  return <AdminShell>{children}</AdminShell>;
}
