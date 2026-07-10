export interface Session {
  email: string;
  participantId: number;
  cohortId?: number;
  cohortCode?: string;
  name?: string;
}

const KEY = "workshop-session";

export function getSession(): Session | null {
  try {
    const data = localStorage.getItem(KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export function setSession(session: Session) {
  localStorage.setItem(KEY, JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem(KEY);
}

export function getAdminAuth(): boolean {
  return localStorage.getItem("admin-authenticated") === "true";
}

export function setAdminAuth(authenticated: boolean) {
  if (authenticated) {
    localStorage.setItem("admin-authenticated", "true");
  } else {
    localStorage.removeItem("admin-authenticated");
  }
}

export const ADMIN_SESSION_EXPIRED_EVENT = "admin-session-expired";

/**
 * True when the error is a 401 from an admin API endpoint (excluding the
 * admin login endpoint itself, where 401 means "wrong password").
 */
export function isAdminAuthError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { status?: unknown; url?: unknown };
  return (
    e.status === 401 &&
    typeof e.url === "string" &&
    e.url.includes("/api/admin") &&
    !e.url.includes("/api/admin/login")
  );
}

let expiredHandled = false;

/**
 * If the error is an admin-endpoint 401, clear the local admin login state,
 * show a "Session expired" toast, and notify listeners (the admin dashboard
 * redirects to the login page). Returns true when the error was handled so
 * callers can skip their generic failure toast.
 */
export function handleAdminAuthError(err: unknown): boolean {
  if (!isAdminAuthError(err)) return false;
  setAdminAuth(false);
  if (!expiredHandled) {
    expiredHandled = true;
    setTimeout(() => {
      expiredHandled = false;
    }, 2000);
    // Imported lazily to avoid a static import cycle with UI modules.
    void import("@/hooks/use-toast").then(({ toast }) => {
      toast({
        title: "Session expired — log in again",
        variant: "destructive",
      });
    });
    window.dispatchEvent(new Event(ADMIN_SESSION_EXPIRED_EVENT));
  }
  return true;
}
