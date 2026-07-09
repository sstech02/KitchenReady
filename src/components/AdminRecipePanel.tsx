import { useMemo, useState, type FormEvent } from "react";
import type { Recipe } from "../models/Recipe";
import { getApiBaseUrl, getSessionHeaders } from "../services/sessionHeaders";

type Props = {
  isGuestMode?: boolean;
  recipes: Recipe[];
  onGuestRecipeUpdate?: (
    recipeId: string,
    updates: Pick<Recipe, "guideText" | "videoSearchUrl">,
  ) => void;
  onGuestRecipeDelete?: (recipeId: string) => void;
  onClose: () => void;
  onRecipesChanged: () => Promise<void>;
};

type DraftRecipe = {
  name: string;
  guideText: string;
  videoSearchUrl: string;
};

function AdminRecipePanel({
  isGuestMode = false,
  recipes,
  onGuestRecipeUpdate,
  onGuestRecipeDelete,
  onClose,
  onRecipesChanged,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<DraftRecipe>({
    name: "",
    guideText: "",
    videoSearchUrl: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const sortedRecipes = useMemo(
    () => [...recipes].sort((a, b) => a.name.localeCompare(b.name)),
    [recipes],
  );

  const beginEdit = (recipe: Recipe) => {
    setError("");
    setMessage("");
    setEditingId(recipe.id);
    setEditDraft({
      name: recipe.name,
      guideText: recipe.guideText ?? "",
      videoSearchUrl: recipe.videoSearchUrl ?? "",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft({ name: "", guideText: "", videoSearchUrl: "" });
  };

  const handleDelete = async (recipe: Recipe) => {
    setError("");
    setMessage("");

    const confirmed = window.confirm(`Delete recipe '${recipe.name}'?`);
    if (!confirmed) {
      return;
    }

    if (isGuestMode) {
      onGuestRecipeDelete?.(recipe.id);
      if (editingId === recipe.id) {
        cancelEdit();
      }
      setMessage("Recipe deleted in guest mode. Changes are local and not saved.");
      return;
    }

    try {
      const response = await fetch(`${getApiBaseUrl()}/api/recipes/${recipe.id}`, {
        method: "DELETE",
        headers: {
          ...getSessionHeaders(),
        },
      });

      if (!response.ok) {
        throw new Error("Failed to delete recipe");
      }

      if (editingId === recipe.id) {
        cancelEdit();
      }

      setMessage(`Deleted recipe ${recipe.name}`);
      await onRecipesChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete recipe");
    }
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!editingId) {
      return;
    }

    if (isGuestMode) {
      setError("");
      onGuestRecipeUpdate?.(editingId, {
        guideText: editDraft.guideText.trim() || undefined,
        videoSearchUrl: editDraft.videoSearchUrl.trim() || undefined,
      });
      setEditingId(null);
      setMessage("Recipe guide updated in guest mode. Changes are local and not saved.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `${getApiBaseUrl()}/api/recipes/${editingId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...getSessionHeaders(),
          },
          body: JSON.stringify({
            guideText: editDraft.guideText.trim() || null,
            videoSearchUrl: editDraft.videoSearchUrl.trim() || null,
          }),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to update recipe");
      }

      setMessage(`Updated recipe ${editDraft.name}`);
      setEditingId(null);
      await onRecipesChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update recipe");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="handover-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Admin recipe links panel"
    >
      <div className="handover-panel admin-recipe-panel">
        <header className="handover-header">
          <div>
            <p className="handover-eyebrow">Admin</p>
            <h2 className="handover-title">Manage Recipes</h2>
            <p className="handover-subtitle">
              Edit recipes, type out the guide, and remove recipes you no longer need.
            </p>
          </div>
          <button
            type="button"
            className="handover-close"
            onClick={onClose}
            aria-label="Close recipe management panel"
          >
            ✕
          </button>
        </header>

        {message && <p className="admin-success-msg">{message}</p>}
        {error && <p className="admin-error-msg">{error}</p>}

        <div className="admin-recipe-list">
          {sortedRecipes.length === 0 ? (
            <p className="admin-state-msg">No recipes available.</p>
          ) : (
            sortedRecipes.map((recipe) => {
              const isEditing = editingId === recipe.id;

              return (
                <div key={recipe.id} className="admin-recipe-item">
                  {isEditing ? (
                    <form onSubmit={handleSave} className="admin-recipe-form">
                      <div className="admin-recipe-header">
                        <h3 className="admin-recipe-name">{editDraft.name}</h3>
                        <button
                          type="button"
                          onClick={() => void handleDelete(recipe)}
                          className="admin-danger-btn"
                          disabled={saving}
                        >
                          Delete
                        </button>
                      </div>

                      <div className="admin-form-group">
                        <label className="admin-form-label">
                          Guide
                          <textarea
                            rows={6}
                            placeholder="Type the full recipe guide here"
                            value={editDraft.guideText}
                            onChange={(e) =>
                              setEditDraft({
                                ...editDraft,
                                guideText: e.target.value,
                              })
                            }
                            className="admin-form-input"
                          />
                        </label>
                      </div>

                      <div className="admin-form-group">
                        <label className="admin-form-label">
                          Video URL
                          <input
                            type="url"
                            placeholder="https://youtube.com/watch?v=..."
                            value={editDraft.videoSearchUrl}
                            onChange={(e) =>
                              setEditDraft({
                                ...editDraft,
                                videoSearchUrl: e.target.value,
                              })
                            }
                            className="admin-form-input"
                          />
                        </label>
                      </div>

                      <div className="admin-recipe-actions">
                        <button
                          type="submit"
                          disabled={saving}
                          className="admin-btn admin-btn-primary"
                        >
                          {saving ? "Saving..." : "Save"}
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          disabled={saving}
                          className="admin-btn admin-btn-secondary"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <div className="admin-recipe-header">
                        <h3 className="admin-recipe-name">{recipe.name}</h3>
                        <div className="admin-recipe-actions">
                          <button
                            type="button"
                            onClick={() => beginEdit(recipe)}
                            className="admin-edit-btn"
                            aria-label={`Edit recipe ${recipe.name}`}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDelete(recipe)}
                            className="admin-danger-btn"
                            aria-label={`Delete recipe ${recipe.name}`}
                          >
                            Delete
                          </button>
                        </div>
                      </div>

                      <div className="admin-recipe-links">
                        {recipe.guideText ? (
                          <span className="admin-link-empty">Guide text saved</span>
                        ) : recipe.guideUrl ? (
                          <a
                            href={recipe.guideUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="admin-link"
                          >
                            🔗 Guide link
                          </a>
                        ) : (
                          <span className="admin-link-empty">No guide entered</span>
                        )}

                        {recipe.videoSearchUrl ? (
                          <a
                            href={recipe.videoSearchUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="admin-link"
                          >
                            🎥 Video
                          </a>
                        ) : (
                          <span className="admin-link-empty">No video link</span>
                        )}
                      </div>

                      {recipe.guideText && (
                        <p className="admin-recipe-guide-preview" style={{ whiteSpace: "pre-wrap" }}>
                          {recipe.guideText}
                        </p>
                      )}
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

export default AdminRecipePanel;
