"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getStoredFullName, logout } from "@/lib/auth";

const NAV_ITEMS = [
  { href: "/backoffice/monitor", label: "คุมสอบ", icon: "live_tv" },
  { href: "/backoffice/courses/new", label: "สร้างรายวิชา", icon: "add_business" },
  { href: "/backoffice/exams/new", label: "สร้างข้อสอบ", icon: "post_add" },
  { href: "/backoffice/materials/upload", label: "อัพโหลดเอกสาร", icon: "upload_file" },
];

// Fully separate visual identity from the student-facing (portal) shell —
// a distinct amber/tertiary accent plus an "ADMIN" badge — so it reads as
// its own back-office application rather than a tab bolted onto the
// learner site, the way ThaiMOOC-style platforms keep the two apart.
export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const fullName = getStoredFullName();

  const handleLogout = () => {
    logout();
    window.location.href = "/backoffice/login";
  };

  return (
    <div className="min-h-screen">
      <aside className="fixed left-0 top-0 h-full w-60 bg-surface-container-low border-r border-tertiary/20 z-50 flex flex-col justify-between">
        <div>
          <div className="h-16 px-5 flex items-center gap-3 border-b border-tertiary/20 bg-surface-container-lowest/70">
            <div className="w-8 h-8 rounded bg-tertiary/15 border border-tertiary/40 flex items-center justify-center text-tertiary shrink-0">
              <span className="material-symbols-outlined text-lg">admin_panel_settings</span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-semibold tracking-tight text-on-surface truncate">Admin Panel</span>
              <span className="text-[11px] font-mono text-tertiary uppercase tracking-wider">NetSec Hub</span>
            </div>
          </div>

          <nav className="flex flex-col gap-1 px-3 py-4">
            {NAV_ITEMS.map((item) => {
              const active =
                pathname.startsWith(item.href) || (item.href === "/backoffice/monitor" && pathname.endsWith("/monitor"));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-3 px-3 py-2 rounded text-sm transition-colors ${
                    active
                      ? "bg-surface-container-high text-tertiary font-semibold border-l-2 border-tertiary"
                      : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
                  }`}
                >
                  <span className={`material-symbols-outlined text-lg shrink-0 ${active ? "text-tertiary" : "text-outline"}`}>
                    {item.icon}
                  </span>
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="p-3 border-t border-tertiary/20 space-y-2">
          <div className="flex items-center justify-between px-3 py-2 rounded bg-surface-container-lowest border border-outline-variant/30 text-xs">
            <span className="text-on-surface-variant truncate">{fullName ?? "ผู้ดูแลระบบ"}</span>
            <button
              type="button"
              onClick={handleLogout}
              className="text-outline hover:text-error transition-colors shrink-0"
              title="ออกจากระบบ"
            >
              <span className="material-symbols-outlined text-base">logout</span>
            </button>
          </div>
        </div>
      </aside>

      <div className="pl-60">
        <header className="sticky top-0 h-14 bg-surface/90 backdrop-blur border-b border-tertiary/20 z-40 px-6 flex items-center">
          <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase font-semibold bg-tertiary/15 text-tertiary border border-tertiary/30">
            Admin Only
          </span>
        </header>
        <main className="w-full px-6 py-8 max-w-7xl">{children}</main>
      </div>
    </div>
  );
}
