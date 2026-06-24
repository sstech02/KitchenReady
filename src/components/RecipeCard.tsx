import { useState } from "react";
import type { Recipe } from "../models/Recipe";
import { scaleRecipeByFactor } from "../models/Recipe";

type RecipeCardProps = {
  recipe: Recipe;
};

const scaleFactors = [0.5, 1, 2, 3] as const;

const formatFactor = (factor: number) => {
  if (factor === 0.5) {
    return "Half batch";
  }

  if (factor === 1) {
    return "Base";
  }

  return `${factor}x`;
};

function RecipeCard({ recipe }: RecipeCardProps) {
  const [selectedFactor, setSelectedFactor] = useState<number>(1);

  const scaledRecipe =
    selectedFactor === 1 ? recipe : scaleRecipeByFactor(recipe, selectedFactor);

  return (
    <article className="recipe-card" aria-label={`Recipe ${recipe.name}`}>
      <header className="recipe-card-header">
        <div>
          <p className="recipe-category">{recipe.category || "General prep"}</p>
          <h3 className="recipe-title">{recipe.name}</h3>
        </div>

        <div className="recipe-yield-wrap">
          <span className="recipe-yield-label">Yield</span>
          <strong className="recipe-yield-value">
            {scaledRecipe.yieldAmount} {scaledRecipe.yieldUnit}
          </strong>
        </div>
      </header>

      <div className="recipe-scale-controls" aria-label={`Scale ${recipe.name}`}>
        {scaleFactors.map((factor) => (
          <button
            key={factor}
            type="button"
            className={`recipe-scale-button${selectedFactor === factor ? " is-active" : ""}`}
            onClick={() => setSelectedFactor(factor)}
          >
            {formatFactor(factor)}
          </button>
        ))}
      </div>

      {(recipe.guideUrl || recipe.videoSearchUrl) && (
        <div className="recipe-resource-actions" aria-label={`${recipe.name} learning resources`}>
          {recipe.guideUrl && (
            <a
              className="recipe-resource-link"
              href={recipe.guideUrl}
              target="_blank"
              rel="noreferrer"
            >
              Open guide
            </a>
          )}

          {recipe.videoSearchUrl && (
            <a
              className="recipe-resource-link recipe-resource-link-secondary"
              href={recipe.videoSearchUrl}
              target="_blank"
              rel="noreferrer"
            >
              Search video
            </a>
          )}
        </div>
      )}

      <section className="recipe-ingredients" aria-label={`${recipe.name} ingredients`}>
        {scaledRecipe.ingredients.map((ingredient) => (
          <div key={ingredient.id} className="recipe-ingredient-row">
            <span className="recipe-ingredient-name">{ingredient.name}</span>
            <span className="recipe-ingredient-qty">
              {ingredient.quantity} {ingredient.unit}
            </span>
          </div>
        ))}
      </section>
    </article>
  );
}

export default RecipeCard;