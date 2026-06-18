export const UNITS = [
  "each", "bag", "oz", "lb", "g", "kg", "ml", "l", "tsp", "tbsp", "cup", "pan", "tray",
] as const;

export type Unit = (typeof UNITS)[number];
