import express from "express";
import cors from "cors";
import { handovers, prepItems, recipes } from "./data.js";
import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const findIndexById = (list, id) => list.findIndex((item) => item.id === id);

const mergeWithUpdatedAt = (existing, payload) => ({
  ...existing,
  ...payload,
  id: existing.id,
  updatedAt: new Date().toISOString(),
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const prepItemsFilePath = path.join(__dirname, "prep-items.json");
let prepItemsStore = [];

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

const app = express();
const PORT = process.env.PORT || 4000;
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

const persistPrepItems = async () => {
  await writeFile(prepItemsFilePath, JSON.stringify(prepItemsStore, null, 2), "utf-8");
};

const loadPrepItems = async () => {
  try {
    const raw = await readFile(prepItemsFilePath, "utf-8");
    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      throw new Error("prep-items.json must contain an array");
    }

    prepItemsStore = parsed;
  } catch (error) {
    if (error && error.code !== "ENOENT") {
      console.warn("Failed to read prep-items.json, using seed data:", error);
    }

    prepItemsStore = [...prepItems];
    await persistPrepItems();
  }
};

await loadPrepItems();

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
res.json({ ok: true, service: "kitchenready-api" });
});

app.get("/api/prep-items", (_req, res) => {
res.json(prepItemsStore);
});

app.get("/api/recipes", (_req, res) => {
res.json(recipes);
});

app.get("/api/recipes/:id/scale", (req, res) => {
const { id } = req.params;
const recipe = recipes.find((item) => item.id === id);

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

app.get("/api/handovers", (_req, res) => {
res.json(handovers);
});

app.post("/api/prep-items", (req, res) => {
const payload = req.body;
if (!isValidPrepItem(payload)) {
return res.status(400).json({ error: "Invalid prep item payload" });
}

const newItem = {
...payload,
id: payload.id || randomUUID(),
};

prepItemsStore.push(newItem);
return persistPrepItems()
  .then(() => res.status(201).json(newItem))
  .catch(() => res.status(500).json({ error: "Failed to persist prep items" }));
});

app.post("/api/recipes", (req, res) => {
const payload = req.body;
if (!isValidRecipe(payload)) {
return res.status(400).json({ error: "Invalid recipe payload" });
}

const now = new Date().toISOString();
const newRecipe = {
...payload,
id: payload.id || randomUUID(),
createdAt: payload.createdAt || now,
updatedAt: payload.updatedAt || now,
};

recipes.push(newRecipe);
return res.status(201).json(newRecipe);
});

app.post("/api/handovers", (req, res) => {
const payload = req.body;
if (!isValidHandover(payload)) {
return res.status(400).json({ error: "Invalid handover payload" });
}

const now = new Date().toISOString();
const newHandover = {
...payload,
id: payload.id || randomUUID(),
createdAt: payload.createdAt || now,
updatedAt: payload.updatedAt || now,
};

handovers.push(newHandover);
return res.status(201).json(newHandover);
});

app.put("/api/prep-items/:id", (req, res) => {
  const { id } = req.params;
  const payload = req.body;

  if (!isValidPrepItem(payload)) {
    return res.status(400).json({ error: "Invalid prep item payload" });
  }

  const idx = findIndexById(prepItemsStore, id);
  if (idx === -1) {
    return res.status(404).json({ error: "Prep item not found" });
  }

  const updated = { ...payload, id };
  prepItemsStore[idx] = updated;
  return persistPrepItems()
    .then(() => res.json(updated))
    .catch(() => res.status(500).json({ error: "Failed to persist prep items" }));
});

app.delete("/api/prep-items/:id", (req, res) => {
  const { id } = req.params;
  const idx = findIndexById(prepItemsStore, id);

  if (idx === -1) {
    return res.status(404).json({ error: "Prep item not found" });
  }

  prepItemsStore.splice(idx, 1);
  return persistPrepItems()
    .then(() => res.status(204).send())
    .catch(() => res.status(500).json({ error: "Failed to persist prep items" }));
});

app.put("/api/recipes/:id", (req, res) => {
  const { id } = req.params;
  const payload = req.body;

  if (!isValidRecipe(payload)) {
    return res.status(400).json({ error: "Invalid recipe payload" });
  }

  const idx = findIndexById(recipes, id);
  if (idx === -1) {
    return res.status(404).json({ error: "Recipe not found" });
  }

  const updated = mergeWithUpdatedAt(recipes[idx], { ...payload, id });
  recipes[idx] = updated;
  return res.json(updated);
});

app.delete("/api/recipes/:id", (req, res) => {
  const { id } = req.params;
  const idx = findIndexById(recipes, id);

  if (idx === -1) {
    return res.status(404).json({ error: "Recipe not found" });
  }

  recipes.splice(idx, 1);
  return res.status(204).send();
});

app.put("/api/handovers/:id", (req, res) => {
  const { id } = req.params;
  const payload = req.body;

  if (!isValidHandover(payload)) {
    return res.status(400).json({ error: "Invalid handover payload" });
  }

  const idx = findIndexById(handovers, id);
  if (idx === -1) {
    return res.status(404).json({ error: "Handover not found" });
  }

  const updated = mergeWithUpdatedAt(handovers[idx], { ...payload, id });
  handovers[idx] = updated;
  return res.json(updated);
});

app.delete("/api/handovers/:id", (req, res) => {
  const { id } = req.params;
  const idx = findIndexById(handovers, id);

  if (idx === -1) {
    return res.status(404).json({ error: "Handover not found" });
  }

  handovers.splice(idx, 1);
  return res.status(204).send();
});

app.listen(PORT, () => {
console.log("API running on http://localhost:" + PORT);
});