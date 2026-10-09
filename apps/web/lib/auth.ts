export type Role = "ADMIN" | "TEACHER" | "STUDENT";

/**
 * The back office (/backoffice) keeps its own login, stored under separate
 * keys, so a proctor and a student can be signed in side by side in the same
 * browser and logging out of one never signs out the other.
 */
export function isBackofficePath(pathname: string): boolean {
  return pathname === "/backoffice" || pathname.startsWith("/backoffice/");
}

export type Side = "student" | "backoffice";

/** Which session a page uses: the back office's under /backoffice, the student's elsewhere. */
function storageKey(name: string, side?: Side): string {
  if (typeof window === "undefined") return name;
  const backoffice = side ? side === "backoffice" : isBackofficePath(window.location.pathname);
  return backoffice ? `backoffice.${name}` : name;
}

export function getStoredAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(storageKey("accessToken"));
}

export function getStoredRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(storageKey("refreshToken"));
}

/** Replaces the short-lived access token after a refresh. */
export function storeAccessToken(accessToken: string) {
  window.localStorage.setItem(storageKey("accessToken"), accessToken);
}

/** `side` overrides the current page's: the shared /login page signs teachers into the back office. */
export function storeSession(
  session: { accessToken: string; refreshToken?: string; role: Role; fullName: string },
  side?: Side
) {
  window.localStorage.setItem(storageKey("accessToken", side), session.accessToken);
  if (session.refreshToken) window.localStorage.setItem(storageKey("refreshToken", side), session.refreshToken);
  window.localStorage.setItem(storageKey("role", side), session.role);
  window.localStorage.setItem(storageKey("fullName", side), session.fullName);
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
  window.localStorage.removeItem(storageKey("refreshToken"));
  window.localStorage.removeItem(storageKey("role"));
  window.localStorage.removeItem(storageKey("fullName"));
}

/** Builds a /login?next=... URL that sends the user back where they were headed. */
export function loginUrl(next: string): string {
  return `/login?next=${encodeURIComponent(next)}`;
}

/** Back-office equivalent of loginUrl: the same page, on the teacher tab. */
export function backofficeLoginUrl(next: string): string {
  return `/login?as=teacher&next=${encodeURIComponent(next)}`;
}
