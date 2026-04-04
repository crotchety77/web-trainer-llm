import pg from "pg";
import { config } from "./config.js";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: config.databaseUrl
});

pool.on("connect", () => {
  console.log("[db] PostgreSQL connection acquired");
});

pool.on("error", (error) => {
  console.error("[db] Unexpected PostgreSQL error:", error.message);
});
