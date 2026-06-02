import { create } from "zustand";
import type { PrepItem } from "../models/PrepItem";

type PrepStore = {
items: PrepItem[];
fetchItems: () => Promise<void>;
setStatus: (id: string, status: PrepItem["status"]) => void;
assignTo: (id: string, assignee: string) => void;
setOnHand: (id: string, onHand: number) => void;
addItem: (item: PrepItem) => void;
};

export const usePrepStore = create<PrepStore>((set) => ({
items: [],

fetchItems: async () => {
const res = await fetch("http://localhost:4000/api/prep-items");
if (!res.ok) throw new Error("Failed to fetch prep items");
const items = (await res.json()) as PrepItem[];
set({ items });
},

setStatus: (id, status) =>
set((state) => ({
items: state.items.map((item) =>
item.id === id ? { ...item, status } : item,
),
})),
assignTo: (id, assignee) =>
set((state) => ({
items: state.items.map((item) =>
item.id === id ? { ...item, assignedTo: assignee } : item,
),
})),
setOnHand: (id, onHand) =>
set((state) => ({
items: state.items.map((item) =>
item.id === id
? { ...item, onHand, targetQty: Math.max(item.parLevel - onHand, 0) }
: item,
),
})),
addItem: (item) =>
set((state) => ({
items: [...state.items, item],
})),
}));