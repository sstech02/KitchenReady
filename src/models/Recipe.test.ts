import { scaleRecipe, scaleRecipeByFactor } from './Recipe';
import type { Recipe } from './Recipe';

// Mock recipe for testing
const mockRecipe: Recipe = {
  id: '1',
  name: 'Test Recipe',
  ingredients: [
    { id: '1', name: 'Flour', quantity: 2, unit: 'cup' },
    { id: '2', name: 'Sugar', quantity: 1, unit: 'cup' },
    { id: '3', name: 'Butter', quantity: 0.5, unit: 'cup' },
  ],
  steps: ['Mix', 'Bake'],
  yieldAmount: 4,
  yieldUnit: 'each',
  active: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe('scaleRecipe', () => {
  // Basic scaling
  test('scales ingredients by correct ratio when doubling yield', () => {
    const scaled = scaleRecipe(mockRecipe, 8); // double from 4 to 8
    expect(scaled.ingredients[0].quantity).toBe(4); // 2 * 2
    expect(scaled.ingredients[1].quantity).toBe(2); // 1 * 2
    expect(scaled.yieldAmount).toBe(8);
  });

  test('scales ingredients when halving yield', () => {
    const scaled = scaleRecipe(mockRecipe, 2); // half from 4 to 2
    expect(scaled.ingredients[0].quantity).toBe(1); // 2 / 2
    expect(scaled.ingredients[1].quantity).toBe(0.5); // 1 / 2
    expect(scaled.yieldAmount).toBe(2);
  });

  // Rounding
  test('respects roundTo option for decimal places', () => {
    const scaled = scaleRecipe(mockRecipe, 5, { roundTo: 1 });
    expect(scaled.ingredients[0].quantity).toBe(2.5); // rounds to 1 decimal
  });

  test('defaults to 2 decimal places', () => {
    const scaled = scaleRecipe(mockRecipe, 6);
    // 2 * (6/4) = 3, 1 * (6/4) = 1.5, etc.
    expect(scaled.ingredients[1].quantity).toBe(1.5);
  });

  // minQuantity clamping
  test('clamps small quantities to minQuantity when specified', () => {
    const scaled = scaleRecipe(mockRecipe, 1, { minQuantity: 0.25 });
    // 0.5 * (1/4) = 0.125, should clamp to 0.25
    expect(scaled.ingredients[2].quantity).toBe(0.25);
  });

  test('does not clamp zero quantities', () => {
    const recipe = { ...mockRecipe, ingredients: [
      { ...mockRecipe.ingredients[0], quantity: 0 }
    ] };
    const scaled = scaleRecipe(recipe, 2, { minQuantity: 0.25 });
    expect(scaled.ingredients[0].quantity).toBe(0);
  });

  // Error handling
  test('throws error for invalid targetYieldAmount (zero)', () => {
    expect(() => scaleRecipe(mockRecipe, 0)).toThrow(
      'targetYieldAmount must be a positive number.'
    );
  });

  test('throws error for invalid targetYieldAmount (negative)', () => {
    expect(() => scaleRecipe(mockRecipe, -5)).toThrow(
      'targetYieldAmount must be a positive number.'
    );
  });

  test('throws error for invalid targetYieldAmount (NaN)', () => {
    expect(() => scaleRecipe(mockRecipe, NaN)).toThrow(
      'targetYieldAmount must be a positive number.'
    );
  });

  test('throws error for invalid recipe.yieldAmount', () => {
    const badRecipe = { ...mockRecipe, yieldAmount: 0 };
    expect(() => scaleRecipe(badRecipe, 8)).toThrow(
      'recipe.yieldAmount must be a positive number.'
    );
  });

  // Immutability
  test('returns new object without mutating original recipe', () => {
    const scaled = scaleRecipe(mockRecipe, 8);
    expect(scaled).not.toBe(mockRecipe);
    expect(mockRecipe.yieldAmount).toBe(4); // unchanged
    expect(scaled.yieldAmount).toBe(8);
  });

  test('updates the updatedAt timestamp', () => {
    const before = new Date();
    const scaled = scaleRecipe(mockRecipe, 8);
    const after = new Date();
    const scaledDate = new Date(scaled.updatedAt);
    expect(scaledDate.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(scaledDate.getTime()).toBeLessThanOrEqual(after.getTime());
  });
});

describe('scaleRecipeByFactor', () => {
  test('scales recipe by multiplication factor', () => {
    const scaled = scaleRecipeByFactor(mockRecipe, 2);
    expect(scaled.ingredients[0].quantity).toBe(4); // 2 * 2
    expect(scaled.yieldAmount).toBe(8); // 4 * 2
  });

  test('scales recipe by fractional factor', () => {
    const scaled = scaleRecipeByFactor(mockRecipe, 0.5);
    expect(scaled.ingredients[0].quantity).toBe(1); // 2 * 0.5
    expect(scaled.yieldAmount).toBe(2); // 4 * 0.5
  });

  test('throws error for invalid factor (zero)', () => {
    expect(() => scaleRecipeByFactor(mockRecipe, 0)).toThrow(
      'factor must be a positive number.'
    );
  });

  test('throws error for invalid factor (negative)', () => {
    expect(() => scaleRecipeByFactor(mockRecipe, -1)).toThrow(
      'factor must be a positive number.'
    );
  });

  test('passes options through to scaleRecipe', () => {
    const scaled = scaleRecipeByFactor(mockRecipe, 1.5, { roundTo: 0 });
    // Verify rounding works (1 * 1.5 = 1.5 rounds to 2 with roundTo: 0)
    expect(scaled.ingredients[1].quantity).toBe(2);
  });
});