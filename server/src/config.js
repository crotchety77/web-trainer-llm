import dotenv from "dotenv";
import path from "path";

const localEnvPath = path.resolve(process.cwd(), ".env");
const rootEnvPath = path.resolve(process.cwd(), "..", ".env");

const localEnv = dotenv.config({ path: localEnvPath });
const rootEnv = localEnv.error ? dotenv.config({ path: rootEnvPath }) : localEnv;

if (rootEnv.error) {
  console.warn("[config] .env file not found, using process environment only");
} else {
  console.log(`[config] Loaded environment from ${rootEnv.parsed ? (localEnv.error ? rootEnvPath : localEnvPath) : "process environment"}`);
}

export const config = {
  port: Number(process.env.PORT) || 5000,
  databaseUrl: process.env.DATABASE_URL || "",
  jwtSecret: process.env.JWT_SECRET || "change-me",
  clientUrl: process.env.CLIENT_URL || "http://localhost:5173"
};
