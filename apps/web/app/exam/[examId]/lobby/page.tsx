"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { isLoggedIn, loginUrl } from "@/lib/auth";

/**
 * Entry point for an exam link. The rules and the "start" button live on the
 * exam screen itself (SecureExamShell), so this only routes the student there —
 * via login first if needed.
 */
export default function ExamLobbyPage() {
  const { examId } = useParams<{ examId: string }>();
  const router = useRouter();

  useEffect(() => {
    const session = `/exam/${examId}/session`;
    router.replace(isLoggedIn() ? session : loginUrl(session));
  }, [examId, router]);

  return null;
}
