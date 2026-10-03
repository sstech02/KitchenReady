import { create } from "zustand";
import { fetchEventSource } from "@microsoft/fetch-event-source";
import type { PrepItem } from "../models/PrepItem";
import { getApiBaseUrl, getSessionHeaders, getStoredDashboardId, getStoredUserEmail } from "../services/sessionHeaders";

const guestEmail = "guest@kitchenready.app";
const isGuestMode = () => getStoredUserEmail() === guestEmail;
let itemsRevision = 0;
let pendingWrites = 0;
const refreshSubscribers = new Set<() => void>();

type PrepItemSyncCallbacks = {
  onInitialSnapshot?: () => void;
  onConnectionChange?: (connected: boolean) => void;
  onError?: (error: unknown) => void;
};

type PrepStore = {
  items: PrepItem[];
  fetchItems: () => Promise<void>;
  subscribeToItems: (dashboardId: string | null, callbacks?: PrepItemSyncCallbacks) => () => void;
  setStatus: (id: string, status: PrepItem["status"]) => Promise<void>;
  assignTo: (id: string, assignee: string) => void;
  setOnHand: (id: string, onHand: number) => Promise<void>;
  setParLevel: (id: string, parLevel: number) => Promise<void>;
  setTargetQty: (id: string, targetQty: number) => Promise<void>;
  setPriority: (id: string, priority: PrepItem["priority"]) => Promise<void>;
  addItem: (item: PrepItem) => void;
  updateItemLocal: (id: string, item: PrepItem) => void;
  removeItemLocal: (id: string) => void;
};

const persistUpdatedItem = async (
  id: string,
  updatedItem: PrepItem,
  previousItems: PrepItem[],
  set: (partial: Partial<PrepStore> | ((state: PrepStore) => Partial<PrepStore>)) => void,
  errorMessage: string,
) => {
  const dashboardId = getStoredDashboardId();
  itemsRevision += 1;
  set((state) => ({
    items: state.items.map((item) => (item.id === id ? updatedItem : item)),
  }));

  if (isGuestMode()) {
    return;
  }

  pendingWrites += 1;
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
    if (getStoredDashboardId() !== dashboardId) return;
    set((state) => ({
      items: state.items.map((item) => (item.id === id ? savedItem : item)),
    }));
  } catch (error) {
    if (getStoredDashboardId() === dashboardId) {
      set((state) => ({
        items: state.items.map((item) => item.id === id ? previousItems.find((previous) => previous.id === id) ?? item : item),
      }));
    }
    throw error;
  } finally {
    itemsRevision += 1;
    pendingWrites -= 1;
    refreshSubscribers.forEach((refresh) => refresh());
  }
};

export const usePrepStore = create<PrepStore>((set, get) => ({
  items: [],

  fetchItems: async () => {
    const dashboardId = getStoredDashboardId();
    const userEmail = getStoredUserEmail();
    const revision = itemsRevision;
    if (!dashboardId) {
      set({ items: [] });
      return;
    }

    const res = await fetch(`${getApiBaseUrl()}/api/prep-items`, {
      headers: { ...getSessionHeaders() },
    });
    if (!res.ok) throw new Error("Failed to fetch prep items");
    const items = (await res.json()) as PrepItem[];
    if (getStoredDashboardId() !== dashboardId || getStoredUserEmail() !== userEmail) return;
    if (itemsRevision !== revision || pendingWrites > 0) return;
    set({ items });
  },

  subscribeToItems: (dashboardId, callbacks) => {
    if (!dashboardId) {
      set({ items: [] });
      callbacks?.onInitialSnapshot?.();
      return () => undefined;
    }

    let active = true;
    const controller = new AbortController();
    let refreshing = false;
    let refreshRequested = false;
    const refresh = async () => {
      if (!active || getStoredDashboardId() !== dashboardId) return;
      refreshRequested = true;
      if (refreshing || pendingWrites > 0) return;
      refreshing = true;
      try {
        while (active && refreshRequested) {
          refreshRequested = false;
          await get().fetchItems();
        }
      } catch (error) {
        if (active) callbacks?.onError?.(error);
      } finally {
        refreshing = false;
      }
    };
    void get()
      .fetchItems()
      .then(() => {
        if (active) callbacks?.onInitialSnapshot?.();
      })
      .catch((error) => {
        if (active) {
          callbacks?.onError?.(error);
          callbacks?.onInitialSnapshot?.();
        }
      });
    if (!isGuestMode()) {
      refreshSubscribers.add(refresh);
      let rejected = false;
      void fetchEventSource(`${getApiBaseUrl()}/api/prep-items/events`, {
        headers: getSessionHeaders(),
        signal: controller.signal,
        async onopen(response) {
          rejected = response.status >= 400 && response.status < 500;
          if (!response.ok || !response.headers.get("content-type")?.includes("text/event-stream")) {
            throw new Error("Failed to connect to live prep updates");
          }
          if (active) callbacks?.onConnectionChange?.(true);
          await refresh();
        },
        onmessage(message) {
          if (message.event === "prep-items-changed") void refresh();
        },
        onclose() {
          if (active) callbacks?.onConnectionChange?.(false);
          throw new Error("Live prep connection closed");
        },
        onerror(error) {
          if (active) callbacks?.onConnectionChange?.(false);
          if (active) callbacks?.onError?.(error);
          if (rejected) throw error;
          return 2000;
        },
      }).catch(() => undefined);
    }
    return () => {
      active = false;
      controller.abort();
      refreshSubscribers.delete(refresh);
    };
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

  assignTo: (id, assignee) => {
    itemsRevision += 1;
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id ? { ...item, assignedTo: assignee } : item,
      ),
    }));
  },

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

  addItem: (item) => {
    itemsRevision += 1;
    set((state) => ({
      items: [...state.items, item],
    }));
  },

  updateItemLocal: (id, item) => {
    itemsRevision += 1;
    set((state) => ({
      items: state.items.map((existing) => (existing.id === id ? item : existing)),
    }));
  },

  removeItemLocal: (id) => {
    itemsRevision += 1;
    set((state) => ({
      items: state.items.filter((item) => item.id !== id),
    }));
  },
}));
