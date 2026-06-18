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

export const getSessionHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {};
  const userEmail = getStoredUserEmail();
  const dashboardId = getStoredDashboardId();

  if (userEmail) {
    headers["x-user-email"] = userEmail;
  }

  if (dashboardId) {
    headers["x-dashboard-id"] = dashboardId;
  }

  return headers;
};
