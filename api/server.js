import express from "express";
import cors from "cors";
import { handovers, prepItems, recipes } from "./data.js";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
const PORT = process.env.PORT || 4000;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const prepItemsFilePath = path.join(__dirname, "prep-items.json");
const adminAccountsFilePath = path.join(__dirname, "admin-accounts.json");
const dashboardsFilePath = path.join(__dirname, "dashboards.json");
const dashboardMembershipsFilePath = path.join(__dirname, "dashboard-memberships.json");

const adminApiKey = process.env.ADMIN_API_KEY?.trim() || "";
const roleOrder = ["viewer", "operator", "lead", "admin"];
const roleRank = {
  viewer: 0,
  operator: 1,
  lead: 2,
  admin: 3,
};

let prepItemsStore = [];
let adminAccountsStore = new Set();
let dashboardsStore = [];
let dashboardMembershipsStore = [];
let recipesStore = [];
let handoversStore = [];
let defaultDashboardId = "";
let storesInitialized = false;

const normalizeEmail = (value) => value.trim().toLowerCase();
const isValidEmail = (value) => /.+@.+\..+/.test(value);
const parseEmails = (value) =>
  (value ?? "")
    .split(",")
    .map((entry) => normalizeEmail(entry))
    .filter(Boolean);

const findIndexById = (list, id) => list.findIndex((item) => item.id === id);

const mergeWithUpdatedAt = (existing, payload) => ({
  ...existing,
  ...payload,
  id: existing.id,
  updatedAt: new Date().toISOString(),
});

const parseJsonArray = (raw, fallbackMessage) => {
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error(fallbackMessage);
  }

  return parsed;
};

const safeKeyEquals = (provided, expected) => {
  if (!provided || !expected) {
    return false;
  }

  const providedBuffer = Buffer.from(provided, "utf-8");
  const expectedBuffer = Buffer.from(expected, "utf-8");
  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(providedBuffer, expectedBuffer);
};

const readUserEmailHeader = (req) => {
  const rawValue = req.get("x-user-email");
  if (typeof rawValue !== "string") {
    return "";
  }

  return normalizeEmail(rawValue);
};

const readDashboardIdHeader = (req) => {
  const rawValue = req.get("x-dashboard-id");
  if (typeof rawValue !== "string") {
    return "";
  }

  return rawValue.trim();
};

const getMembership = (dashboardId, userEmail) =>
  dashboardMembershipsStore.find(
    (membership) => membership.dashboardId === dashboardId && membership.userEmail === userEmail,
  );

const hasRoleAtLeast = (actualRole, minimumRole) => roleRank[actualRole] >= roleRank[minimumRole];

const persistPrepItems = async () => {
  await writeFile(prepItemsFilePath, JSON.stringify(prepItemsStore, null, 2), "utf-8");
};

const persistAdminAccounts = async () => {
  await writeFile(
    adminAccountsFilePath,
    JSON.stringify(Array.from(adminAccountsStore).sort(), null, 2),
    "utf-8",
  );
};

const persistDashboards = async () => {
  await writeFile(dashboardsFilePath, JSON.stringify(dashboardsStore, null, 2), "utf-8");
};

const persistMemberships = async () => {
  await writeFile(
    dashboardMembershipsFilePath,
    JSON.stringify(dashboardMembershipsStore, null, 2),
    "utf-8",
  );
};

const ensureDashboardSeed = async () => {
  if (dashboardsStore.length > 0) {
    defaultDashboardId = dashboardsStore[0].id;
    return;
  }

  const now = new Date().toISOString();
  const seedDashboard = {
    id: randomUUID(),
    businessName: "KitchenReady Demo",
    createdAt: now,
    updatedAt: now,
  };
  dashboardsStore = [seedDashboard];
  defaultDashboardId = seedDashboard.id;

  await persistDashboards();
};

const ensureAdminMembershipSeed = async () => {
  const existingAdminsForDefault = dashboardMembershipsStore.filter(
    (membership) => membership.dashboardId === defaultDashboardId && membership.role === "admin",
  );

  if (existingAdminsForDefault.length > 0) {
    return;
  }

  const seedAdmin =
    Array.from(adminAccountsStore)[0] || parseEmails(process.env.ADMIN_EMAILS)[0] || "owner@kitchenready.local";

  if (!isValidEmail(seedAdmin)) {
    return;
  }

  const now = new Date().toISOString();
  dashboardMembershipsStore.push({
    id: randomUUID(),
    dashboardId: defaultDashboardId,
    userEmail: seedAdmin,
    role: "admin",
    createdAt: now,
    updatedAt: now,
  });

  await persistMemberships();
};

const loadPrepItems = async () => {
  try {
    const raw = await readFile(prepItemsFilePath, "utf-8");
    prepItemsStore = parseJsonArray(raw, "prep-items.json must contain an array");
  } catch (error) {
    if (error && error.code !== "ENOENT") {
      console.warn("Failed to read prep-items.json, using seed data:", error);
    }

    prepItemsStore = [...prepItems];
    await persistPrepItems();
  }
};

const loadAdminAccounts = async () => {
  const seedFromEnv = parseEmails(process.env.ADMIN_EMAILS);

  try {
    const raw = await readFile(adminAccountsFilePath, "utf-8");
    const parsed = parseJsonArray(raw, "admin-accounts.json must contain an array");
    adminAccountsStore = new Set(
      parsed
        .filter((email) => typeof email === "string")
        .map((email) => normalizeEmail(email))
        .filter((email) => isValidEmail(email)),
    );
  } catch (error) {
    if (error && error.code !== "ENOENT") {
      console.warn("Failed to read admin-accounts.json, using env seed:", error);
    }

    adminAccountsStore = new Set();
  }

  seedFromEnv.forEach((email) => {
    if (isValidEmail(email)) {
      adminAccountsStore.add(email);
    }
  });

  await persistAdminAccounts();
};

const loadDashboards = async () => {
  try {
    const raw = await readFile(dashboardsFilePath, "utf-8");
    dashboardsStore = parseJsonArray(raw, "dashboards.json must contain an array");
  } catch (error) {
    if (error && error.code !== "ENOENT") {
      console.warn("Failed to read dashboards.json, creating seed:", error);
    }

    dashboardsStore = [];
  }

  await ensureDashboardSeed();
};

const loadMemberships = async () => {
  try {
    const raw = await readFile(dashboardMembershipsFilePath, "utf-8");
    const parsed = parseJsonArray(raw, "dashboard-memberships.json must contain an array");
    dashboardMembershipsStore = parsed.filter((membership) =>
      membership &&
      typeof membership.id === "string" &&
      typeof membership.dashboardId === "string" &&
      typeof membership.userEmail === "string" &&
      roleOrder.includes(membership.role),
    );
  } catch (error) {
    if (error && error.code !== "ENOENT") {
      console.warn("Failed to read dashboard-memberships.json, creating seed:", error);
    }

    dashboardMembershipsStore = [];
  }

  await ensureAdminMembershipSeed();
};

const loadDomainStores = async () => {
  recipesStore = recipes.map((recipe) => ({ ...recipe }));
  handoversStore = handovers.map((handover) => ({ ...handover }));

  await loadPrepItems();
  await loadAdminAccounts();
  await loadDashboards();
  await loadMemberships();

  let prepTouched = false;
  prepItemsStore = prepItemsStore.map((item) => {
    if (item.dashboardId) {
      return item;
    }

    prepTouched = true;
    return { ...item, dashboardId: defaultDashboardId };
  });

  if (prepTouched) {
    await persistPrepItems();
  }

  recipesStore = recipesStore.map((recipe) => ({
    ...recipe,
    dashboardId: recipe.dashboardId || defaultDashboardId,
  }));

  handoversStore = handoversStore.map((handover) => ({
    ...handover,
    dashboardId: handover.dashboardId || defaultDashboardId,
  }));
};

const requireAdminApiKey = (req, res, next) => {
  if (!adminApiKey) {
    return res.status(503).json({ error: "ADMIN_API_KEY is not configured on the server" });
  }

  const providedApiKey = req.get("x-admin-key") || "";
  if (!safeKeyEquals(providedApiKey, adminApiKey)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  return next();
};

const requireUserEmail = (req, res, next) => {
  const userEmail = readUserEmailHeader(req);
  if (!isValidEmail(userEmail)) {
    return res.status(401).json({ error: "x-user-email header is required" });
  }

  req.userEmail = userEmail;
  return next();
};

const requireDashboardContext = (req, res, next) => {
  const dashboardId = readDashboardIdHeader(req);
  if (!dashboardId) {
    return res.status(400).json({ error: "x-dashboard-id header is required" });
  }

  const dashboard = dashboardsStore.find((item) => item.id === dashboardId);
  if (!dashboard) {
    return res.status(404).json({ error: "Dashboard not found" });
  }

  const membership = getMembership(dashboardId, req.userEmail);
  if (!membership) {
    return res.status(403).json({ error: "Forbidden: dashboard membership required" });
  }

  req.dashboardId = dashboardId;
  req.dashboard = dashboard;
  req.membership = membership;
  return next();
};

const requireRole = (minimumRole) => (req, res, next) => {
  if (!req.membership || !hasRoleAtLeast(req.membership.role, minimumRole)) {
    return res.status(403).json({ error: `Forbidden: ${minimumRole} role required` });
  }

  return next();
};

const roundTo = (value, decimals = 2) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

const scaleRecipe = (recipe, targetYield, decimals = 2) => {
  const ratio = targetYield / recipe.yieldAmount;

  return {
    ...recipe,
    ingredients: recipe.ingredients.map((ingredient) => ({
      ...ingredient,
      quantity: roundTo(ingredient.quantity * ratio, decimals),
    })),
    yieldAmount: roundTo(targetYield, decimals),
    updatedAt: new Date().toISOString(),
  };
};

const isObject = (v) => typeof v === "object" && v !== null;

const isValidPrepItem = (item) =>
  isObject(item) &&
  typeof item.name === "string" &&
  typeof item.parLevel === "number" &&
  typeof item.onHand === "number" &&
  typeof item.targetQty === "number" &&
  typeof item.unit === "string" &&
  [1, 2, 3].includes(item.priority) &&
  typeof item.status === "string";

const isValidRecipe = (recipe) =>
  isObject(recipe) &&
  typeof recipe.name === "string" &&
  Array.isArray(recipe.ingredients) &&
  Array.isArray(recipe.steps) &&
  typeof recipe.yieldAmount === "number" &&
  typeof recipe.yieldUnit === "string" &&
  typeof recipe.active === "boolean";

const isValidHandover = (handover) =>
  isObject(handover) &&
  typeof handover.businessDate === "string" &&
  ["am", "pm", "overnight"].includes(handover.shiftType) &&
  typeof handover.fromUser === "string" &&
  typeof handover.summary === "string" &&
  Array.isArray(handover.prepItems) &&
  typeof handover.signedOff === "boolean";

const adminCountForDashboard = (dashboardId) =>
  dashboardMembershipsStore.filter(
    (membership) => membership.dashboardId === dashboardId && membership.role === "admin",
  ).length;

const ensureInitialized = async () => {
  if (storesInitialized) {
    return;
  }

  await loadDomainStores();
  storesInitialized = true;
};

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "kitchenready-api" });
});

app.get("/api/dashboards", requireUserEmail, (req, res) => {
  const summaries = dashboardMembershipsStore
    .filter((membership) => membership.userEmail === req.userEmail)
    .map((membership) => {
      const dashboard = dashboardsStore.find((item) => item.id === membership.dashboardId);
      if (!dashboard) {
        return null;
      }

      return {
        ...dashboard,
        role: membership.role,
      };
    })
    .filter(Boolean);

  return res.json(summaries);
});

app.post("/api/dashboards", requireUserEmail, async (req, res) => {
  const businessName = typeof req.body?.businessName === "string" ? req.body.businessName.trim() : "";
  const adminEmail =
    typeof req.body?.adminEmail === "string" ? normalizeEmail(req.body.adminEmail) : "";

  if (!businessName) {
    return res.status(400).json({ error: "businessName is required" });
  }

  if (!isValidEmail(adminEmail)) {
    return res.status(400).json({ error: "adminEmail is required and must be valid" });
  }

  const now = new Date().toISOString();
  const dashboard = {
    id: randomUUID(),
    businessName,
    createdAt: now,
    updatedAt: now,
  };

  const adminMembership = {
    id: randomUUID(),
    dashboardId: dashboard.id,
    userEmail: adminEmail,
    role: "admin",
    createdAt: now,
    updatedAt: now,
  };

  dashboardsStore.push(dashboard);
  dashboardMembershipsStore.push(adminMembership);

  if (req.userEmail !== adminEmail) {
    dashboardMembershipsStore.push({
      id: randomUUID(),
      dashboardId: dashboard.id,
      userEmail: req.userEmail,
      role: "lead",
      createdAt: now,
      updatedAt: now,
    });
  }

  try {
    await persistDashboards();
    await persistMemberships();
    return res.status(201).json({ ...dashboard, role: req.userEmail === adminEmail ? "admin" : "lead" });
  } catch {
    dashboardsStore = dashboardsStore.filter((item) => item.id !== dashboard.id);
    dashboardMembershipsStore = dashboardMembershipsStore.filter((item) => item.dashboardId !== dashboard.id);
    return res.status(500).json({ error: "Failed to persist dashboard" });
  }
});

app.get("/api/dashboards/:id/members", requireUserEmail, requireDashboardContext, requireRole("lead"), (req, res) => {
  const members = dashboardMembershipsStore
    .filter((membership) => membership.dashboardId === req.dashboardId)
    .map((membership) => ({
      ...membership,
      isCurrentUser: membership.userEmail === req.userEmail,
    }));

  return res.json(members);
});

app.post("/api/dashboards/:id/members", requireUserEmail, requireDashboardContext, requireRole("admin"), async (req, res) => {
  const userEmail = typeof req.body?.userEmail === "string" ? normalizeEmail(req.body.userEmail) : "";
  const role = req.body?.role;

  if (!isValidEmail(userEmail)) {
    return res.status(400).json({ error: "userEmail is required and must be valid" });
  }

  if (!roleOrder.includes(role)) {
    return res.status(400).json({ error: "role must be one of viewer, operator, lead, admin" });
  }

  const existing = getMembership(req.dashboardId, userEmail);
  if (existing) {
    return res.status(409).json({ error: "Membership already exists" });
  }

  const now = new Date().toISOString();
  const membership = {
    id: randomUUID(),
    dashboardId: req.dashboardId,
    userEmail,
    role,
    createdAt: now,
    updatedAt: now,
  };

  dashboardMembershipsStore.push(membership);

  try {
    await persistMemberships();
    return res.status(201).json(membership);
  } catch {
    dashboardMembershipsStore = dashboardMembershipsStore.filter((item) => item.id !== membership.id);
    return res.status(500).json({ error: "Failed to persist membership" });
  }
});

app.put("/api/dashboards/:id/members/:memberId", requireUserEmail, requireDashboardContext, requireRole("admin"), async (req, res) => {
  const { memberId } = req.params;
  const role = req.body?.role;

  if (!roleOrder.includes(role)) {
    return res.status(400).json({ error: "role must be one of viewer, operator, lead, admin" });
  }

  const idx = dashboardMembershipsStore.findIndex(
    (membership) => membership.id === memberId && membership.dashboardId === req.dashboardId,
  );

  if (idx === -1) {
    return res.status(404).json({ error: "Membership not found" });
  }

  const existing = dashboardMembershipsStore[idx];
  if (existing.role === "admin" && role !== "admin" && adminCountForDashboard(req.dashboardId) <= 1) {
    return res.status(400).json({ error: "Dashboard must retain at least one admin" });
  }

  const updated = {
    ...existing,
    role,
    updatedAt: new Date().toISOString(),
  };

  dashboardMembershipsStore[idx] = updated;

  try {
    await persistMemberships();
    return res.json(updated);
  } catch {
    dashboardMembershipsStore[idx] = existing;
    return res.status(500).json({ error: "Failed to persist membership" });
  }
});

app.delete("/api/dashboards/:id/members/:memberId", requireUserEmail, requireDashboardContext, requireRole("admin"), async (req, res) => {
  const { memberId } = req.params;
  const idx = dashboardMembershipsStore.findIndex(
    (membership) => membership.id === memberId && membership.dashboardId === req.dashboardId,
  );

  if (idx === -1) {
    return res.status(404).json({ error: "Membership not found" });
  }

  const existing = dashboardMembershipsStore[idx];
  if (existing.role === "admin" && adminCountForDashboard(req.dashboardId) <= 1) {
    return res.status(400).json({ error: "Dashboard must retain at least one admin" });
  }

  dashboardMembershipsStore.splice(idx, 1);

  try {
    await persistMemberships();
    return res.status(204).send();
  } catch {
    dashboardMembershipsStore.splice(idx, 0, existing);
    return res.status(500).json({ error: "Failed to persist membership" });
  }
});

app.get("/api/prep-items", requireUserEmail, requireDashboardContext, (_req, res) => {
  const items = prepItemsStore.filter((item) => item.dashboardId === _req.dashboardId);
  res.json(items);
});

app.get("/api/recipes", requireUserEmail, requireDashboardContext, (req, res) => {
  const items = recipesStore.filter((item) => item.dashboardId === req.dashboardId);
  res.json(items);
});

app.get("/api/recipes/:id/scale", requireUserEmail, requireDashboardContext, (req, res) => {
  const { id } = req.params;
  const recipe = recipesStore.find((item) => item.id === id && item.dashboardId === req.dashboardId);

  if (!recipe) {
    return res.status(404).json({ error: "Recipe not found" });
  }

  const rawYield = req.query.yield;
  const rawFactor = req.query.factor;
  const decimals = Number(req.query.decimals ?? 2);

  if (rawYield === undefined && rawFactor === undefined) {
    return res.status(400).json({
      error: "Provide either ?yield=<number> or ?factor=<number>",
    });
  }

  if (rawYield !== undefined && rawFactor !== undefined) {
    return res.status(400).json({
      error: "Use only one query param: yield or factor",
    });
  }

  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 6) {
    return res.status(400).json({ error: "decimals must be an integer between 0 and 6" });
  }

  let targetYield;

  if (rawYield !== undefined) {
    targetYield = Number(rawYield);
    if (!Number.isFinite(targetYield) || targetYield <= 0) {
      return res.status(400).json({ error: "yield must be a positive number" });
    }
  } else {
    const factor = Number(rawFactor);
    if (!Number.isFinite(factor) || factor <= 0) {
      return res.status(400).json({ error: "factor must be a positive number" });
    }
    targetYield = recipe.yieldAmount * factor;
  }

  if (!Number.isFinite(recipe.yieldAmount) || recipe.yieldAmount <= 0) {
    return res.status(400).json({ error: "recipe yieldAmount must be a positive number" });
  }

  return res.json(scaleRecipe(recipe, targetYield, decimals));
});

app.get("/api/handovers", requireUserEmail, requireDashboardContext, (req, res) => {
  const items = handoversStore.filter((item) => item.dashboardId === req.dashboardId);
  res.json(items);
});

app.get("/api/admin/accounts", requireAdminApiKey, (_req, res) => {
  return res.json({
    admins: Array.from(adminAccountsStore).sort(),
  });
});

app.post("/api/admin/accounts", requireAdminApiKey, async (req, res) => {
  const { email } = req.body ?? {};
  if (typeof email !== "string") {
    return res.status(400).json({ error: "email is required" });
  }

  const normalized = normalizeEmail(email);
  if (!isValidEmail(normalized)) {
    return res.status(400).json({ error: "email is invalid" });
  }

  adminAccountsStore.add(normalized);

  try {
    await persistAdminAccounts();
    return res.status(201).json({ email: normalized });
  } catch {
    return res.status(500).json({ error: "Failed to persist admin accounts" });
  }
});

app.delete("/api/admin/accounts/:email", requireAdminApiKey, async (req, res) => {
  const normalized = normalizeEmail(decodeURIComponent(req.params.email || ""));
  if (!isValidEmail(normalized)) {
    return res.status(400).json({ error: "email is invalid" });
  }

  const removed = adminAccountsStore.delete(normalized);
  if (!removed) {
    return res.status(404).json({ error: "Admin account not found" });
  }

  try {
    await persistAdminAccounts();
    return res.status(204).send();
  } catch {
    adminAccountsStore.add(normalized);
    return res.status(500).json({ error: "Failed to persist admin accounts" });
  }
});

app.post("/api/prep-items", requireUserEmail, requireDashboardContext, requireRole("admin"), (req, res) => {
  const payload = req.body;
  if (!isValidPrepItem(payload)) {
    return res.status(400).json({ error: "Invalid prep item payload" });
  }

  const newItem = {
    ...payload,
    id: payload.id || randomUUID(),
    dashboardId: req.dashboardId,
  };

  prepItemsStore.push(newItem);
  return persistPrepItems()
    .then(() => res.status(201).json(newItem))
    .catch(() => res.status(500).json({ error: "Failed to persist prep items" }));
});

app.post("/api/recipes", requireUserEmail, requireDashboardContext, requireRole("admin"), (req, res) => {
  const payload = req.body;
  if (!isValidRecipe(payload)) {
    return res.status(400).json({ error: "Invalid recipe payload" });
  }

  const now = new Date().toISOString();
  const newRecipe = {
    ...payload,
    id: payload.id || randomUUID(),
    dashboardId: req.dashboardId,
    createdAt: payload.createdAt || now,
    updatedAt: payload.updatedAt || now,
  };

  recipesStore.push(newRecipe);
  return res.status(201).json(newRecipe);
});

app.post("/api/handovers", requireUserEmail, requireDashboardContext, requireRole("lead"), (req, res) => {
  const payload = req.body;
  if (!isValidHandover(payload)) {
    return res.status(400).json({ error: "Invalid handover payload" });
  }

  const now = new Date().toISOString();
  const newHandover = {
    ...payload,
    id: payload.id || randomUUID(),
    dashboardId: req.dashboardId,
    createdAt: payload.createdAt || now,
    updatedAt: payload.updatedAt || now,
  };

  handoversStore.push(newHandover);
  return res.status(201).json(newHandover);
});

app.put("/api/prep-items/:id", requireUserEmail, requireDashboardContext, requireRole("operator"), (req, res) => {
  const { id } = req.params;
  const payload = req.body;

  if (!isValidPrepItem(payload)) {
    return res.status(400).json({ error: "Invalid prep item payload" });
  }

  const idx = prepItemsStore.findIndex((item) => item.id === id && item.dashboardId === req.dashboardId);
  if (idx === -1) {
    return res.status(404).json({ error: "Prep item not found" });
  }

  const updated = { ...payload, id, dashboardId: req.dashboardId };
  prepItemsStore[idx] = updated;
  return persistPrepItems()
    .then(() => res.json(updated))
    .catch(() => res.status(500).json({ error: "Failed to persist prep items" }));
});

app.delete("/api/prep-items/:id", requireUserEmail, requireDashboardContext, requireRole("admin"), (req, res) => {
  const { id } = req.params;
  const idx = prepItemsStore.findIndex((item) => item.id === id && item.dashboardId === req.dashboardId);

  if (idx === -1) {
    return res.status(404).json({ error: "Prep item not found" });
  }

  prepItemsStore.splice(idx, 1);
  return persistPrepItems()
    .then(() => res.status(204).send())
    .catch(() => res.status(500).json({ error: "Failed to persist prep items" }));
});

app.put("/api/recipes/:id", requireUserEmail, requireDashboardContext, requireRole("admin"), (req, res) => {
  const { id } = req.params;
  const payload = req.body;

  if (!isValidRecipe(payload)) {
    return res.status(400).json({ error: "Invalid recipe payload" });
  }

  const idx = recipesStore.findIndex((item) => item.id === id && item.dashboardId === req.dashboardId);
  if (idx === -1) {
    return res.status(404).json({ error: "Recipe not found" });
  }

  const updated = mergeWithUpdatedAt(recipesStore[idx], { ...payload, id, dashboardId: req.dashboardId });
  recipesStore[idx] = updated;
  return res.json(updated);
});

app.delete("/api/recipes/:id", requireUserEmail, requireDashboardContext, requireRole("admin"), (req, res) => {
  const { id } = req.params;
  const idx = recipesStore.findIndex((item) => item.id === id && item.dashboardId === req.dashboardId);

  if (idx === -1) {
    return res.status(404).json({ error: "Recipe not found" });
  }

  recipesStore.splice(idx, 1);
  return res.status(204).send();
});

app.put("/api/handovers/:id", requireUserEmail, requireDashboardContext, requireRole("lead"), (req, res) => {
  const { id } = req.params;
  const payload = req.body;

  if (!isValidHandover(payload)) {
    return res.status(400).json({ error: "Invalid handover payload" });
  }

  const idx = handoversStore.findIndex((item) => item.id === id && item.dashboardId === req.dashboardId);
  if (idx === -1) {
    return res.status(404).json({ error: "Handover not found" });
  }

  const updated = mergeWithUpdatedAt(handoversStore[idx], { ...payload, id, dashboardId: req.dashboardId });
  handoversStore[idx] = updated;
  return res.json(updated);
});

app.delete("/api/handovers/:id", requireUserEmail, requireDashboardContext, requireRole("admin"), (req, res) => {
  const { id } = req.params;
  const idx = handoversStore.findIndex((item) => item.id === id && item.dashboardId === req.dashboardId);

  if (idx === -1) {
    return res.status(404).json({ error: "Handover not found" });
  }

  handoversStore.splice(idx, 1);
  return res.status(204).send();
});

export default async function handler(req, res) {
  await ensureInitialized();
  return app(req, res);
}

if (!process.env.VERCEL) {
  ensureInitialized()
    .then(() => {
      app.listen(PORT, () => {
        console.log("API running on http://localhost:" + PORT);
      });
    })
    .catch((error) => {
      console.error("Failed to initialize API stores:", error);
      process.exit(1);
    });
}
