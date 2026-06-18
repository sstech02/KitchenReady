type ClaimBag = Record<string, unknown>;

const parseAdminEmails = (value: string | undefined): string[] =>
  (value ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

const normalizeEmail = (value: string): string => value.trim().toLowerCase();

const isValidEmail = (value: string): boolean => /.+@.+\..+/.test(value);

export const ADMIN_EMAIL_ALLOWLIST = parseAdminEmails(import.meta.env.VITE_ADMIN_EMAILS);
const runtimeAdminEmailAllowlist = new Set(ADMIN_EMAIL_ALLOWLIST);

export const getAdminAccounts = (): string[] =>
  Array.from(runtimeAdminEmailAllowlist).sort((a, b) => a.localeCompare(b));

export const addAdminAccount = (email: string): boolean => {
  const normalizedEmail = normalizeEmail(email);

  if (!isValidEmail(normalizedEmail)) {
    return false;
  }

  runtimeAdminEmailAllowlist.add(normalizedEmail);
  return true;
};

export const removeAdminAccount = (email: string): boolean => {
  const normalizedEmail = normalizeEmail(email);
  return runtimeAdminEmailAllowlist.delete(normalizedEmail);
};

export const hasAdminEmailAccess = (email?: string | null): boolean => {
  if (!email) {
    return false;
  }

  return runtimeAdminEmailAllowlist.has(normalizeEmail(email));
};

export const hasAdminRoleClaim = (claims?: ClaimBag): boolean => {
  if (!claims) {
    return false;
  }

  const adminClaim = claims.admin;
  if (adminClaim === true) {
    return true;
  }

  const roleClaim = claims.role;
  if (typeof roleClaim === "string" && roleClaim.toLowerCase() === "admin") {
    return true;
  }

  const rolesClaim = claims.roles;
  if (Array.isArray(rolesClaim)) {
    return rolesClaim.some(
      (role) => typeof role === "string" && role.toLowerCase() === "admin",
    );
  }

  return false;
};

export const isAuthorizedAdmin = (email?: string | null, claims?: ClaimBag): boolean =>
  hasAdminRoleClaim(claims) || hasAdminEmailAccess(email);
