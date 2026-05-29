import type { Unit } from "./Unit";

export interface Ingredient {
  id: string;
  name: string;
  quantity: number;
  unit: Unit;
  notes?: string;
  allergens?: string[];
  optional?: boolean;
}