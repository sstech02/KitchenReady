import type { PrepItem } from "./PrepItem";
import type { Unit } from "./Unit";

export interface ShiftHandover {
  id: string;
  businessDate: string;    // YYYY-MM-DD
  shiftType: "am" | "pm" | "overnight";
  fromUser: string;
  toUser?: string;
  summary: string;
  prepItems: PrepItem[];
  lowStockItems?: Array<{
    ingredientId?: string;
    name: string;
    onHand: number;
    unit: Unit;
  }>;
  issues?: string[];       // equipment, shortages, incidents
  blockers?: string[];     // tasks next shift cannot start until resolved
  signedOff: boolean;
  createdAt: string;       // ISO date-time
  updatedAt: string;       // ISO date-time
}