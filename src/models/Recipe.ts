import type { Ingredient } from "./Ingredient";
import type { Unit } from "./Unit";

export interface Recipe {
  id: string;
  name: string;
  category?: string;       // e.g. "sauce", "protein", "bakery"
  ingredients: Ingredient[];
  steps: string[];
  yieldAmount: number;     // numeric amount produced
  yieldUnit: Unit;         // unit of final yield
  prepTimeMin?: number;
  cookTimeMin?: number;
  tags?: string[];
  active: boolean;
  createdAt: string;       // ISO date string
  updatedAt: string;       // ISO date string
}