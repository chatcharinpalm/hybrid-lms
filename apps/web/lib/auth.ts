export type Role = "ADMIN" | "TEACHER" | "STUDENT";

export function getStoredRole(): Role | null {
  if (typeof window === "undefined") return null;
  return (window.localStorage.getItem("role") as Role | null) ?? null;
}

export function isStaff(role: Role | null): boolean {
  return role === "ADMIN" || role === "TEACHER";
}

export function isLoggedIn(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(window.localStorage.getItem("accessToken"));
}

export function getStoredFullName(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("fullName");
}

export function logout() {
  window.localStorage.removeItem("accessToken");
  window.localStorage.removeItem("role");
  window.localStorage.removeItem("fullName");
}

/** Builds a /login?next=... URL that sends the user back where they were headed. */
export function loginUrl(next: string): string {
  return `/login?next=${encodeURIComponent(next)}`;
}
