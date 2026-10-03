import { copyFile, mkdir, readFile } from "node:fs/promises";
import { pool } from "./database.js";
import { createPrepRepository } from "./prepRepository.js";

let client;
try {
  client = await pool.connect();
  await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock(4719021)");
  await client.query("CREATE TABLE IF NOT EXISTS kitchenready_migrations (id TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())");
  await createPrepRepository(client).initialize();
  const migrationId = "import-json-prep-items-v1";
  const { rowCount } = await client.query("SELECT id FROM kitchenready_migrations WHERE id = $1", [migrationId]);

  if (rowCount === 0) {
    const items = JSON.parse(await readFile(new URL("./prep-items.json", import.meta.url), "utf-8"));
    const dashboards = JSON.parse(await readFile(new URL("./dashboards.json", import.meta.url), "utf-8"));
    if (!Array.isArray(items) || !Array.isArray(dashboards) || !dashboards[0]?.id) {
      throw new Error("Valid prep-items.json and dashboards.json arrays are required for import");
    }

    const backupDirectory = new URL("./backups/", import.meta.url);
    await mkdir(backupDirectory, { recursive: true });
    await copyFile(new URL("./prep-items.json", import.meta.url), new URL(`prep-items-${Date.now()}.json`, backupDirectory));

    for (const item of items) {
      const dashboardId = item.dashboardId || dashboards[0].id;
      if (typeof item.id !== "string" || !item.id || !dashboards.some((dashboard) => dashboard.id === dashboardId)) {
        throw new Error("Every prep item must have an ID and belong to an existing dashboard");
      }
      await client.query(
        "INSERT INTO prep_items (dashboard_id, id, data) VALUES ($1, $2, $3::jsonb) ON CONFLICT (dashboard_id, id) DO NOTHING",
        [dashboardId, item.id, JSON.stringify({ ...item, dashboardId })],
      );
    }
    await client.query("INSERT INTO kitchenready_migrations (id) VALUES ($1)", [migrationId]);
    console.log("Prep item import complete; existing SQL records were preserved. JSON backup saved in api/backups.");
  } else {
    console.log("Prep item import already applied; no data was changed.");
  }
  await client.query("COMMIT");
} catch (error) {
  if (client) await client.query("ROLLBACK");
  console.error("Prep item migration failed:", error.message);
  process.exitCode = 1;
} finally {
  client?.release();
  await pool.end();
}