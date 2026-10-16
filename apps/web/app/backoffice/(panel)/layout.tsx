"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { backofficeLoginUrl, getStoredRole, idleFor, isLoggedIn, isStaff, logout, STAFF_IDLE_MS } from "@/lib/auth";
import { IdleLogout } from "@/components/IdleLogout";
import { AdminShell } from "@/components/layout/AdminShell";

type CheckState = "checking" | "redirecting" | "allowed";

export default function BackofficeLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<CheckState>("checking");

  useEffect(() => {
    // A session left idle for 30 minutes is signed out before anything shows (shared computers).
    if (isLoggedIn() && idleFor() > STAFF_IDLE_MS) {
      logout();
      setState("redirecting");
      window.location.replace("/login?as=teacher&expired=30");
      return;
    }
    // Only staff sessions are ever stored for the back office, but guard anyway.
    if (!isLoggedIn() || !isStaff(getStoredRole())) {
      logout();
      router.replace(backofficeLoginUrl(pathname));
      setState("redirecting");
      return;
    }
    setState("allowed");
  }, [router, pathname]);

  if (state !== "allowed") return null;
  return (
    <AdminShell>
      {/* Proctoring pages are watched, not touched: no idle sign-out while one is open. */}
      <IdleLogout paused={isProctoringPage(pathname)} />
      {children}
    </AdminShell>
  );
}

/** The exam list with its live room panel, and an exam's live monitor. */
const isProctoringPage = (path: string) => path === "/backoffice/monitor" || /^\/backoffice\/exams\/[^/]+\/monitor$/.test(path);
