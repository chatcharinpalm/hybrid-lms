/** A room's programme, its first word: "CED 1 DE-RA" → "CED". Same rule as the API (services/examRooms.ts). */
export const programOf = (section: string | null | undefined) => section?.trim().split(/\s+/)[0]?.toUpperCase() || null;

export interface ProgramTheme {
  /** Solid accent (text, borders). */
  accent: string;
  /** Card / banner gradient stops. */
  from: string;
  to: string;
  icon: string;
}

/** Each programme keeps one colour everywhere a student sees it, so CED and TCT never look alike. */
const THEMES: Record<string, ProgramTheme> = {
  CED: { accent: "#ffb15c", from: "#ff8a3d", to: "#b3201f", icon: "memory" },
  TCT: { accent: "#5fd8ff", from: "#22b8e6", to: "#1c3f9e", icon: "settings_input_antenna" },
};
const FALLBACK: ProgramTheme[] = [
  { accent: "#b49bff", from: "#8f6bff", to: "#3b1d8f", icon: "school" },
  { accent: "#7be0a6", from: "#2fbf7a", to: "#0f5c3a", icon: "school" },
];

export function programTheme(code: string | null | undefined): ProgramTheme {
  if (code && THEMES[code]) return THEMES[code];
  const n = [...(code ?? "")].reduce((s, c) => s + c.charCodeAt(0), 0);
  return FALLBACK[n % FALLBACK.length];
}
