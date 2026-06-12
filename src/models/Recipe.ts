import type { Ingredient } from "./Ingredient";
import type { Unit } from "./Unit";

export interface Recipe {
  id: string;
  name: string;
  category?: string;
  ingredients: Ingredient[];
  steps: string[];
  yieldAmount: number;
  yieldUnit: Unit;
  prepTimeMin?: number;
  cookTimeMin?: number;
  tags?: string[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ScaleRecipeOptions = {
  roundTo?: number; // decimal places, default 2
  minQuantity?: number; // clamp tiny positives up if needed
};

const round = (value: number, places: number): number => {
  const factor = Math.pow(10, places);
  return Math.round(value * factor) / factor;
};

export function scaleRecipe(
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
    let scaledQty = round(ingredient.quantity * ratio, roundTo);

    if (
      typeof minQuantity === "number" &&
      minQuantity > 0 &&
      scaledQty > 0 &&
      scaledQty < minQuantity
    ) {
      scaledQty = minQuantity;
    }

    return {
      ...ingredient,
      quantity: scaledQty,
    };
  });

  return {
    ...recipe,
    ingredients: scaledIngredients,
    yieldAmount: round(targetYieldAmount, roundTo),
    updatedAt: new Date().toISOString(),
  };
}

export function scaleRecipeByFactor(
  recipe: Recipe,
  factor: number,
  options: ScaleRecipeOptions = {},
): Recipe {
  if (!Number.isFinite(factor) || factor <= 0) {
    throw new Error("factor must be a positive number.");
  }

  return scaleRecipe(recipe, recipe.yieldAmount * factor, options);
}