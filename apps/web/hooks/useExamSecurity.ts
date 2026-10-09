"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ExamSecurityConfig, ViolationType } from "@/types/exam";

export interface ViolationEvent {
  type: ViolationType;
  at: number;
  detail?: Record<string, unknown>;
}

export interface UseExamSecurityOptions {
  /** Master switch — only wires up listeners while an attempt is active. */
  enabled: boolean;
  config: ExamSecurityConfig;
  /** Fired on every detected violation; wire this to the violations API call. */
  onViolation: (event: ViolationEvent) => void;
  /** Fired once the locally-tracked count reaches config.maxViolations. */
  onMaxViolationsReached?: () => void;
}

export interface UseExamSecurityResult {
  isFullscreen: boolean;
  /** True while the exam window is unfocused or its tab is hidden. */
  isAway: boolean;
  violationCount: number;
  lastViolation: ViolationEvent | null;
  /** Must be called from a user gesture (e.g. the "Start Exam" button click). */
  requestEnterFullscreen: () => Promise<void>;
  /** Reconcile local counter with the server's authoritative count. */
  syncViolationCount: (serverCount: number) => void;
}

// iPad Safari before 16.4 only has the webkit-prefixed fullscreen API; iPhones have none.
type WebkitDocument = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => Promise<void> };
type WebkitElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };

const fullscreenElement = () =>
  typeof document === "undefined" ? null : document.fullscreenElement ?? (document as WebkitDocument).webkitFullscreenElement ?? null;

/** Whether this device can lock the exam to fullscreen at all. */
export function canFullscreen(): boolean {
  if (typeof document === "undefined") return true;
  const el = document.documentElement as WebkitElement;
  return Boolean(el.requestFullscreen || el.webkitRequestFullscreen) && document.fullscreenEnabled !== false;
}

function exitFullscreen() {
  const doc = document as WebkitDocument;
  if (document.exitFullscreen) document.exitFullscreen().catch(() => undefined);
  else doc.webkitExitFullscreen?.();
}

const CLIPBOARD_BLOCK_KEYS = new Set(["c", "v", "x"]);
const DEVTOOLS_KEYS = new Set(["i", "j", "c", "u"]);

/**
 * Encapsulates every anti-cheat detector required by the Secure Exam Engine:
 * fullscreen lockdown, tab/focus-loss detection, and clipboard/keyboard/
 * context-menu blocking. Pure detection + reporting only — grading and the
 * force-submit decision live server-side (see examSession.service.ts) since
 * a client can always be tampered with; this hook exists to make cheating
 * inconvenient and to generate the audit trail, not to be the trust boundary.
 */
export function useExamSecurity({
  enabled,
  config,
  onViolation,
  onMaxViolationsReached,
}: UseExamSecurityOptions): UseExamSecurityResult {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [violationCount, setViolationCount] = useState(0);
  const [lastViolation, setLastViolation] = useState<ViolationEvent | null>(null);
  const [isAway, setIsAway] = useState(false);

  // Avoid double-counting: entering fullscreen via requestEnterFullscreen
  // triggers a transient blur/visibilitychange in some browsers.
  const suppressUntilRef = useRef(0);
  const configRef = useRef(config);
  configRef.current = config;
  // Callbacks are read through refs so the listener effect below depends only on
  // `enabled`. If it re-ran whenever a parent re-rendered (e.g. on every answer),
  // its cleanup would call exitFullscreen() and silently drop the lockdown.
  const onViolationRef = useRef(onViolation);
  onViolationRef.current = onViolation;
  const onMaxRef = useRef(onMaxViolationsReached);
  onMaxRef.current = onMaxViolationsReached;
  const countRef = useRef(0);

  const lastReportAtRef = useRef(0);

  const report = useCallback((type: ViolationType, detail?: Record<string, unknown>) => {
    if (Date.now() < suppressUntilRef.current) return;
    // One action often fires several events (switching tabs = blur + hidden +
    // fullscreen exit); count it once.
    if (Date.now() - lastReportAtRef.current < 1500) return;
    lastReportAtRef.current = Date.now();

    const event: ViolationEvent = { type, at: Date.now(), detail };
    setLastViolation(event);
    countRef.current += 1;
    setViolationCount(countRef.current);
    if (countRef.current >= configRef.current.maxViolations) onMaxRef.current?.();
    onViolationRef.current(event);
  }, []);

  const requestEnterFullscreen = useCallback(async () => {
    suppressUntilRef.current = Date.now() + 700;
    try {
      const el = document.documentElement as WebkitElement;
      if (el.requestFullscreen) await el.requestFullscreen();
      else await el.webkitRequestFullscreen?.();
    } catch {
      // Fullscreen can be denied (e.g. iframe without allow="fullscreen").
      // The fullscreenchange listener below will keep reporting exits,
      // which is the correct behavior if the browser refuses to lock down.
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    document.body.classList.add("exam-lockdown");
    // The listeners below only exist once `enabled` flips true, which
    // happens right after requestEnterFullscreen() already resolved — so
    // the fullscreenchange event for *entering* fullscreen fired before
    // there was a listener to catch it. Sync the initial state directly
    // instead of waiting for a change event that already happened.
    setIsFullscreen(fullscreenElement() !== null);

    setIsAway(document.hidden || !document.hasFocus());

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsAway(true);
        report("TAB_HIDDEN");
      }
    };

    const handleBlur = () => {
      setIsAway(true);
      report("WINDOW_BLUR");
    };

    const handleFocus = () => setIsAway(false);

    const handleFullscreenChange = () => {
      const active = fullscreenElement() !== null;
      setIsFullscreen(active);
      if (!active && configRef.current.requireFullscreen) {
        report("FULLSCREEN_EXIT");
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      if (!configRef.current.blockContextMenu) return;
      e.preventDefault();
      report("CONTEXT_MENU_ATTEMPT");
    };

    const handleSelectStart = (e: Event) => {
      if (!configRef.current.blockClipboard) return;
      e.preventDefault();
    };

    const handleCopy = (e: ClipboardEvent) => {
      if (!configRef.current.blockClipboard) return;
      e.preventDefault();
      report("COPY_ATTEMPT");
    };

    const handleCut = (e: ClipboardEvent) => {
      if (!configRef.current.blockClipboard) return;
      e.preventDefault();
      report("CUT_ATTEMPT");
    };

    const handlePaste = (e: ClipboardEvent) => {
      if (!configRef.current.blockClipboard) return;
      e.preventDefault();
      report("PASTE_ATTEMPT");
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();

      // F12 — open devtools
      if (key === "f12") {
        e.preventDefault();
        report("DEVTOOLS_SHORTCUT", { key: e.key });
        return;
      }

      // Ctrl/Cmd+Shift+I|J|C, Ctrl/Cmd+U — devtools / view-source
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && DEVTOOLS_KEYS.has(key)) {
        e.preventDefault();
        report("DEVTOOLS_SHORTCUT", { key: e.key, combo: "ctrl+shift" });
        return;
      }
      if ((e.ctrlKey || e.metaKey) && key === "u") {
        e.preventDefault();
        report("DEVTOOLS_SHORTCUT", { key: e.key, combo: "ctrl+u" });
        return;
      }

      // Ctrl/Cmd+C|V|X — clipboard shortcuts
      if (configRef.current.blockClipboard && (e.ctrlKey || e.metaKey) && CLIPBOARD_BLOCK_KEYS.has(key)) {
        e.preventDefault();
        const map: Record<string, ViolationType> = {
          c: "COPY_ATTEMPT",
          v: "PASTE_ATTEMPT",
          x: "CUT_ATTEMPT",
        };
        report(map[key], { key: e.key });
        return;
      }

      // PrintScreen — can't be preventDefault'ed (OS captures before the
      // browser sees it reliably), but we still log the keydown/keyup so
      // the attempt shows a screenshot was likely taken, and briefly wipe
      // the clipboard as a mitigation.
      if (key === "printscreen") {
        report("PRINT_SCREEN");
        navigator.clipboard?.writeText("").catch(() => undefined);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("selectstart", handleSelectStart);
    document.addEventListener("copy", handleCopy);
    document.addEventListener("cut", handleCut);
    document.addEventListener("paste", handlePaste);
    document.addEventListener("keydown", handleKeyDown, { capture: true });

    return () => {
      document.body.classList.remove("exam-lockdown");
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("selectstart", handleSelectStart);
      document.removeEventListener("copy", handleCopy);
      document.removeEventListener("cut", handleCut);
      document.removeEventListener("paste", handlePaste);
      document.removeEventListener("keydown", handleKeyDown, { capture: true });
      if (fullscreenElement()) exitFullscreen();
    };
    // `report` is stable (empty deps); config and callbacks are read through refs.
  }, [enabled, report]);

  const syncViolationCount = useCallback((serverCount: number) => {
    countRef.current = serverCount;
    setViolationCount(serverCount);
  }, []);

  return { isFullscreen, isAway, violationCount, lastViolation, requestEnterFullscreen, syncViolationCount };
}
