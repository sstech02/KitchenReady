import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import type { DashboardMembership } from "../models/Dashboard";
import { ROLES, type Role } from "../models/Role";
import { getSessionHeaders } from "../services/sessionHeaders";

type Props = {
  dashboardId: string;
  currentUserEmail: string;
  onClose: () => void;
  onMembershipChanged?: () => Promise<void> | void;
};

const roleLabel: Record<Role, string> = {
  viewer: "Viewer",
  operator: "Operator",
  lead: "Lead",
  admin: "Admin",
};

const roleDescription: Record<Role, string> = {
  viewer:
    "Read-only access. Can view the prep list and recipes but cannot make changes.",
  operator:
    "Can update prep item quantities, statuses and par levels during a shift.",
  lead:
    "All operator permissions plus the ability to submit and view shift handover reports.",
  admin:
    "Full access. Can manage prep items, recipes, handovers and dashboard membership.",
};

const roleOptionLabel: Record<Role, string> = {
  viewer: "Viewer - Read-only",
  operator: "Operator - Update prep items",
  lead: "Lead - Submit handovers",
  admin: "Admin - Full access",
};

const toErrorMessage = (fallback: string, body: unknown): string => {
  if (!body || typeof body !== "object") {
    return fallback;
  }

  const candidate = (body as { error?: unknown }).error;
  return typeof candidate === "string" ? candidate : fallback;
};

function DashboardMembersPanel({
  dashboardId,
  currentUserEmail,
  onClose,
  onMembershipChanged,
}: Props) {
  const [members, setMembers] = useState<DashboardMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newRole, setNewRole] = useState<Role>("viewer");
  const [roleGuideOpen, setRoleGuideOpen] = useState(false);

  const sortedMembers = useMemo(
    () => [...members].sort((a, b) => a.userEmail.localeCompare(b.userEmail)),
    [members],
  );

  const requestHeaders = useMemo(
    () => ({
      ...getSessionHeaders(),
      "x-user-email": currentUserEmail,
      "x-dashboard-id": dashboardId,
      "Content-Type": "application/json",
    }),
    [currentUserEmail, dashboardId],
  );

  const loadMembers = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`http://localhost:4000/api/dashboards/${dashboardId}/members`, {
        headers: requestHeaders,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(toErrorMessage("Failed to load dashboard members.", body));
      }

      const payload = (await res.json()) as DashboardMembership[];
      setMembers(payload);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load dashboard members.");
    } finally {
      setLoading(false);
    }
  }, [dashboardId, requestHeaders]);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  const handleAddMember = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalizedEmail = newUserEmail.trim().toLowerCase();
    if (!normalizedEmail) {
      setError("User email is required.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch(`http://localhost:4000/api/dashboards/${dashboardId}/members`, {
        method: "POST",
        headers: requestHeaders,
        body: JSON.stringify({ userEmail: normalizedEmail, role: newRole }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(toErrorMessage("Failed to add member.", body));
      }

      setNewUserEmail("");
      setNewRole("viewer");
      setMessage(`Added ${normalizedEmail} as ${roleLabel[newRole]}.`);
      await loadMembers();
      await onMembershipChanged?.();
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : "Failed to add member.");
    } finally {
      setSaving(false);
    }
  };

  const handleRoleChange = async (memberId: string, role: Role) => {
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch(`http://localhost:4000/api/dashboards/${dashboardId}/members/${memberId}`, {
        method: "PUT",
        headers: requestHeaders,
        body: JSON.stringify({ role }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(toErrorMessage("Failed to update member role.", body));
      }

      setMessage("Member role updated.");
      await loadMembers();
      await onMembershipChanged?.();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Failed to update member role.");
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveMember = async (member: DashboardMembership) => {
    const confirmed = window.confirm(`Remove ${member.userEmail} from this dashboard?`);
    if (!confirmed) {
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch(
        `http://localhost:4000/api/dashboards/${dashboardId}/members/${member.id}`,
        {
          method: "DELETE",
          headers: requestHeaders,
        },
      );

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(toErrorMessage("Failed to remove member.", body));
      }

      setMessage(`Removed ${member.userEmail}.`);
      await loadMembers();
      await onMembershipChanged?.();
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Failed to remove member.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="handover-overlay" role="dialog" aria-modal="true" aria-label="Dashboard members panel">
      <div className="handover-panel members-panel">
        <header className="handover-header members-header">
          <div>
            <p className="handover-eyebrow">Dashboard Team</p>
            <h2 className="handover-title">Manage Users & Roles</h2>
          </div>
          <button type="button" className="handover-close" onClick={onClose} aria-label="Close members panel">
            X
          </button>
        </header>

        <div className="members-panel-body">
          <section className="members-invite-card" aria-label="Invite dashboard user">
            <div className="members-invite-heading">
              <h3 className="members-section-title">Add User To Dashboard</h3>
              <button
                type="button"
                className="members-guide-toggle"
                onClick={() => setRoleGuideOpen((prev) => !prev)}
                aria-expanded={roleGuideOpen}
              >
                {roleGuideOpen ? "Hide role guide" : "Role guide"}
              </button>
            </div>

            {roleGuideOpen && (
              <div className="members-role-guide" aria-label="Role descriptions">
                {ROLES.map((role) => (
                  <div key={role} className="members-role-guide-row">
                    <span className="members-role-guide-label">{roleLabel[role]}</span>
                    <span className="members-role-guide-desc">{roleDescription[role]}</span>
                  </div>
                ))}
              </div>
            )}

            <form className="members-invite-form" onSubmit={handleAddMember}>
              <label className="members-field">
                <span>User email</span>
                <input
                  type="email"
                  value={newUserEmail}
                  onChange={(event) => setNewUserEmail(event.target.value)}
                  placeholder="teammate@restaurant.com"
                  required
                />
              </label>

              <label className="members-field">
                <span>Role</span>
                <select
                  value={newRole}
                  onChange={(event) => setNewRole(event.target.value as Role)}
                >
                  {ROLES.map((role) => (
                    <option key={role} value={role}>
                      {roleOptionLabel[role]}
                    </option>
                  ))}
                </select>
              </label>

              <button type="submit" className="members-primary-btn" disabled={saving || loading}>
                {saving ? "Adding..." : "Add User"}
              </button>
            </form>
          </section>

          <section className="members-list-card" aria-label="Dashboard members">
            <h3 className="members-section-title">Current Members</h3>

            {loading && <p className="members-state">Loading members...</p>}

            {!loading && sortedMembers.length === 0 && (
              <p className="members-state">No members found for this dashboard.</p>
            )}

            {!loading && sortedMembers.length > 0 && (
              <div className="members-list">
                {sortedMembers.map((member) => {
                  const isCurrentUser = member.userEmail === currentUserEmail;

                  return (
                    <article key={member.id} className="members-row">
                      <div>
                        <p className="members-email">{member.userEmail}</p>
                        <p className="members-meta">
                          {isCurrentUser ? "You · " : ""}{roleLabel[member.role]}
                        </p>
                        <p className="members-role-desc">{roleDescription[member.role]}</p>
                      </div>

                      <div className="members-actions">
                        <select
                          className="members-role-select"
                          value={member.role}
                          disabled={saving}
                          onChange={(event) => void handleRoleChange(member.id, event.target.value as Role)}
                        >
                          {ROLES.map((role) => (
                            <option key={role} value={role}>
                              {roleOptionLabel[role]}
                            </option>
                          ))}
                        </select>

                        <button
                          type="button"
                          className="members-danger-btn"
                          disabled={saving}
                          onClick={() => void handleRemoveMember(member)}
                        >
                          Remove
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          {message && <p className="login-success">{message}</p>}
          {error && <p className="login-error">{error}</p>}
        </div>
      </div>
    </div>
  );
}

export default DashboardMembersPanel;
