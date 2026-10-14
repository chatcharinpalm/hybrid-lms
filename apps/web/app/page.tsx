"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isLoggedIn } from "@/lib/auth";

// The site opens on the login page; a student already signed in goes on to the exam center.
export default function RootPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace(isLoggedIn() ? "/exams" : "/login");
  }, [router]);
  return null;
}
