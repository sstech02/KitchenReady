import { create } from "zustand";
import type { PrepItem } from "../models/PrepItem";
import { getApiBaseUrl, getSessionHeaders, getStoredDashboardId, getStoredUserEmail } from "../services/sessionHeaders";

const guestEmail = "guest@kitchenready.app";
const isGuestMode = () => getStoredUserEmail() === guestEmail;

type PrepStore = {
  items: PrepItem[];
  fetchItems: () => Promise<void>;
  setStatus: (id: string, status: PrepItem["status"]) => Promise<void>;
  assignTo: (id: string, assignee: string) => void;
  setOnHand: (id: string, onHand: number) => Promise<void>;
  setParLevel: (id: string, parLevel: number) => Promise<void>;
  setTargetQty: (id: string, targetQty: number) => Promise<void>;
  setPriority: (id: string, priority: PrepItem["priority"]) => Promise<void>;
  addItem: (item: PrepItem) => void;
};

const persistUpdatedItem = async (
  id: string,
  updatedItem: PrepItem,
  previousItems: PrepItem[],
  set: (partial: Partial<PrepStore> | ((state: PrepStore) => Partial<PrepStore>)) => void,
  errorMessage: string,
) => {
  set((state) => ({
    items: state.items.map((item) => (item.id === id ? updatedItem : item)),
  }));

  if (isGuestMode()) {
    return;
  }

  try {
    const res = await fetch(`${getApiBaseUrl()}/api/prep-items/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...getSessionHeaders() },
      body: JSON.stringify(updatedItem),
    });

    if (!res.ok) {
      throw new Error(errorMessage);
    }

    const savedItem = (await res.json()) as PrepItem;
    set((state) => ({
      items: state.items.map((item) => (item.id === id ? savedItem : item)),
    }));
  } catch (error) {
    set({ items: previousItems });
    throw error;
  }
};

export const usePrepStore = create<PrepStore>((set, get) => ({
  items: [],

  fetchItems: async () => {
    const dashboardId = getStoredDashboardId();
    if (!dashboardId) {
      set({ items: [] });
      return;
    }

    const res = await fetch(`${getApiBaseUrl()}/api/prep-items`, {
      headers: { ...getSessionHeaders() },
    });
    if (!res.ok) throw new Error("Failed to fetch prep items");
    const items = (await res.json()) as PrepItem[];
    set({ items });
  },

  setStatus: async (id, status) => {
    const previousItems = get().items;
    const currentItem = previousItems.find((item) => item.id === id);

    if (!currentItem) {
      return;
    }

    const updatedItem = { ...currentItem, status };
    await persistUpdatedItem(id, updatedItem, previousItems, set, "Failed to persist prep item status");
  },

  assignTo: (id, assignee) =>
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id ? { ...item, assignedTo: assignee } : item,
      ),
    })),

  setOnHand: async (id, onHand) => {
    const previousItems = get().items;
    const currentItem = previousItems.find((item) => item.id === id);

    if (!currentItem) {
      return;
    }

    const nextOnHand = Math.max(onHand, 0);
    const updatedItem = {
      ...currentItem,
      onHand: nextOnHand,
    };

    await persistUpdatedItem(id, updatedItem, previousItems, set, "Failed to persist prep item quantity");
  },

  setParLevel: async (id, parLevel) => {
    const previousItems = get().items;
    const currentItem = previousItems.find((item) => item.id === id);

    if (!currentItem) {
      return;
    }

    const nextParLevel = Math.max(parLevel, 0);
    const updatedItem = {
      ...currentItem,
      parLevel: nextParLevel,
    };

    await persistUpdatedItem(id, updatedItem, previousItems, set, "Failed to persist prep item par level");
  },

  setTargetQty: async (id, targetQty) => {
    const previousItems = get().items;
    const currentItem = previousItems.find((item) => item.id === id);

    if (!currentItem) {
      return;
    }

    const nextTargetQty = Math.max(targetQty, 0);
    const updatedItem = {
      ...currentItem,
      targetQty: nextTargetQty,
    };

    await persistUpdatedItem(id, updatedItem, previousItems, set, "Failed to persist prep item target quantity");
  },

  setPriority: async (id, priority) => {
    const previousItems = get().items;
    const currentItem = previousItems.find((item) => item.id === id);

    if (!currentItem) {
      return;
    }

    const nextPriority = Math.min(3, Math.max(1, priority)) as PrepItem["priority"];
    const updatedItem = {
      ...currentItem,
      priority: nextPriority,
    };

    await persistUpdatedItem(id, updatedItem, previousItems, set, "Failed to persist prep item priority");
  },

  addItem: (item) =>
    set((state) => ({
      items: [...state.items, item],
    })),
}));
