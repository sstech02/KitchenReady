import { useEffect, useMemo, useState } from "react";
import type { Recipe } from "../models/Recipe";
import { scaleRecipeForYield } from "../utils/recipeScaler";

type RecipeDetailViewProps = {
  recipe: Recipe | null;
};

const parseTargetYield = (value: string): number | null => {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
};

const buildGuideSearchUrl = (recipeName: string) => {
  const query = encodeURIComponent(`${recipeName} recipe`);
  return `https://www.google.com/search?q=${query}`;
};

const buildVideoSearchUrl = (recipeName: string) => {
  const query = encodeURIComponent(`${recipeName} recipe`);
  return `https://www.youtube.com/results?search_query=${query}`;
};

function RecipeDetailView({ recipe }: RecipeDetailViewProps) {
  const [targetYieldInput, setTargetYieldInput] = useState("");

  useEffect(() => {
    if (!recipe) {
      setTargetYieldInput("");
      return;
    }

    setTargetYieldInput(String(recipe.yieldAmount));
  }, [recipe]);

  const targetYield = parseTargetYield(targetYieldInput);

  const scaledRecipe = useMemo(() => {
    if (!recipe || targetYield === null) {
      return recipe;
    }

    return scaleRecipeForYield(recipe, targetYield);
  }, [recipe, targetYield]);

  if (!recipe || !scaledRecipe) {
    return (
      <div className="recipe-detail-empty" aria-live="polite">
        Select a recipe to view details.
      </div>
    );
  }

  const ratio = targetYield === null ? null : targetYield / recipe.yieldAmount;
  const guideText = scaledRecipe.guideText?.trim() ?? "";
  const guideUrl = guideText.length > 0 ? null : scaledRecipe.guideUrl ?? buildGuideSearchUrl(scaledRecipe.name);
  const videoSearchUrl = scaledRecipe.videoSearchUrl ?? buildVideoSearchUrl(scaledRecipe.name);

  return (
    <article className="recipe-card" aria-label={`Recipe details for ${scaledRecipe.name}`}>
      <header className="recipe-card-header">
        <div>
          <p className="recipe-category">{scaledRecipe.category || "General prep"}</p>
          <h3 className="recipe-title">{scaledRecipe.name}</h3>
        </div>

        <div className="recipe-yield-wrap">
          <span className="recipe-yield-label">Yield</span>
          <strong className="recipe-yield-value">
            {scaledRecipe.yieldAmount} {scaledRecipe.yieldUnit}
          </strong>
        </div>
      </header>

      <label className="recipe-yield-input-field">
        <span>Target yield</span>
        <div className="recipe-yield-input-wrap">
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={targetYieldInput}
            onChange={(event) => setTargetYieldInput(event.target.value)}
            aria-label={`Target yield for ${scaledRecipe.name}`}
          />
          <span>{scaledRecipe.yieldUnit}</span>
        </div>
      </label>

      {ratio === null ? (
        <p className="recipe-scale-warning">Enter a positive yield to calculate scaled quantities.</p>
      ) : (
        <p className="recipe-scale-meta">Scale ratio: {ratio.toFixed(2)}x base batch</p>
      )}

      {guideText.length > 0 ? (
        <section className="recipe-guide-text" aria-label={`${scaledRecipe.name} recipe guide`}>
          <h4 className="recipe-guide-title">Guide</h4>
          <p className="recipe-guide-body" style={{ whiteSpace: "pre-wrap" }}>
            {guideText}
          </p>
        </section>
      ) : null}

      <div className="recipe-resource-actions" aria-label={`${scaledRecipe.name} learning resources`}>
        {guideUrl ? (
          <a
            className="recipe-resource-link"
            href={guideUrl}
            target="_blank"
            rel="noreferrer"
          >
            Open guide
          </a>
        ) : null}

        <a
          className="recipe-resource-link recipe-resource-link-secondary"
          href={videoSearchUrl}
          target="_blank"
          rel="noreferrer"
        >
          Search video
        </a>
      </div>

      <section className="recipe-ingredients" aria-label={`${scaledRecipe.name} scaled ingredients`}>
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

export default RecipeDetailView;
