export const createPrepRepository = (pool) => ({
  initialize: async () => {
    await pool.query(`CREATE TABLE IF NOT EXISTS prep_items (
      dashboard_id TEXT NOT NULL,
      id TEXT NOT NULL,
      data JSONB NOT NULL,
      position BIGINT GENERATED ALWAYS AS IDENTITY,
      PRIMARY KEY (dashboard_id, id)
    )`);
    await pool.query("ALTER TABLE prep_items ADD COLUMN IF NOT EXISTS position BIGINT GENERATED ALWAYS AS IDENTITY");
    await pool.query(`CREATE OR REPLACE FUNCTION kitchenready_notify_prep_change() RETURNS TRIGGER AS $$
      BEGIN
        IF TG_OP = 'DELETE' THEN
          PERFORM pg_notify('kitchenready_prep_changed', OLD.dashboard_id);
          RETURN OLD;
        END IF;
        PERFORM pg_notify('kitchenready_prep_changed', NEW.dashboard_id);
        RETURN NEW;
      END;
    $$ LANGUAGE plpgsql`);
    await pool.query("DROP TRIGGER IF EXISTS kitchenready_prep_change ON prep_items");
    await pool.query(`CREATE TRIGGER kitchenready_prep_change
      AFTER INSERT OR UPDATE OR DELETE ON prep_items
      FOR EACH ROW EXECUTE FUNCTION kitchenready_notify_prep_change()`);
  },
  list: async (dashboardId) => {
    const { rows } = await pool.query(
      "SELECT data FROM prep_items WHERE dashboard_id = $1 ORDER BY position, id",
      [dashboardId],
    );
    return rows.map((row) => row.data);
  },
  listAll: async () => {
    const { rows } = await pool.query("SELECT data FROM prep_items ORDER BY dashboard_id, position, id");
    return rows.map((row) => row.data);
  },
  find: async (dashboardId, id) => {
    const { rows } = await pool.query(
      "SELECT data FROM prep_items WHERE dashboard_id = $1 AND id = $2",
      [dashboardId, id],
    );
    return rows[0]?.data ?? null;
  },
  create: async (item) => {
    const { rows } = await pool.query(
      "INSERT INTO prep_items (dashboard_id, id, data) VALUES ($1, $2, $3::jsonb) RETURNING data",
      [item.dashboardId, item.id, JSON.stringify(item)],
    );
    return rows[0].data;
  },
  update: async (item) => {
    const { rows } = await pool.query(
      "UPDATE prep_items SET data = $3::jsonb WHERE dashboard_id = $1 AND id = $2 RETURNING data",
      [item.dashboardId, item.id, JSON.stringify(item)],
    );
    return rows[0]?.data ?? null;
  },
  remove: async (dashboardId, id) => {
    const { rowCount } = await pool.query(
      "DELETE FROM prep_items WHERE dashboard_id = $1 AND id = $2",
      [dashboardId, id],
    );
    return rowCount > 0;
  },
  removeDashboard: async (dashboardId) => {
    await pool.query("DELETE FROM prep_items WHERE dashboard_id = $1", [dashboardId]);
  },
});