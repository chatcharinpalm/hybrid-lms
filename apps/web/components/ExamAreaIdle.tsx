"use client";

import { usePathname } from "next/navigation";
import { IdleLogout } from "./IdleLogout";

/** Idle sign-out on the /exam pages: paused on the exam screen itself, active in the lobby and on the result page. */
export function ExamAreaIdle() {
  const pathname = usePathname();
  return <IdleLogout paused={pathname.endsWith("/session")} />;
}
