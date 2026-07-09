import type { Ingredient } from "../models/Ingredient";
import type { PrepItem } from "../models/PrepItem";
import type { Recipe } from "../models/Recipe";

const buildIngredientKey = (ingredient: Ingredient): string =>
  `${ingredient.name.trim().toLowerCase()}|${ingredient.unit}|${ingredient.quantity}`;

export const mergePrepItemIngredientsIntoRecipe = (
  recipe: Recipe,
  prepItems: PrepItem[],
): Recipe => {
  if (prepItems.length === 0) {
    return recipe;
  }

  const seenIngredientKeys = new Set(recipe.ingredients.map(buildIngredientKey));
  const prepIngredients: Ingredient[] = [];

  prepItems.forEach((prepItem) => {
    (prepItem.ingredients ?? []).forEach((ingredient, index) => {
      const ingredientWithId: Ingredient = {
        ...ingredient,
        id: ingredient.id || `${prepItem.id}-ingredient-${index + 1}`,
      };

      const key = buildIngredientKey(ingredientWithId);
      if (seenIngredientKeys.has(key)) {
        return;
      }

      seenIngredientKeys.add(key);
      prepIngredients.push(ingredientWithId);
    });
  });

  if (prepIngredients.length === 0) {
    return recipe;
  }

  return {
    ...recipe,
    ingredients: [...recipe.ingredients.map((ingredient) => ({ ...ingredient })), ...prepIngredients],
  };
};