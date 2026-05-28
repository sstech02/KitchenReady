export const UNITS = [
  "each", "oz", "lb", "g", "kg", "ml", "l", "tsp", "tbsp", "cup", "pan", "tray",
] as const;

export type Unit = (typeof UNITS)[number];
