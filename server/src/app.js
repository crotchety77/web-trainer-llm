import express from "express";
import cors from "cors";
import authRoutes from "./routes/authRoutes.js";
import courseRoutes from "./routes/courseRoutes.js";
import { config } from "./config.js";
import { getAiStatus } from "./modules/ai.js";

export const app = express();

const allowedOrigins = new Set([
  config.clientUrl,
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5174"
]);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS origin is not allowed: ${origin}`));
    }
  })
);
app.use(express.json());
app.use((request, response, next) => {
  const startedAt = Date.now();
  console.log(`[http] ${request.method} ${request.originalUrl}`);

  response.on("finish", () => {
    const duration = Date.now() - startedAt;
    console.log(
      `[http] ${request.method} ${request.originalUrl} -> ${response.statusCode} (${duration}ms)`
    );
  });

  next();
});

app.get("/api/health", (request, response) => {
  response.json({
    status: "ok",
    ai: getAiStatus()
  });
});

app.use("/api/auth", authRoutes);
app.use("/api", courseRoutes);

app.use((error, request, response, next) => {
  if (response.headersSent) {
    return next(error);
  }

  console.error("[server] Unhandled error:", error.message);

  return response.status(500).json({
    message: "Internal server error",
    error: error.message
  });
});
