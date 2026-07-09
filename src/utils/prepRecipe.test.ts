import type { PrepItem } from "../models/PrepItem";
import type { Recipe } from "../models/Recipe";
import { mergePrepItemIngredientsIntoRecipe } from "./prepRecipe";

const buildRecipe = (): Recipe => ({
  id: "recipe-1",
  name: "Ranch Dressing",
  ingredients: [{ id: "ing-1", name: "Buttermilk", quantity: 2, unit: "cup" }],
  steps: ["Mix"],
  yieldAmount: 1.5,
  yieldUnit: "l",
  active: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
});

describe("mergePrepItemIngredientsIntoRecipe", () => {
  test("appends prep item ingredients to the recipe", () => {
    const recipe = buildRecipe();
    const prepItem: PrepItem = {
      id: "prep-1",
      name: "Ranch Dressing",
      parLevel: 4,
      onHand: 4,
      targetQty: 4,
      unit: "l",
      priority: 1,
      status: "todo",
      ingredients: [{ id: "prep-ing-1", name: "Mayonnaise", quantity: 1, unit: "cup" }],
    };

    const merged = mergePrepItemIngredientsIntoRecipe(recipe, prepItem);

    expect(merged.ingredients).toHaveLength(2);
    expect(merged.ingredients[1]).toMatchObject({
      id: "prep-ing-1",
      name: "Mayonnaise",
      quantity: 1,
      unit: "cup",
    });
    expect(recipe.ingredients).toHaveLength(1);
  });

  test("returns the original recipe when no prep ingredients are present", () => {
    const recipe = buildRecipe();

    expect(mergePrepItemIngredientsIntoRecipe(recipe, undefined)).toBe(recipe);
  });
});