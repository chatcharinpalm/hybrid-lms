"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getStoredFullName, isLoggedIn, loginUrl, logout } from "@/lib/auth";

const NAV_ITEMS = [
  { href: "/dashboard", label: "หน้าแรก", icon: "dashboard" },
  { href: "/courses", label: "คอร์สเรียน", icon: "cast_for_education" },
  { href: "/attendance", label: "เช็คชื่อเข้าเรียน", icon: "co_present" },
  { href: "/exams", label: "ศูนย์สอบ", icon: "assignment_turned_in" },
];

// A horizontal top nav (logo left, menu center, account right) — the
// layout public course sites like ThaiMOOC use, rather than an admin-panel
// left sidebar. The admin back office (components/layout/AdminShell.tsx)
// intentionally keeps the sidebar look instead, so the two apps read as
// visually distinct as well as structurally separate.
export function TopNav() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [fullName, setFullName] = useState<string | null>(null);

  useEffect(() => {
    setLoggedIn(isLoggedIn());
    setFullName(getStoredFullName());
    setMobileOpen(false);
  }, [pathname]);

  const handleLogout = () => {
    logout();
    window.location.href = "/dashboard";
  };

  return (
    <header className="sticky top-0 z-50 bg-surface-container-low/95 backdrop-blur border-b border-outline-variant/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <Link href="/dashboard" className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded bg-primary/10 border border-primary/25 flex items-center justify-center text-primary">
            <span className="material-symbols-outlined text-lg">school</span>
          </div>
          <div className="hidden sm:flex flex-col leading-none">
            <span className="text-sm font-semibold text-on-surface">NetSec Hub</span>
            <span className="text-[10px] font-mono text-outline uppercase tracking-wider">Hybrid LMS</span>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {NAV_ITEMS.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          {loggedIn ? (
            <>
              <span className="hidden sm:inline text-xs text-on-surface-variant max-w-[10rem] truncate">
                {fullName ?? "ผู้ใช้งาน"}
              </span>
              <button
                type="button"
                onClick={handleLogout}
                className="px-3 py-1.5 rounded bg-surface-container-high border border-outline-variant/40 text-on-surface text-xs font-medium hover:bg-surface-bright transition-colors flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">logout</span>
                <span className="hidden sm:inline">ออกจากระบบ</span>
              </button>
            </>
          ) : (
            <a
              href={loginUrl(pathname)}
              className="px-3 py-1.5 rounded bg-primary text-on-primary text-xs font-medium hover:opacity-90 transition-opacity flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-sm">login</span>
              เข้าสู่ระบบ
            </a>
          )}
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            className="md:hidden p-2 rounded text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors"
            aria-label="เปิดเมนู"
          >
            <span className="material-symbols-outlined text-xl">{mobileOpen ? "close" : "menu"}</span>
          </button>
        </div>
      </div>

      {mobileOpen && (
        <nav className="md:hidden border-t border-outline-variant/30 px-4 py-2 space-y-1 bg-surface-container-low">
          {NAV_ITEMS.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-md text-sm transition-colors ${
                  active ? "bg-primary/10 text-primary font-medium" : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                <span className="material-symbols-outlined text-lg">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
      )}
    </header>
  );
}
