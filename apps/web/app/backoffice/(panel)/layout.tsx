"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { backofficeLoginUrl, getStoredRole, isLoggedIn, isStaff, logout } from "@/lib/auth";
import { AdminShell } from "@/components/layout/AdminShell";

type CheckState = "checking" | "redirecting" | "allowed";

export default function BackofficeLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<CheckState>("checking");

  useEffect(() => {
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
  return <AdminShell>{children}</AdminShell>;
}
