import type { Ingredient } from "../models/Ingredient";
import type { PrepItem } from "../models/PrepItem";
import type { Recipe } from "../models/Recipe";

export const mergePrepItemIngredientsIntoRecipe = (
  recipe: Recipe,
  prepItem: PrepItem | null | undefined,
): Recipe => {
  if (!prepItem?.ingredients || prepItem.ingredients.length === 0) {
    return recipe;
  }

  const prepIngredients: Ingredient[] = prepItem.ingredients.map((ingredient, index) => ({
    ...ingredient,
    id: ingredient.id || `${prepItem.id}-ingredient-${index + 1}`,
  }));

  return {
    ...recipe,
    ingredients: [...recipe.ingredients.map((ingredient) => ({ ...ingredient })), ...prepIngredients],
  };
};