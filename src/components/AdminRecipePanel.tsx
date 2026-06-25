import { useMemo, useState, type FormEvent } from "react";
import type { Recipe } from "../models/Recipe";
import { getApiBaseUrl, getSessionHeaders } from "../services/sessionHeaders";

type Props = {
  isGuestMode?: boolean;
  recipes: Recipe[];
  onGuestRecipeUpdate?: (recipeId: string, updates: Pick<Recipe, "guideUrl" | "videoSearchUrl">) => void;
  onClose: () => void;
  onRecipesChanged: () => Promise<void>;
};

type DraftRecipe = {
  name: string;
  guideUrl: string;
  videoSearchUrl: string;
};

function AdminRecipePanel({
  isGuestMode = false,
  recipes,
  onGuestRecipeUpdate,
  onClose,
  onRecipesChanged,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<DraftRecipe>({
    name: "",
    guideUrl: "",
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
      guideUrl: recipe.guideUrl ?? "",
      videoSearchUrl: recipe.videoSearchUrl ?? "",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft({ name: "", guideUrl: "", videoSearchUrl: "" });
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!editingId) {
      return;
    }

    if (isGuestMode) {
      setError("");
      onGuestRecipeUpdate?.(editingId, {
        guideUrl: editDraft.guideUrl.trim() || undefined,
        videoSearchUrl: editDraft.videoSearchUrl.trim() || undefined,
      });
      setEditingId(null);
      setMessage("Recipe links updated in guest mode. Changes are local and not saved.");
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
            guideUrl: editDraft.guideUrl.trim() || null,
            videoSearchUrl: editDraft.videoSearchUrl.trim() || null,
          }),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to update recipe links");
      }

      setMessage(`Updated links for ${editDraft.name}`);
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
            <h2 className="handover-title">Recipe Links</h2>
            <p className="handover-subtitle">
              Add guide and video URLs to recipes. These links will appear in the
              recipe scaler when users view recipe details.
            </p>
          </div>
          <button
            type="button"
            className="handover-close"
            onClick={onClose}
            aria-label="Close recipe links panel"
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
                      </div>

                      <div className="admin-form-group">
                        <label className="admin-form-label">
                          Guide URL
                          <input
                            type="url"
                            placeholder="https://example.com/recipe-guide"
                            value={editDraft.guideUrl}
                            onChange={(e) =>
                              setEditDraft({
                                ...editDraft,
                                guideUrl: e.target.value,
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
                        <button
                          type="button"
                          onClick={() => beginEdit(recipe)}
                          className="admin-edit-btn"
                          aria-label={`Edit links for ${recipe.name}`}
                        >
                          Edit
                        </button>
                      </div>

                      <div className="admin-recipe-links">
                        {recipe.guideUrl ? (
                          <a
                            href={recipe.guideUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="admin-link"
                          >
                            🔗 Guide
                          </a>
                        ) : (
                          <span className="admin-link-empty">No guide link</span>
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
