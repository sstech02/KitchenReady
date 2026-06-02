import express from "express";
import cors from "cors";
import { handovers, prepItems, recipes } from "./data.js";
import { randomUUID } from "node:crypto";

const findIndexById = (list, id) => list.findIndex((item) => item.id === id);

const mergeWithUpdatedAt = (existing, payload) => ({
  ...existing,
  ...payload,
  id: existing.id,
  updatedAt: new Date().toISOString(),
});

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

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
res.json({ ok: true, service: "kitchenready-api" });
});

app.get("/api/prep-items", (_req, res) => {
res.json(prepItems);
});

app.get("/api/recipes", (_req, res) => {
res.json(recipes);
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

prepItems.push(newItem);
return res.status(201).json(newItem);
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

  const idx = findIndexById(prepItems, id);
  if (idx === -1) {
    return res.status(404).json({ error: "Prep item not found" });
  }

  const updated = { ...payload, id };
  prepItems[idx] = updated;
  return res.json(updated);
});

app.delete("/api/prep-items/:id", (req, res) => {
  const { id } = req.params;
  const idx = findIndexById(prepItems, id);

  if (idx === -1) {
    return res.status(404).json({ error: "Prep item not found" });
  }

  prepItems.splice(idx, 1);
  return res.status(204).send();
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