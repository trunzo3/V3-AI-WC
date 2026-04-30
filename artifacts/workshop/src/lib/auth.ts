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
