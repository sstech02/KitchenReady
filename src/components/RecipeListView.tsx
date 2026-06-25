import type { DragEvent } from "react";
import type { Recipe } from "../models/Recipe";

type RecipeListViewProps = {
  recipes: Recipe[];
  activeRecipeId: string | null;
  dragOverRecipeId: string | null;
  onSelectRecipe: (recipeId: string) => void;
  onRecipeDragStart: (recipeId: string, event: DragEvent<HTMLDivElement>) => void;
  onRecipeDragEnd: () => void;
  onRecipeDragOver: (recipeId: string, event: DragEvent<HTMLDivElement>) => void;
  onRecipeDragLeave: (recipeId: string) => void;
  onRecipeDrop: (recipeId: string, event: DragEvent<HTMLDivElement>) => void;
};

function RecipeListView({
  recipes,
  activeRecipeId,
  dragOverRecipeId,
  onSelectRecipe,
  onRecipeDragStart,
  onRecipeDragEnd,
  onRecipeDragOver,
  onRecipeDragLeave,
  onRecipeDrop,
}: RecipeListViewProps) {
  if (recipes.length === 0) {
    return <p className="recipe-empty-message">No recipes available for this dashboard.</p>;
  }

  return (
    <ul className="recipe-list-view" aria-label="Recipe list">
      {recipes.map((recipe) => (
        <li key={recipe.id}>
          <div
            className={`recipe-list-item${activeRecipeId === recipe.id ? " is-active" : ""}${dragOverRecipeId === recipe.id ? " is-drop-target" : ""}`}
            draggable
            onDragStart={(event) => onRecipeDragStart(recipe.id, event)}
            onDragEnd={onRecipeDragEnd}
            onDragOver={(event) => onRecipeDragOver(recipe.id, event)}
            onDragLeave={() => onRecipeDragLeave(recipe.id)}
            onDrop={(event) => onRecipeDrop(recipe.id, event)}
          >
          <button
            type="button"
            className="recipe-list-select"
            onClick={() => onSelectRecipe(recipe.id)}
            aria-pressed={activeRecipeId === recipe.id}
          >
            <span className="recipe-list-name">{recipe.name}</span>
            <span className="recipe-list-yield">
              {recipe.yieldAmount} {recipe.yieldUnit}
            </span>
          </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

export default RecipeListView;
