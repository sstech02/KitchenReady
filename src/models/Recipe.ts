import type { Ingredient } from "./Ingredient";
import type { Unit } from "./Unit";

export interface Recipe {
  id: string;
  name: string;
  category?: string;
  guideText?: string;
  guideUrl?: string;
  videoSearchUrl?: string;
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