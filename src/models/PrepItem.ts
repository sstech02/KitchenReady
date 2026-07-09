import type { Ingredient } from "./Ingredient";
import type { Unit } from "./Unit";
import type { PrepStatus } from "./PrepStatus";

export interface PrepItem {
  id: string;
  recipeId?: string;       // linked recipe if this prep item comes from one
  name: string;            // fallback/custom prep item name
  station?: string;        // e.g. "line", "bakery", "cold prep"
  parLevel: number;
  onHand: number;
  targetQty: number;       // desired prep amount, stored independently
  unit: Unit;
  dueBy?: string;          // ISO date-time
  priority: 1 | 2 | 3;     // 1 = high, 3 = low
  status: PrepStatus;
  assignedTo?: string;     // user id or name
  notes?: string;
  completedAt?: string;    // ISO date-time
  ingredients?: Ingredient[];
}
