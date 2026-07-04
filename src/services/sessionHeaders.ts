import { auth } from "./firebase";

const userEmailKey = "kitchenready-user-email";
const dashboardIdKey = "kitchenready-dashboard-id";

export const getStoredUserEmail = (): string | null => localStorage.getItem(userEmailKey);

export const getStoredDashboardId = (): string | null => localStorage.getItem(dashboardIdKey);

export const setStoredUserEmail = (value: string | null) => {
  if (value) {
    localStorage.setItem(userEmailKey, value);
    return;
  }

  localStorage.removeItem(userEmailKey);
};

export const setStoredDashboardId = (value: string | null) => {
  if (value) {
    localStorage.setItem(dashboardIdKey, value);
    return;
  }

  localStorage.removeItem(dashboardIdKey);
};

export const getApiBaseUrl = (): string => {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (envUrl) {
    return envUrl.replace(/\/$/, ""); // Remove trailing slash
  }
  // Default to localhost for local dev
  return "http://localhost:4000";
};

type SessionHeaderOptions = {
  userEmail?: string | null;
  dashboardId?: string | null;
};

export const getSessionHeaders = (options: SessionHeaderOptions = {}): Record<string, string> => {
  const headers: Record<string, string> = {};
  const userEmail = options.userEmail ?? getStoredUserEmail() ?? auth?.currentUser?.email ?? null;
  const dashboardId = options.dashboardId ?? getStoredDashboardId();

  if (userEmail) {
    headers["x-user-email"] = userEmail;
  }

  if (dashboardId) {
    headers["x-dashboard-id"] = dashboardId;
  }

  return headers;
};
