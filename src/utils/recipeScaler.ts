import type { Recipe } from "../models/Recipe";

export type ScaleRecipeOptions = {
  roundTo?: number;
  minQuantity?: number;
};

const roundValue = (value: number, places: number) => {
  const factor = Math.pow(10, places);
  return Math.round(value * factor) / factor;
};

export function scaleRecipeForYield(
  recipe: Recipe,
  targetYieldAmount: number,
  options: ScaleRecipeOptions = {},
): Recipe {
  const { roundTo = 2, minQuantity } = options;

  if (!Number.isFinite(targetYieldAmount) || targetYieldAmount <= 0) {
    throw new Error("targetYieldAmount must be a positive number.");
  }

  if (!Number.isFinite(recipe.yieldAmount) || recipe.yieldAmount <= 0) {
    throw new Error("recipe.yieldAmount must be a positive number.");
  }

  const ratio = targetYieldAmount / recipe.yieldAmount;

  const scaledIngredients = recipe.ingredients.map((ingredient) => {
    let scaledQuantity = roundValue(ingredient.quantity * ratio, roundTo);

    if (
      typeof minQuantity === "number" &&
      minQuantity > 0 &&
      scaledQuantity > 0 &&
      scaledQuantity < minQuantity
    ) {
      scaledQuantity = minQuantity;
    }

    return {
      ...ingredient,
      quantity: scaledQuantity,
    };
  });

  return {
    ...recipe,
    ingredients: scaledIngredients,
    yieldAmount: roundValue(targetYieldAmount, roundTo),
  };
}
