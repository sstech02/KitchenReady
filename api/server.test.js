import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createServer } from "node:net";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pg from "pg";
import { createPrepRepository } from "./prepRepository.js";

dotenv.config({
  path: ["../.env.local", "../.env"].map((name) => fileURLToPath(new URL(name, import.meta.url))),
  quiet: true,
});

const startApi = async () => {
  const probe = createServer();
  await new Promise((resolve, reject) => {
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", resolve);
  });
  const port = probe.address().port;
  await new Promise((resolve, reject) => probe.close((error) => error ? reject(error) : resolve()));
  const child = spawn(process.execPath, [fileURLToPath(new URL("./server.js", import.meta.url))], {
    env: { ...process.env, PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const stop = async () => {
    if (child.exitCode !== null) return;
    await new Promise((resolve) => {
      child.once("exit", resolve);
      child.kill();
    });
  };
  try {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("API startup timed out")), 15000);
      child.once("error", () => { clearTimeout(timeout); reject(new Error("API could not start")); });
      child.once("exit", () => { clearTimeout(timeout); reject(new Error("API exited before startup")); });
      child.stdout.on("data", (data) => {
        if (data.toString().includes("API running")) {
          clearTimeout(timeout);
          resolve();
        }
      });
    });
    return { base: `http://127.0.0.1:${port}`, stop };
  } catch (error) {
    await stop();
    throw error;
  }
};

test("SQL API preserves live prep CRUD, ordering, recipe links, isolation and restart persistence", {
  skip: !process.env.DATABASE_URL?.trim(),
  timeout: 45000,
}, async () => {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10000 });
  const repository = createPrepRepository(pool);
  const memberships = JSON.parse(await readFile(new URL("./dashboard-memberships.json", import.meta.url), "utf-8"));
  const member = memberships.find((membership) => membership.role === "admin");
  assert.ok(member, "An existing admin membership is required");
  const fixtureId = `000-${randomUUID()}`;
  const otherDashboardId = randomUUID();
  const controller = new AbortController();
  let api;
  let reader;
  try {
    api = await startApi();
    const headers = { "x-user-email": member.userEmail, "x-dashboard-id": member.dashboardId, "Content-Type": "application/json" };
    const request = async (path, options = {}) => fetch(`${api.base}${path}`, { ...options, headers: { ...headers, ...options.headers } });
    const before = await (await request("/api/prep-items")).json();
    assert.equal((await fetch(`${api.base}/api/prep-items/events`)).status, 401);
    assert.equal((await request("/api/prep-items/events", { headers: { "x-user-email": `${randomUUID()}@example.com` } })).status, 403);
    const stream = await request("/api/prep-items/events", { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30000)]) });
    assert.equal(stream.status, 200);
    assert.match(stream.headers.get("content-type"), /text\/event-stream/);
    reader = stream.body.getReader();
    let buffer = "";
    const decoder = new TextDecoder();
    const nextEvent = async () => {
      for (;;) {
        const delimiter = buffer.indexOf("\n\n");
        if (delimiter !== -1) {
          const frame = buffer.slice(0, delimiter);
          buffer = buffer.slice(delimiter + 2);
          if (frame.startsWith("event: prep-items-changed")) return;
          continue;
        }
        const { value, done } = await reader.read();
        assert.equal(done, false, "Live prep stream unexpectedly closed");
        buffer += decoder.decode(value, { stream: true });
      }
    };
    await nextEvent();
    const payload = {
      id: fixtureId, name: `SQL parity fixture ${fixtureId}`, parLevel: 5, onHand: 1,
      targetQty: 4, unit: "cup", status: "todo", priority: 1, assignedTo: "Sam",
      ingredients: [{ id: "fixture-ingredient", name: "Onions", quantity: 2, unit: "cup" }],
    };
    const missingId = randomUUID();
    const recipesBeforeMissingUpdate = await (await request("/api/recipes")).json();
    assert.equal((await request(`/api/prep-items/${missingId}`, { method: "PUT", body: JSON.stringify(payload) })).status, 404);
    assert.deepEqual(await (await request("/api/recipes")).json(), recipesBeforeMissingUpdate);
    const createdResponse = await request("/api/prep-items", { method: "POST", body: JSON.stringify(payload) });
    assert.equal(createdResponse.status, 201);
    const created = await createdResponse.json();
    await nextEvent();
    const listed = await (await request("/api/prep-items")).json();
    assert.deepEqual(listed.map((item) => item.id), [...before.map((item) => item.id), fixtureId]);
    const recipes = await (await request("/api/recipes")).json();
    assert.ok(recipes.some((recipe) => recipe.id === created.recipeId));
    assert.equal((await request("/api/prep-items", { method: "POST", body: JSON.stringify(payload) })).status, 409);
    const updatedPayload = { ...created, status: "done", onHand: 4, priority: 2, assignedTo: "Ari" };
    const updatedResponse = await request(`/api/prep-items/${fixtureId}`, { method: "PUT", body: JSON.stringify(updatedPayload) });
    assert.equal(updatedResponse.status, 200);
    const updated = await updatedResponse.json();
    await nextEvent();
    assert.deepEqual(await repository.find(member.dashboardId, fixtureId), updated);
    await repository.create({ ...payload, id: missingId, dashboardId: otherDashboardId });
    assert.equal((await request(`/api/prep-items/${missingId}`, { method: "PUT", body: JSON.stringify(payload) })).status, 404);
    assert.equal((await request(`/api/prep-items/${missingId}`, { method: "DELETE" })).status, 404);
    assert.equal((await request(`/api/prep-items/${fixtureId}`, { method: "DELETE" })).status, 204);
    await nextEvent();
    assert.equal(await repository.find(member.dashboardId, fixtureId), null);
    assert.deepEqual((await (await request("/api/prep-items")).json()).map((item) => item.id), before.map((item) => item.id));
    const persistedResponse = await request("/api/prep-items", { method: "POST", body: JSON.stringify(updatedPayload) });
    assert.equal(persistedResponse.status, 201);
    const persisted = await persistedResponse.json();
    controller.abort();
    await reader.cancel().catch(() => undefined);
    await api.stop();
    api = await startApi();
    assert.deepEqual((await (await request("/api/prep-items")).json()).find((item) => item.id === fixtureId), persisted);
  } finally {
    controller.abort();
    await reader?.cancel().catch(() => undefined);
    await api?.stop();
    await repository.remove(member.dashboardId, fixtureId);
    await repository.remove(otherDashboardId, fixtureId);
    const stored = await repository.list(otherDashboardId);
    for (const item of stored) await repository.remove(otherDashboardId, item.id);
    await pool.end();
  }
});