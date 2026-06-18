export const ROLES = ["viewer", "operator", "lead", "admin"] as const;

export type Role = (typeof ROLES)[number];

export const roleRank: Record<Role, number> = {
  viewer: 0,
  operator: 1,
  lead: 2,
  admin: 3,
};

export const hasRoleAtLeast = (actual: Role | null | undefined, minimum: Role): boolean => {
  if (!actual) {
    return false;
  }

  return roleRank[actual] >= roleRank[minimum];
};
