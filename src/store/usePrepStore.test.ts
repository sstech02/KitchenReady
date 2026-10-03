import { usePrepStore } from "./usePrepStore";

const mockFetchEventSource = jest.fn();
let mockDashboardId = "dashboard-1";
let mockUserEmail = "owner@example.com";

jest.mock("@microsoft/fetch-event-source", () => ({
  fetchEventSource: (...args: unknown[]) => mockFetchEventSource(...args),
}), { virtual: true });

jest.mock("../services/sessionHeaders", () => ({
  getApiBaseUrl: () => "http://localhost:4000",
  getStoredDashboardId: () => mockDashboardId,
  getStoredUserEmail: () => mockUserEmail,
  getSessionHeaders: () => ({ "x-user-email": mockUserEmail, "x-dashboard-id": mockDashboardId }),
}));

const originalFetch = globalThis.fetch;
const item = { id: "prep-1", name: "Onions", dashboardId: "dashboard-1", onHand: 2, parLevel: 5, targetQty: 3, unit: "cup" as const, status: "todo" as const, priority: 1 as const };
const flushPromises = async () => {
  for (let attempt = 0; attempt < 8; attempt += 1) await Promise.resolve();
};

beforeEach(() => {
  mockFetchEventSource.mockReset();
  mockFetchEventSource.mockResolvedValue(undefined);
  mockDashboardId = "dashboard-1";
  mockUserEmail = "owner@example.com";
  usePrepStore.setState({ items: [] });
  globalThis.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => [item] });
});

afterAll(() => { globalThis.fetch = originalFetch; });

test("live SQL prep events refresh items and unsubscribe aborts the stream", async () => {
  const onInitialSnapshot = jest.fn();
  const onConnectionChange = jest.fn();
  const unsubscribe = usePrepStore.getState().subscribeToItems(mockDashboardId, { onInitialSnapshot, onConnectionChange });
  await flushPromises();
  expect(usePrepStore.getState().items).toEqual([item]);
  expect(onInitialSnapshot).toHaveBeenCalledTimes(1);
  expect(mockFetchEventSource).toHaveBeenCalledTimes(1);
  const [url, options] = mockFetchEventSource.mock.calls[0];
  expect(url).toBe("http://localhost:4000/api/prep-items/events");
  expect(options.headers["x-dashboard-id"]).toBe(mockDashboardId);
  await options.onopen({ ok: true, status: 200, headers: new Headers({ "content-type": "text/event-stream" }) });
  expect(onConnectionChange).toHaveBeenLastCalledWith(true);
  expect(options.onerror(new Error("Connection lost"))).toBe(2000);
  expect(onConnectionChange).toHaveBeenLastCalledWith(false);
  const updated = { ...item, onHand: 4 };
  (globalThis.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => [updated] });
  options.onmessage({ event: "prep-items-changed", data: "" });
  await flushPromises();
  expect(usePrepStore.getState().items).toEqual([updated]);
  unsubscribe();
  expect(options.signal.aborted).toBe(true);
});

test("guest edits remain local and do not open a live subscription", async () => {
  mockUserEmail = "guest@kitchenready.app";
  const unsubscribe = usePrepStore.getState().subscribeToItems(mockDashboardId);
  await flushPromises();
  expect(mockFetchEventSource).not.toHaveBeenCalled();
  (globalThis.fetch as jest.Mock).mockClear();
  await usePrepStore.getState().setStatus(item.id, "done");
  expect(usePrepStore.getState().items[0].status).toBe("done");
  expect(globalThis.fetch).not.toHaveBeenCalled();
  unsubscribe();
});

test("late API responses do not overwrite guest edits", async () => {
  mockUserEmail = "guest@kitchenready.app";
  usePrepStore.setState({ items: [item] });
  let completeResponse!: (value: unknown) => void;
  (globalThis.fetch as jest.Mock).mockReturnValue(new Promise((resolve) => { completeResponse = resolve; }));
  const loading = usePrepStore.getState().fetchItems();
  await usePrepStore.getState().setStatus(item.id, "done");
  completeResponse({ ok: true, json: async () => [item] });
  await loading;
  expect(usePrepStore.getState().items[0].status).toBe("done");
});

test("responses for a previous dashboard cannot replace the current dashboard", async () => {
  let completeResponse!: (value: unknown) => void;
  (globalThis.fetch as jest.Mock).mockReturnValue(new Promise((resolve) => { completeResponse = resolve; }));
  const loading = usePrepStore.getState().fetchItems();
  mockDashboardId = "dashboard-2";
  completeResponse({ ok: true, json: async () => [item] });
  await loading;
  expect(usePrepStore.getState().items).toEqual([]);
});

test("a failed edit rolls back only its item and preserves other local edits", async () => {
  const otherItem = { ...item, id: "prep-2" };
  usePrepStore.setState({ items: [item, otherItem] });
  let rejectResponse!: (error: Error) => void;
  (globalThis.fetch as jest.Mock).mockReturnValue(new Promise((_resolve, reject) => { rejectResponse = reject; }));
  const saving = usePrepStore.getState().setStatus(item.id, "done");
  usePrepStore.getState().assignTo(otherItem.id, "Sam");
  rejectResponse(new Error("Network unavailable"));
  await expect(saving).rejects.toThrow("Network unavailable");
  expect(usePrepStore.getState().items[0].status).toBe("todo");
  expect(usePrepStore.getState().items[1].assignedTo).toBe("Sam");
});