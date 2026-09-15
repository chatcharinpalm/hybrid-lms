"use client";

import { TopNav } from "./TopNav";

export function PortalShell({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <TopNav />
      <main className="w-full px-4 sm:px-6 lg:px-8 py-6 lg:py-8 space-y-8 max-w-7xl mx-auto">{children}</main>
    </div>
  );
}
