import {
  backofficeLoginUrl,
  getStoredAccessToken as getAccessToken,
  getStoredRefreshToken,
  isBackofficePath,
  loginUrl,
  logout,
  storeAccessToken,
} from "./auth";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/** A non-2xx API response; `status` lets callers tell e.g. 410 (attempt reset) from other failures. */
export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

// One refresh at a time: the exam screen fires several requests at once when the token expires.
let refreshing: Promise<boolean> | null = null;

/** Swaps this side's (student or back office) refresh token for a new access token. */
function refreshAccessToken(): Promise<boolean> {
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) return Promise.resolve(false);
  refreshing ??= fetch(`${API_BASE}/api/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  })
    .then(async (res) => {
      if (!res.ok) return false;
      const { accessToken } = (await res.json()) as { accessToken: string };
      storeAccessToken(accessToken);
      return true;
    })
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const send = () => {
    const token = getAccessToken();
    return fetch(`${API_BASE}${path}`, {
      ...init,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });
  };

  let res = await send();
  // Access tokens are short-lived (15 min); renew once and retry instead of failing mid-exam.
  if (res.status === 401 && getAccessToken() && !path.startsWith("/api/auth/")) {
    if (await refreshAccessToken()) {
      res = await send();
    } else {
      // The session can't be renewed (e.g. signed in before refresh tokens were kept): sign in again.
      const backoffice = isBackofficePath(window.location.pathname);
      const here = window.location.pathname + window.location.search;
      logout();
      window.location.href = backoffice ? backofficeLoginUrl(here) : loginUrl(here);
      throw new ApiError("เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่", 401);
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(body.error ?? "Request failed", res.status);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/** Like apiFetch, but sends a FormData body (file uploads) without forcing JSON headers. */
export async function apiUpload<T>(path: string, formData: FormData): Promise<T> {
  const token = getAccessToken();
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    credentials: "include",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: formData,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? "Request failed");
  }

  return res.json() as Promise<T>;
}
