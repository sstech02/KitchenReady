import type { Role } from "./Role";

export interface Dashboard {
  id: string;
  businessName: string;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardMembership {
  id: string;
  dashboardId: string;
  userEmail: string;
  role: Role;
  createdAt: string;
  updatedAt: string;
}

export type DashboardSummary = Dashboard & {
  role: Role;
};
