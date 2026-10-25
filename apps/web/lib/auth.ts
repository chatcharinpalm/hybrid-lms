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
  touchActivity(side);
}

/** A student session ends after this long without use (lab computers are shared). */
export const STUDENT_IDLE_MS = 5 * 60_000;
/** A back-office session ends after this long without use — except while a proctoring page is open. */
export const STAFF_IDLE_MS = 30 * 60_000;

/** The idle limit for the side of the current page. */
/** Proctoring pages (the live panel and each exam's monitor), watched while the proctor walks around. */
export const isProctoringPath = (path: string) => path === "/backoffice/monitor" || /^\/backoffice\/exams\/[^/]+\/monitor$/.test(path);

export const idleLimit = () => {
  if (typeof window === "undefined") return STUDENT_IDLE_MS;
  const path = window.location.pathname;
  // Staff (back office, all pages) are never signed out for idling; students are, after STUDENT_IDLE_MS.
  return isBackofficePath(path) ? Infinity : STUDENT_IDLE_MS;
};

/** Where an idle sign-out lands: the sign-in page, on the right tab, saying why. */
export const expiredLoginUrl = () =>
  typeof window !== "undefined" && isBackofficePath(window.location.pathname) ? "/login?as=teacher&expired=30" : "/login?expired=5";

/**
 * Last time this side was used (a mouse move, a key, a tap). Lab computers are
 * shared: a student session left idle is signed out (components/IdleLogout.tsx).
 */
export function touchActivity(side?: Side) {
  try {
    window.localStorage.setItem(storageKey("lastActive", side), String(Date.now()));
  } catch {}
}

/** Milliseconds since this side was last used; Infinity when never recorded (a session from before the rule). */
export function idleFor(side?: Side): number {
  const at = Number(window.localStorage.getItem(storageKey("lastActive", side)) ?? 0);
  return at > 0 ? Date.now() - at : Infinity;
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
  window.localStorage.removeItem(storageKey("lastActive"));
}

/** Builds a /login?next=... URL that sends the user back where they were headed. */
export function loginUrl(next: string): string {
  return `/login?next=${encodeURIComponent(next)}`;
}

/** Back-office equivalent of loginUrl: the same page, on the teacher tab. */
export function backofficeLoginUrl(next: string): string {
  return `/login?as=teacher&next=${encodeURIComponent(next)}`;
}


