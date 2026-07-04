import { scaleRecipeForYield } from "./recipeScaler";
import type { Recipe } from "../models/Recipe";

const buildRecipe = (): Recipe => ({
  id: "recipe-1",
  name: "Biscuits",
  category: "Bakery",
  ingredients: [
    { id: "i-1", name: "Flour", quantity: 2, unit: "cup" },
    { id: "i-2", name: "Butter", quantity: 0.5, unit: "cup" },
    { id: "i-3", name: "Salt", quantity: 0.25, unit: "tsp" },
  ],
  steps: ["Mix", "Bake"],
  yieldAmount: 4,
  yieldUnit: "each",
  active: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
});

describe("scaleRecipeForYield", () => {
  test("scales ingredient quantities for larger target yield", () => {
    const recipe = buildRecipe();

    const scaled = scaleRecipeForYield(recipe, 8);

    expect(scaled.yieldAmount).toBe(8);
    expect(scaled.ingredients[0].quantity).toBe(4);
    expect(scaled.ingredients[1].quantity).toBe(1);
  });

  test("rounds half-up at boundary values", () => {
    const recipe = buildRecipe();

    const customRecipe: Recipe = {
      ...recipe,
      ingredients: [{ id: "i-x", name: "Yeast", quantity: 0.125, unit: "tsp" }],
      yieldAmount: 1,
    };

    const scaled = scaleRecipeForYield(customRecipe, 1, { roundTo: 2 });

    expect(scaled.ingredients[0].quantity).toBe(0.13);
  });

  test("keeps zero ingredient quantity at zero after scaling", () => {
    const recipe = buildRecipe();

    const customRecipe: Recipe = {
      ...recipe,
      ingredients: [{ id: "i-z", name: "Optional garnish", quantity: 0, unit: "tsp" }],
    };

    const scaled = scaleRecipeForYield(customRecipe, 8, { minQuantity: 0.1 });

    expect(scaled.ingredients[0].quantity).toBe(0);
  });

  test("scales ingredient quantities for smaller target yield", () => {
    const recipe = buildRecipe();

    const scaled = scaleRecipeForYield(recipe, 2);

    expect(scaled.yieldAmount).toBe(2);
    expect(scaled.ingredients[0].quantity).toBe(1);
    expect(scaled.ingredients[1].quantity).toBe(0.25);
  });

  test("rounds to configured precision", () => {
    const recipe = buildRecipe();

    const scaled = scaleRecipeForYield(recipe, 5, { roundTo: 1 });

    expect(scaled.ingredients[2].quantity).toBe(0.3);
  });

  test("applies minQuantity for very small values", () => {
    const recipe = buildRecipe();

    const scaled = scaleRecipeForYield(recipe, 1, { minQuantity: 0.1 });

    expect(scaled.ingredients[2].quantity).toBe(0.1);
  });

  test("does not mutate original recipe", () => {
    const recipe = buildRecipe();
    const originalFirstQty = recipe.ingredients[0].quantity;

    const scaled = scaleRecipeForYield(recipe, 8);

    expect(scaled).not.toBe(recipe);
    expect(scaled.ingredients[0]).not.toBe(recipe.ingredients[0]);
    expect(recipe.ingredients[0].quantity).toBe(originalFirstQty);
  });

  test("throws for invalid target yield", () => {
    const recipe = buildRecipe();

    expect(() => scaleRecipeForYield(recipe, 0)).toThrow(
      "targetYieldAmount must be a positive number.",
    );
  });

  test("throws for invalid recipe base yield", () => {
    const recipe = { ...buildRecipe(), yieldAmount: 0 };

    expect(() => scaleRecipeForYield(recipe, 2)).toThrow(
      "recipe.yieldAmount must be a positive number.",
    );
  });
});
