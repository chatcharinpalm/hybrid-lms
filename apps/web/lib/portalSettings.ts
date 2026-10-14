"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "./api";

/** Student-portal menus the back office can hide (the exam center always stays). */
export type PortalMenu = "courses" | "attendance";

export interface PortalSettings {
  hiddenMenus: PortalMenu[];
}

/** Which student-portal menus to show; null until loaded. */
export function usePortalSettings(): PortalSettings | null {
  const [settings, setSettings] = useState<PortalSettings | null>(null);
  useEffect(() => {
    apiFetch<PortalSettings>("/api/settings/portal")
      .then(setSettings)
      // Unreachable settings must not hide anything the student needs.
      .catch(() => setSettings({ hiddenMenus: [] }));
  }, []);
  return settings;
}
