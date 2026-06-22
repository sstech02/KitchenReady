import { useMemo, useState, type FormEvent } from "react";
import type { PrepItem } from "../models/PrepItem";
import { PREP_STATUSES } from "../models/PrepStatus";
import { UNITS } from "../models/Unit";
import { getApiBaseUrl, getSessionHeaders } from "../services/sessionHeaders";

type Props = {
  adminEmail: string;
  items: PrepItem[];
  onClose: () => void;
  onItemsChanged: () => Promise<void>;
};

type DraftItem = {
  name: string;
  station: string;
  parLevel: number;
  onHand: number;
  targetQty: number;
  unit: PrepItem["unit"];
  priority: PrepItem["priority"];
  status: PrepItem["status"];
  assignedTo: string;
  notes: string;
};

const emptyDraft: DraftItem = {
  name: "",
  station: "",
  parLevel: 0,
  onHand: 0,
  targetQty: 0,
  unit: "each",
  priority: 2,
  status: "todo",
  assignedTo: "",
  notes: "",
};

const toPayload = (draft: DraftItem): Omit<PrepItem, "id"> => ({
  name: draft.name.trim(),
  station: draft.station.trim() || undefined,
  parLevel: Math.max(0, Number(draft.parLevel) || 0),
  onHand: Math.max(0, Number(draft.onHand) || 0),
  targetQty: Math.max(0, Number(draft.targetQty) || 0),
  unit: draft.unit,
  priority: draft.priority,
  status: draft.status,
  assignedTo: draft.assignedTo.trim() || undefined,
  notes: draft.notes.trim() || undefined,
});

function AdminPrepPanel({ adminEmail, items, onClose, onItemsChanged }: Props) {
  const [creating, setCreating] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [newItem, setNewItem] = useState<DraftItem>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<DraftItem>(emptyDraft);

  const sortedItems = useMemo(
    () => [...items].sort((a, b) => a.name.localeCompare(b.name)),
    [items],
  );

  const beginEdit = (item: PrepItem) => {
    setError("");
    setMessage("");
    setEditingId(item.id);
    setEditDraft({
      name: item.name,
      station: item.station ?? "",
      parLevel: item.parLevel,
      onHand: item.onHand,
      targetQty: item.targetQty,
      unit: item.unit,
      priority: item.priority,
      status: item.status,
      assignedTo: item.assignedTo ?? "",
      notes: item.notes ?? "",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft(emptyDraft);
  };

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!newItem.name.trim()) {
      setError("Name is required.");
      return;
    }

    const payload = toPayload(newItem);
    setCreating(true);

    try {
      const res = await fetch(`${getApiBaseUrl()}/api/prep-items`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-email": adminEmail,
          ...getSessionHeaders(),
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`Failed to create item (${res.status}).`);
      }

      await onItemsChanged();
      setNewItem(emptyDraft);
      setMessage("Prep item created.");
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Failed to create item.");
    } finally {
      setCreating(false);
    }
  };

  const handleSave = async (id: string) => {
    setError("");
    setMessage("");

    if (!editingId || editingId !== id) {
      return;
    }

    if (!editDraft.name.trim()) {
      setError("Name is required.");
      return;
    }

    setSavingId(id);

    try {
      const payload = { ...toPayload(editDraft), id };
      const res = await fetch(`http://localhost:4000/api/prep-items/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-user-email": adminEmail,
          ...getSessionHeaders(),
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`Failed to update item (${res.status}).`);
      }

      await onItemsChanged();
      setEditingId(null);
      setMessage("Prep item updated.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to update item.");
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    setError("");
    setMessage("");

    const confirmed = window.confirm(`Delete prep item '${name}'?`);
    if (!confirmed) {
      return;
    }

    setDeletingId(id);

    try {
      const res = await fetch(`http://localhost:4000/api/prep-items/${id}`, {
        method: "DELETE",
        headers: {
          "x-user-email": adminEmail,
          ...getSessionHeaders(),
        },
      });

      if (!res.ok) {
        throw new Error(`Failed to delete item (${res.status}).`);
      }

      await onItemsChanged();
      if (editingId === id) {
        cancelEdit();
      }
      setMessage("Prep item deleted.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete item.");
    } finally {
      setDeletingId(null);
    }
  };

  const isBusy = creating || savingId !== null || deletingId !== null;

  return (
    <div className="handover-overlay" role="dialog" aria-modal="true" aria-label="Admin prep management panel">
      <div className="handover-panel admin-panel">
        <header className="handover-header admin-header">
          <div>
            <p className="handover-eyebrow">Admin</p>
            <h2 className="handover-title">Prep List Management</h2>
          </div>
          <button type="button" className="handover-close" onClick={onClose} aria-label="Close admin panel">
            X
          </button>
        </header>

        <div className="admin-panel-body">
          <section className="admin-create-card" aria-label="Create prep item">
            <h3 className="admin-section-title">Add New Prep Item</h3>
            <form className="admin-form-grid" onSubmit={handleCreate}>
              <label className="admin-field">
                <span>Name</span>
                <input
                  type="text"
                  value={newItem.name}
                  onChange={(event) => setNewItem((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="Roasted Garlic Aioli"
                  required
                />
              </label>

              <label className="admin-field">
                <span>Station</span>
                <input
                  type="text"
                  value={newItem.station}
                  onChange={(event) => setNewItem((prev) => ({ ...prev, station: event.target.value }))}
                  placeholder="Cold prep"
                />
              </label>

              <label className="admin-field">
                <span>Par Level</span>
                <input
                  type="number"
                  min={0}
                  value={newItem.parLevel}
                  onChange={(event) => setNewItem((prev) => ({ ...prev, parLevel: Number(event.target.value) }))}
                />
              </label>

              <label className="admin-field">
                <span>On Hand</span>
                <input
                  type="number"
                  min={0}
                  value={newItem.onHand}
                  onChange={(event) => setNewItem((prev) => ({ ...prev, onHand: Number(event.target.value) }))}
                />
              </label>

              <label className="admin-field">
                <span>Target Qty</span>
                <input
                  type="number"
                  min={0}
                  value={newItem.targetQty}
                  onChange={(event) => setNewItem((prev) => ({ ...prev, targetQty: Number(event.target.value) }))}
                />
              </label>

              <label className="admin-field">
                <span>Unit</span>
                <select
                  value={newItem.unit}
                  onChange={(event) =>
                    setNewItem((prev) => ({ ...prev, unit: event.target.value as PrepItem["unit"] }))
                  }
                >
                  {UNITS.map((unit) => (
                    <option key={unit} value={unit}>
                      {unit}
                    </option>
                  ))}
                </select>
              </label>

              <label className="admin-field">
                <span>Priority</span>
                <select
                  value={newItem.priority}
                  onChange={(event) =>
                    setNewItem((prev) => ({ ...prev, priority: Number(event.target.value) as PrepItem["priority"] }))
                  }
                >
                  <option value={1}>High</option>
                  <option value={2}>Medium</option>
                  <option value={3}>Low</option>
                </select>
              </label>

              <label className="admin-field">
                <span>Status</span>
                <select
                  value={newItem.status}
                  onChange={(event) =>
                    setNewItem((prev) => ({ ...prev, status: event.target.value as PrepItem["status"] }))
                  }
                >
                  {PREP_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>

              <label className="admin-field">
                <span>Assigned To</span>
                <input
                  type="text"
                  value={newItem.assignedTo}
                  onChange={(event) => setNewItem((prev) => ({ ...prev, assignedTo: event.target.value }))}
                  placeholder="Sam"
                />
              </label>

              <label className="admin-field admin-field-wide">
                <span>Notes</span>
                <textarea
                  rows={2}
                  value={newItem.notes}
                  onChange={(event) => setNewItem((prev) => ({ ...prev, notes: event.target.value }))}
                  placeholder="Any prep notes for shifts"
                />
              </label>

              <div className="admin-actions admin-field-wide">
                <button type="submit" className="admin-primary-btn" disabled={isBusy}>
                  {creating ? "Adding..." : "Add Prep Item"}
                </button>
              </div>
            </form>
          </section>

          <section className="admin-list-card" aria-label="Edit and delete prep items">
            <h3 className="admin-section-title">Existing Prep Items</h3>

            <div className="admin-item-list">
              {sortedItems.map((item) => {
                const isEditing = editingId === item.id;
                const draft = isEditing
                  ? editDraft
                  : {
                      name: item.name,
                      station: item.station ?? "",
                      parLevel: item.parLevel,
                      onHand: item.onHand,
                      targetQty: item.targetQty,
                      unit: item.unit,
                      priority: item.priority,
                      status: item.status,
                      assignedTo: item.assignedTo ?? "",
                      notes: item.notes ?? "",
                    };

                return (
                  <article key={item.id} className="admin-item-row">
                    <div className="admin-item-head">
                      <strong>{item.name}</strong>
                      <span className="admin-item-id">{item.id}</span>
                    </div>

                    <div className="admin-edit-grid">
                      <label className="admin-field">
                        <span>Name</span>
                        <input
                          type="text"
                          value={draft.name}
                          onChange={(event) =>
                            isEditing &&
                            setEditDraft((prev) => ({ ...prev, name: event.target.value }))
                          }
                          disabled={!isEditing}
                        />
                      </label>

                      <label className="admin-field">
                        <span>Station</span>
                        <input
                          type="text"
                          value={draft.station}
                          onChange={(event) =>
                            isEditing &&
                            setEditDraft((prev) => ({ ...prev, station: event.target.value }))
                          }
                          disabled={!isEditing}
                        />
                      </label>

                      <label className="admin-field">
                        <span>Par</span>
                        <input
                          type="number"
                          min={0}
                          value={draft.parLevel}
                          onChange={(event) =>
                            isEditing &&
                            setEditDraft((prev) => ({ ...prev, parLevel: Number(event.target.value) }))
                          }
                          disabled={!isEditing}
                        />
                      </label>

                      <label className="admin-field">
                        <span>On Hand</span>
                        <input
                          type="number"
                          min={0}
                          value={draft.onHand}
                          onChange={(event) =>
                            isEditing &&
                            setEditDraft((prev) => ({ ...prev, onHand: Number(event.target.value) }))
                          }
                          disabled={!isEditing}
                        />
                      </label>

                      <label className="admin-field">
                        <span>Target</span>
                        <input
                          type="number"
                          min={0}
                          value={draft.targetQty}
                          onChange={(event) =>
                            isEditing &&
                            setEditDraft((prev) => ({ ...prev, targetQty: Number(event.target.value) }))
                          }
                          disabled={!isEditing}
                        />
                      </label>

                      <label className="admin-field">
                        <span>Unit</span>
                        <select
                          value={draft.unit}
                          onChange={(event) =>
                            isEditing &&
                            setEditDraft((prev) => ({ ...prev, unit: event.target.value as PrepItem["unit"] }))
                          }
                          disabled={!isEditing}
                        >
                          {UNITS.map((unit) => (
                            <option key={unit} value={unit}>
                              {unit}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="admin-field">
                        <span>Priority</span>
                        <select
                          value={draft.priority}
                          onChange={(event) =>
                            isEditing &&
                            setEditDraft((prev) => ({
                              ...prev,
                              priority: Number(event.target.value) as PrepItem["priority"],
                            }))
                          }
                          disabled={!isEditing}
                        >
                          <option value={1}>High</option>
                          <option value={2}>Medium</option>
                          <option value={3}>Low</option>
                        </select>
                      </label>

                      <label className="admin-field">
                        <span>Status</span>
                        <select
                          value={draft.status}
                          onChange={(event) =>
                            isEditing &&
                            setEditDraft((prev) => ({ ...prev, status: event.target.value as PrepItem["status"] }))
                          }
                          disabled={!isEditing}
                        >
                          {PREP_STATUSES.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="admin-field">
                        <span>Assigned</span>
                        <input
                          type="text"
                          value={draft.assignedTo}
                          onChange={(event) =>
                            isEditing &&
                            setEditDraft((prev) => ({ ...prev, assignedTo: event.target.value }))
                          }
                          disabled={!isEditing}
                        />
                      </label>

                      <label className="admin-field admin-field-wide">
                        <span>Notes</span>
                        <textarea
                          rows={2}
                          value={draft.notes}
                          onChange={(event) =>
                            isEditing &&
                            setEditDraft((prev) => ({ ...prev, notes: event.target.value }))
                          }
                          disabled={!isEditing}
                        />
                      </label>
                    </div>

                    <div className="admin-actions">
                      {!isEditing && (
                        <button
                          type="button"
                          className="admin-secondary-btn"
                          onClick={() => beginEdit(item)}
                          disabled={isBusy}
                        >
                          Edit
                        </button>
                      )}

                      {isEditing && (
                        <>
                          <button
                            type="button"
                            className="admin-primary-btn"
                            onClick={() => void handleSave(item.id)}
                            disabled={isBusy}
                          >
                            {savingId === item.id ? "Saving..." : "Save"}
                          </button>
                          <button
                            type="button"
                            className="admin-secondary-btn"
                            onClick={cancelEdit}
                            disabled={isBusy}
                          >
                            Cancel
                          </button>
                        </>
                      )}

                      <button
                        type="button"
                        className="admin-danger-btn"
                        onClick={() => void handleDelete(item.id, item.name)}
                        disabled={isBusy}
                      >
                        {deletingId === item.id ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          {message && <p className="login-success">{message}</p>}
          {error && <p className="login-error">{error}</p>}
        </div>
      </div>
    </div>
  );
}

export default AdminPrepPanel;
