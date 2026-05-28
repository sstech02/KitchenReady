export const PREP_STATUSES = [
  "todo",
  "in_progress",
  "done",
  "discarded",
] as const;

export type PrepStatus = (typeof PREP_STATUSES)[number];
