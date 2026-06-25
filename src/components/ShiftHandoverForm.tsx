import { useState, type FormEvent } from "react";
import type { ShiftHandover } from "../models/ShiftHand";
import { getApiBaseUrl } from "../services/sessionHeaders";
import type { Unit } from "../models/Unit";
import type { PrepItem } from "../models/PrepItem";
import { UNITS } from "../models/Unit";
import { getSessionHeaders } from "../services/sessionHeaders";

type LowStockDraft = {
  name: string;
  onHand: number;
  unit: Unit;
};

type Props = {
  currentUserEmail: string;
  isGuestMode?: boolean;
  prepItems: PrepItem[];
  onClose: () => void;
  onSubmitted?: (handover: ShiftHandover) => void;
};

function ShiftHandoverForm({ currentUserEmail, isGuestMode = false, prepItems, onClose, onSubmitted }: Props) {
  const today = new Date().toISOString().slice(0, 10);

  const [businessDate, setBusinessDate] = useState(today);
  const [shiftType, setShiftType] = useState<ShiftHandover["shiftType"]>("am");
  const [toUser, setToUser] = useState("");
  const [summary, setSummary] = useState("");
  const [issues, setIssues] = useState<string[]>([""]);
  const [blockers, setBlockers] = useState<string[]>([""]);
  const [lowStockItems, setLowStockItems] = useState<LowStockDraft[]>([]);
  const [signedOff, setSignedOff] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // ── Issues ───────────────────────────────────────────────────────────────
  const updateIssue = (index: number, value: string) =>
    setIssues((prev) => prev.map((v, i) => (i === index ? value : v)));

  const addIssue = () => setIssues((prev) => [...prev, ""]);

  const removeIssue = (index: number) =>
    setIssues((prev) => prev.filter((_, i) => i !== index));

  // ── Blockers ─────────────────────────────────────────────────────────────
  const updateBlocker = (index: number, value: string) =>
    setBlockers((prev) => prev.map((v, i) => (i === index ? value : v)));

  const addBlocker = () => setBlockers((prev) => [...prev, ""]);

  const removeBlocker = (index: number) =>
    setBlockers((prev) => prev.filter((_, i) => i !== index));

  // ── Low Stock ────────────────────────────────────────────────────────────
  const addLowStockItem = () =>
    setLowStockItems((prev) => [...prev, { name: "", onHand: 0, unit: "each" as Unit }]);

  const updateLowStockItem = (
    index: number,
    field: keyof LowStockDraft,
    value: string | number,
  ) =>
    setLowStockItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    );

  const removeLowStockItem = (index: number) =>
    setLowStockItems((prev) => prev.filter((_, i) => i !== index));

  // ── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (isGuestMode) {
      setError("Guest mode: handovers are not saved. Sign in to submit handovers.");
      return;
    }

    setSubmitting(true);

    const now = new Date().toISOString();
    const filteredIssues = issues.filter((s) => s.trim());
    const filteredBlockers = blockers.filter((s) => s.trim());

    const handover: Omit<ShiftHandover, "id"> = {
      businessDate,
      shiftType,
      fromUser: currentUserEmail,
      toUser: toUser.trim() || undefined,
      summary,
      prepItems,
      lowStockItems: lowStockItems.length > 0 ? lowStockItems : undefined,
      issues: filteredIssues.length > 0 ? filteredIssues : undefined,
      blockers: filteredBlockers.length > 0 ? filteredBlockers : undefined,
      signedOff,
      createdAt: now,
      updatedAt: now,
    };

    try {
      const res = await fetch(`${getApiBaseUrl()}/api/handovers`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getSessionHeaders() },
        body: JSON.stringify(handover),
      });

      if (!res.ok) throw new Error(`Server error ${res.status} — handover not saved.`);

      const saved = (await res.json()) as ShiftHandover;
      onSubmitted?.(saved);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit handover.");
    } finally {
      setSubmitting(false);
    }
  };

  const doneCount = prepItems.filter((p) => p.status === "done").length;

  return (
    <div
      className="handover-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Shift handover form"
    >
      <div className="handover-panel">
        <header className="handover-header">
          <div>
            <p className="handover-eyebrow">Shift transition</p>
            <h2 className="handover-title">Handover Report</h2>
          </div>
          <button
            type="button"
            className="handover-close"
            onClick={onClose}
            aria-label="Close handover form"
          >
            ✕
          </button>
        </header>

        <form className="handover-form" onSubmit={handleSubmit} noValidate>
          {/* ── Shift Info ────────────────────────────────────────────── */}
          <section className="handover-section">
            <h3 className="handover-section-title">Shift Info</h3>

            <div className="handover-row-2">
              <label className="handover-field">
                <span>Business Date</span>
                <input
                  type="date"
                  value={businessDate}
                  onChange={(e) => setBusinessDate(e.target.value)}
                  required
                />
              </label>

              <label className="handover-field">
                <span>Shift</span>
                <select
                  value={shiftType}
                  onChange={(e) =>
                    setShiftType(e.target.value as ShiftHandover["shiftType"])
                  }
                >
                  <option value="am">AM</option>
                  <option value="pm">PM</option>
                  <option value="overnight">Overnight</option>
                </select>
              </label>
            </div>

            <div className="handover-row-2">
              <label className="handover-field">
                <span>From (you)</span>
                <input
                  type="text"
                  value={currentUserEmail}
                  readOnly
                  className="handover-readonly"
                />
              </label>

              <label className="handover-field">
                <span>Handing to</span>
                <input
                  type="text"
                  value={toUser}
                  onChange={(e) => setToUser(e.target.value)}
                  placeholder="Next cook or lead..."
                />
              </label>
            </div>

            <label className="handover-field">
              <span>
                Summary <span className="handover-required">*</span>
              </span>
              <textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                rows={3}
                placeholder="Brief overview of what was completed, any ongoing tasks, and general kitchen state..."
                required
              />
            </label>
          </section>

          {/* ── Prep Snapshot ─────────────────────────────────────────── */}
          <section className="handover-section">
            <h3 className="handover-section-title">Prep Snapshot</h3>
            <p className="handover-section-copy">
              {doneCount} of {prepItems.length} prep items marked done — snapshot
              attached automatically on submit.
            </p>

            <div className="handover-prep-snapshot">
              {prepItems.map((item) => (
                <div key={item.id} className="handover-prep-row">
                  <span className="handover-prep-name">{item.name}</span>
                  <span className={`status-pill status-${item.status}`}>
                    {item.status.replace("_", " ")}
                  </span>
                </div>
              ))}
              {prepItems.length === 0 && (
                <p className="handover-empty">No prep items loaded.</p>
              )}
            </div>
          </section>

          {/* ── Low Stock ─────────────────────────────────────────────── */}
          <section className="handover-section">
            <div className="handover-section-header">
              <h3 className="handover-section-title">Low Stock</h3>
              <button
                type="button"
                className="handover-add-btn"
                onClick={addLowStockItem}
              >
                + Add item
              </button>
            </div>

            {lowStockItems.length === 0 ? (
              <p className="handover-empty">No low stock items flagged.</p>
            ) : (
              <div className="handover-lowstock-list">
                {lowStockItems.map((item, i) => (
                  <div key={i} className="handover-lowstock-row">
                    <input
                      type="text"
                      className="handover-lowstock-name"
                      placeholder="Ingredient name"
                      value={item.name}
                      onChange={(e) => updateLowStockItem(i, "name", e.target.value)}
                    />
                    <input
                      type="number"
                      className="handover-lowstock-qty"
                      min={0}
                      step="1"
                      placeholder="0"
                      value={item.onHand}
                      onChange={(e) =>
                        updateLowStockItem(i, "onHand", parseFloat(e.target.value) || 0)
                      }
                    />
                    <select
                      className="handover-lowstock-unit"
                      value={item.unit}
                      onChange={(e) =>
                        updateLowStockItem(i, "unit", e.target.value as Unit)
                      }
                    >
                      {UNITS.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="handover-remove-btn"
                      onClick={() => removeLowStockItem(i)}
                      aria-label="Remove low stock item"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ── Issues ────────────────────────────────────────────────── */}
          <section className="handover-section">
            <div className="handover-section-header">
              <div>
                <h3 className="handover-section-title">Issues</h3>
                <p className="handover-section-copy">
                  Equipment problems, shortages, incidents.
                </p>
              </div>
              <button
                type="button"
                className="handover-add-btn"
                onClick={addIssue}
              >
                + Add issue
              </button>
            </div>

            <div className="handover-list-stack">
              {issues.map((issue, i) => (
                <div key={i} className="handover-list-row">
                  <input
                    type="text"
                    placeholder={`Issue ${i + 1}...`}
                    value={issue}
                    onChange={(e) => updateIssue(i, e.target.value)}
                  />
                  {issues.length > 1 && (
                    <button
                      type="button"
                      className="handover-remove-btn"
                      onClick={() => removeIssue(i)}
                      aria-label="Remove issue"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* ── Blockers ──────────────────────────────────────────────── */}
          <section className="handover-section">
            <div className="handover-section-header">
              <div>
                <h3 className="handover-section-title">Blockers</h3>
                <p className="handover-section-copy">
                  Tasks next shift cannot start until these are resolved.
                </p>
              </div>
              <button
                type="button"
                className="handover-add-btn"
                onClick={addBlocker}
              >
                + Add blocker
              </button>
            </div>

            <div className="handover-list-stack">
              {blockers.map((blocker, i) => (
                <div key={i} className="handover-list-row">
                  <input
                    type="text"
                    placeholder={`Blocker ${i + 1}...`}
                    value={blocker}
                    onChange={(e) => updateBlocker(i, e.target.value)}
                  />
                  {blockers.length > 1 && (
                    <button
                      type="button"
                      className="handover-remove-btn"
                      onClick={() => removeBlocker(i)}
                      aria-label="Remove blocker"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* ── Sign Off ──────────────────────────────────────────────── */}
          <section className="handover-section">
            <label className="handover-signoff">
              <input
                type="checkbox"
                checked={signedOff}
                onChange={(e) => setSignedOff(e.target.checked)}
              />
              <span>I confirm this handover report is accurate and complete</span>
            </label>
          </section>

          {error && (
            <p className="login-error" role="alert">
              {error}
            </p>
          )}

          <div className="handover-actions">
            <button
              type="button"
              className="handover-cancel-btn"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="handover-submit-btn"
              disabled={submitting}
            >
              {submitting ? "Submitting..." : "Submit Handover"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ShiftHandoverForm;
