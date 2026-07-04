import { create } from "zustand";
import { collection, deleteDoc, doc, onSnapshot, query, setDoc, where } from "firebase/firestore";
import type { PrepItem } from "../models/PrepItem";
import { db } from "../services/firebase";
import { getApiBaseUrl, getSessionHeaders, getStoredDashboardId, getStoredUserEmail } from "../services/sessionHeaders";

const guestEmail = "guest@kitchenready.app";
const isGuestMode = () => getStoredUserEmail() === guestEmail;

type PrepItemSyncCallbacks = {
  onInitialSnapshot?: () => void;
  onError?: (error: unknown) => void;
};

const prepItemsCollectionName = "prep-items";

export const syncPrepItemToFirestore = async (item: PrepItem): Promise<void> => {
  if (!db) {
    return;
  }

  const dashboardId = getStoredDashboardId();
  if (!dashboardId) {
    return;
  }

  await setDoc(doc(db, prepItemsCollectionName, item.id), {
    ...item,
    dashboardId,
  });
};

export const deletePrepItemFromFirestore = async (id: string): Promise<void> => {
  if (!db) {
    return;
  }

  await deleteDoc(doc(db, prepItemsCollectionName, id));
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

    void syncPrepItemToFirestore(savedItem).catch((syncError) => {
      console.error("Failed to mirror prep item update to Firestore:", syncError);
    });
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

  subscribeToItems: (dashboardId, callbacks) => {
    if (!db || !dashboardId) {
      set({ items: [] });
      callbacks?.onInitialSnapshot?.();
      return () => undefined;
    }

    const prepItemsQuery = query(
      collection(db, prepItemsCollectionName),
      where("dashboardId", "==", dashboardId),
    );
    let initialSnapshotHandled = false;

    return onSnapshot(
      prepItemsQuery,
      (snapshot) => {
        const nextItems = snapshot.docs.map((snapshotDoc) => snapshotDoc.data() as PrepItem);

        set((state) => {
          if (nextItems.length === 0 && state.items.length > 0) {
            return {};
          }

          const currentItemsById = new Map(state.items.map((item) => [item.id, item]));
          const nextItemsById = new Map(nextItems.map((item) => [item.id, item]));
          const mergedItems = [
            ...state.items.filter((item) => !nextItemsById.has(item.id)),
            ...nextItems.map((item) => ({ ...currentItemsById.get(item.id), ...item }) as PrepItem),
          ];

          return { items: mergedItems };
        });

        if (!initialSnapshotHandled) {
          initialSnapshotHandled = true;
          callbacks?.onInitialSnapshot?.();
        }
      },
      (error) => {
        console.error("Failed to subscribe to prep items:", error);
        if (!initialSnapshotHandled) {
          initialSnapshotHandled = true;
          callbacks?.onInitialSnapshot?.();
        }
        callbacks?.onError?.(error);
      },
    );
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

  updateItemLocal: (id, item) =>
    set((state) => ({
      items: state.items.map((existing) => (existing.id === id ? item : existing)),
    })),

  removeItemLocal: (id) =>
    set((state) => ({
      items: state.items.filter((item) => item.id !== id),
    })),
}));
