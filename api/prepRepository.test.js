import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { createPrepRepository } from "./prepRepository.js";

dotenv.config({
  path: ["../.env.local", "../.env"].map((name) => fileURLToPath(new URL(name, import.meta.url))),
  quiet: true,
});

test("list scopes reads to a dashboard and preserves the API item shape", async () => {
  const item = { id: "prep-1", dashboardId: "dashboard-1", name: "Onions" };
  const repository = createPrepRepository({
    query: async (sql, values) => {
      assert.match(sql, /WHERE dashboard_id = \$1/);
      assert.deepEqual(values, [item.dashboardId]);
      return { rows: [{ data: item }] };
    },
  });
  assert.deepEqual(await repository.list(item.dashboardId), [item]);
});

test("create parameterizes item data and returns the saved item", async () => {
  const item = { id: "prep-1", dashboardId: "dashboard-1", name: "Chef's onions" };
  const repository = createPrepRepository({
    query: async (sql, values) => {
      assert.match(sql, /VALUES \(\$1, \$2, \$3::jsonb\)/);
      assert.deepEqual(values, [item.dashboardId, item.id, JSON.stringify(item)]);
      return { rows: [{ data: item }] };
    },
  });
  assert.deepEqual(await repository.create(item), item);
});

test("update and delete cannot target an item in another dashboard", async () => {
  const item = { id: "prep-1", dashboardId: "other-dashboard" };
  const repository = createPrepRepository({
    query: async (sql, values) => {
      assert.match(sql, /WHERE dashboard_id = \$1 AND id = \$2/);
      assert.deepEqual(values.slice(0, 2), [item.dashboardId, item.id]);
      return { rows: [], rowCount: 0 };
    },
  });
  assert.equal(await repository.update(item), null);
  assert.equal(await repository.find(item.dashboardId, item.id), null);
  assert.equal(await repository.remove(item.dashboardId, item.id), false);
});

test("failed writes reject instead of reporting success", async () => {
  const repository = createPrepRepository({
    query: async () => { throw new Error("Database unavailable"); },
  });
  await assert.rejects(repository.create({ id: "prep-1", dashboardId: "dashboard-1" }), /Database unavailable/);
});

test("PostgreSQL CRUD round trip and dashboard isolation", {
  skip: !process.env.DATABASE_URL?.trim(),
}, async () => {
  const { pool } = await import("./database.js");
  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    const repository = createPrepRepository(client);
    await repository.initialize();
    const dashboardId = randomUUID();
    const otherDashboardId = randomUUID();
    const item = { id: randomUUID(), dashboardId, name: "Chef's onions", onHand: 2 };
    assert.deepEqual(await repository.create(item), item);
    assert.deepEqual(await repository.list(dashboardId), [item]);
    const appended = { ...item, id: `000-${randomUUID()}`, name: "Appended item" };
    await repository.create(appended);
    assert.deepEqual(await repository.list(dashboardId), [item, appended]);
    assert.deepEqual(await repository.find(dashboardId, item.id), item);
    assert.deepEqual(await repository.list(otherDashboardId), []);
    assert.equal(await repository.update({ ...item, dashboardId: otherDashboardId }), null);
    assert.equal(await repository.remove(otherDashboardId, item.id), false);
    const updated = { ...item, onHand: 5 };
    assert.deepEqual(await repository.update(updated), updated);
    assert.deepEqual(await repository.list(dashboardId), [updated, appended]);
    assert.equal(await repository.remove(dashboardId, item.id), true);
    assert.deepEqual(await repository.list(dashboardId), [appended]);
    await repository.remove(dashboardId, appended.id);
    assert.deepEqual(await repository.list(dashboardId), []);
  } finally {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } finally {
        client.release();
      }
    }
    await pool.end();
  }
});