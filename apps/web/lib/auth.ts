export type Role = "ADMIN" | "TEACHER" | "STUDENT";

/**
 * The back office (/backoffice) keeps its own login, stored under separate
 * keys, so a proctor and a student can be signed in side by side in the same
 * browser and logging out of one never signs out the other.
 */
export function isBackofficePath(pathname: string): boolean {
  return pathname === "/backoffice" || pathname.startsWith("/backoffice/");
}

function storageKey(name: string): string {
  if (typeof window === "undefined") return name;
  return isBackofficePath(window.location.pathname) ? `backoffice.${name}` : name;
}

export function getStoredAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(storageKey("accessToken"));
}

export function storeSession(session: { accessToken: string; role: Role; fullName: string }) {
  window.localStorage.setItem(storageKey("accessToken"), session.accessToken);
  window.localStorage.setItem(storageKey("role"), session.role);
  window.localStorage.setItem(storageKey("fullName"), session.fullName);
}

export function getStoredRole(): Role | null {
  if (typeof window === "undefined") return null;
  return (window.localStorage.getItem(storageKey("role")) as Role | null) ?? null;
}

export function isStaff(role: Role | null): boolean {
  return role === "ADMIN" || role === "TEACHER";
}

export function isLoggedIn(): boolean {
  return Boolean(getStoredAccessToken());
}

export function getStoredFullName(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(storageKey("fullName"));
}

export function logout() {
  window.localStorage.removeItem(storageKey("accessToken"));
  window.localStorage.removeItem(storageKey("role"));
  window.localStorage.removeItem(storageKey("fullName"));
}

/** Builds a /login?next=... URL that sends the user back where they were headed. */
export function loginUrl(next: string): string {
  return `/login?next=${encodeURIComponent(next)}`;
}

/** Back-office equivalent of loginUrl. */
export function backofficeLoginUrl(next: string): string {
  return `/backoffice/login?next=${encodeURIComponent(next)}`;
}
