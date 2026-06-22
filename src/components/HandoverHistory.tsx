import { useEffect, useState } from "react";
import type { ShiftHandover } from "../models/ShiftHand";
import { getApiBaseUrl, getSessionHeaders } from "../services/sessionHeaders";

type Props = {
  onClose: () => void;
};

const shiftLabel: Record<ShiftHandover["shiftType"], string> = {
  am: "AM",
  pm: "PM",
  overnight: "Overnight",
};

const shiftColor: Record<ShiftHandover["shiftType"], string> = {
  am: "hist-badge-am",
  pm: "hist-badge-pm",
  overnight: "hist-badge-overnight",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function HandoverHistory({ onClose }: Props) {
  const [handovers, setHandovers] = useState<ShiftHandover[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterShift, setFilterShift] = useState<ShiftHandover["shiftType"] | "all">("all");

  useEffect(() => {
    const controller = new AbortController();

    fetch(`${getApiBaseUrl()}/api/handovers`, {
      signal: controller.signal,
      headers: { ...getSessionHeaders() },
    })
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load handovers (${res.status})`);
        return res.json() as Promise<ShiftHandover[]>;
      })
      .then((data) => {
        // Newest first
        const sorted = [...data].sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
        setHandovers(sorted);
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name !== "AbortError") {
          setError(err.message);
        }
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, []);

  const toggle = (id: string) =>
    setExpandedId((prev) => (prev === id ? null : id));

  const visible =
    filterShift === "all"
      ? handovers
      : handovers.filter((h) => h.shiftType === filterShift);

  return (
    <div
      className="handover-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Handover history"
    >
      <div className="handover-panel">
        {/* ── Header ───────────────────────────────────────────────────── */}
        <header className="handover-header">
          <div>
            <p className="handover-eyebrow">Incoming shift</p>
            <h2 className="handover-title">Handover History</h2>
          </div>
          <button
            type="button"
            className="handover-close"
            onClick={onClose}
            aria-label="Close handover history"
          >
            ✕
          </button>
        </header>

        {/* ── Filter bar ───────────────────────────────────────────────── */}
        <div className="hist-filter-bar">
          {(["all", "am", "pm", "overnight"] as const).map((s) => (
            <button
              key={s}
              type="button"
              className={`hist-filter-btn${filterShift === s ? " is-active" : ""}`}
              onClick={() => setFilterShift(s)}
            >
              {s === "all" ? "All shifts" : shiftLabel[s]}
            </button>
          ))}
        </div>

        {/* ── Body ─────────────────────────────────────────────────────── */}
        <div className="hist-body">
          {loading && <p className="hist-state-msg">Loading handovers…</p>}

          {!loading && error && (
            <p className="hist-state-msg hist-state-error">{error}</p>
          )}

          {!loading && !error && visible.length === 0 && (
            <p className="hist-state-msg">No handovers found.</p>
          )}

          {!loading && !error && visible.length > 0 && (
            <ul className="hist-list" role="list">
              {visible.map((h) => {
                const isOpen = expandedId === h.id;
                const doneItems = h.prepItems.filter(
                  (p) => p.status === "done",
                ).length;

                return (
                  <li key={h.id} className={`hist-card${isOpen ? " is-open" : ""}`}>
                    {/* Summary row */}
                    <button
                      type="button"
                      className="hist-card-trigger"
                      onClick={() => toggle(h.id)}
                      aria-expanded={isOpen}
                    >
                      <div className="hist-card-meta">
                        <span className={`hist-badge ${shiftColor[h.shiftType]}`}>
                          {shiftLabel[h.shiftType]}
                        </span>
                        <span className="hist-date">{formatDate(h.businessDate)}</span>
                        {h.signedOff && (
                          <span className="hist-signoff-badge">Signed off</span>
                        )}
                      </div>

                      <div className="hist-card-summary">
                        <span className="hist-from">
                          {h.fromUser}
                          {h.toUser ? ` → ${h.toUser}` : ""}
                        </span>
                        <span className="hist-chevron">{isOpen ? "▲" : "▼"}</span>
                      </div>
                    </button>

                    {/* Expanded detail */}
                    {isOpen && (
                      <div className="hist-detail">
                        {/* Summary text */}
                        <section className="hist-detail-section">
                          <h4 className="hist-detail-heading">Summary</h4>
                          <p className="hist-detail-body">{h.summary}</p>
                        </section>

                        {/* Prep snapshot */}
                        <section className="hist-detail-section">
                          <h4 className="hist-detail-heading">
                            Prep Snapshot
                            <span className="hist-detail-count">
                              {doneItems}/{h.prepItems.length} done
                            </span>
                          </h4>
                          <div className="hist-prep-list">
                            {h.prepItems.map((item) => (
                              <div key={item.id} className="hist-prep-row">
                                <span className="hist-prep-name">{item.name}</span>
                                <span
                                  className={`status-pill status-${item.status}`}
                                >
                                  {item.status.replace("_", " ")}
                                </span>
                              </div>
                            ))}
                          </div>
                        </section>

                        {/* Low stock */}
                        {h.lowStockItems && h.lowStockItems.length > 0 && (
                          <section className="hist-detail-section">
                            <h4 className="hist-detail-heading">Low Stock</h4>
                            <ul className="hist-tag-list">
                              {h.lowStockItems.map((item, i) => (
                                <li key={i} className="hist-tag hist-tag-warn">
                                  {item.name} — {item.onHand} {item.unit}
                                </li>
                              ))}
                            </ul>
                          </section>
                        )}

                        {/* Issues */}
                        {h.issues && h.issues.length > 0 && (
                          <section className="hist-detail-section">
                            <h4 className="hist-detail-heading">Issues</h4>
                            <ul className="hist-tag-list">
                              {h.issues.map((issue, i) => (
                                <li key={i} className="hist-tag hist-tag-issue">
                                  {issue}
                                </li>
                              ))}
                            </ul>
                          </section>
                        )}

                        {/* Blockers */}
                        {h.blockers && h.blockers.length > 0 && (
                          <section className="hist-detail-section">
                            <h4 className="hist-detail-heading">Blockers</h4>
                            <ul className="hist-tag-list">
                              {h.blockers.map((blocker, i) => (
                                <li key={i} className="hist-tag hist-tag-blocker">
                                  {blocker}
                                </li>
                              ))}
                            </ul>
                          </section>
                        )}

                        <p className="hist-timestamp">
                          Submitted {new Date(h.createdAt).toLocaleString()}
                        </p>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export default HandoverHistory;
