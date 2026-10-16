"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { idleFor, isLoggedIn, loginUrl, logout } from "@/lib/auth";
import { IDLE_LIMIT_MS, IdleLogout } from "@/components/IdleLogout";
import { usePortalSettings } from "@/lib/portalSettings";
import { TopNav } from "./TopNav";
import { SunsetScene } from "@/components/login/SunsetScene";

/** Set once an idle session has been signed out and the page is leaving for /login. */
let expiring = false;

export function PortalShell({ children }: { children: React.ReactNode }) {
  const settings = usePortalSettings();
  const pathname = usePathname();
  const router = useRouter();
  const hiddenMenus = settings?.hiddenMenus ?? [];
  // A menu hidden from the back office is closed to direct links too.
  const onHiddenPage = hiddenMenus.some((m) => pathname.startsWith(`/${m}`));

  // Students sign in before seeing anything; checked after mount (the token lives in localStorage).
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    // A session left idle too long is someone else's (shared lab computers): out before anything shows.
    if (isLoggedIn() && idleFor() > IDLE_LIMIT_MS) {
      logout();
      expiring = true;
      window.location.replace("/login?expired=1");
      return;
    }
    // Already on the way to the sign-in page (effects can run twice).
    if (expiring) return;
    const ok = isLoggedIn();
    setSignedIn(ok);
    if (!ok) router.replace(loginUrl(pathname));
  }, [pathname, router]);

  useEffect(() => {
    if (onHiddenPage) router.replace("/exams");
  }, [onHiddenPage, router]);

  if (!signedIn) return null;

  return (
    <div className="relative min-h-screen">
      <SunsetScene dim />
      <IdleLogout />
      <TopNav hiddenMenus={hiddenMenus} />
      <main className="relative w-full px-4 sm:px-6 lg:px-8 py-6 lg:py-8 space-y-8 max-w-7xl mx-auto">
        {onHiddenPage ? null : children}
      </main>
    </div>
  );
}
