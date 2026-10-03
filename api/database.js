import dotenv from "dotenv";
import pg from "pg";
import { fileURLToPath } from "node:url";
import { createPrepRepository } from "./prepRepository.js";

dotenv.config({
  path: ["../.env.local", "../.env"].map((name) => fileURLToPath(new URL(name, import.meta.url))),
  quiet: true,
});

if (!process.env.DATABASE_URL?.trim()) {
  throw new Error("DATABASE_URL is required. Configure it in the project .env or backend environment before starting the API.");
}

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 10000,
});

pool.on("error", () => console.error("Unexpected PostgreSQL connection error"));

export const prepRepository = createPrepRepository(pool);