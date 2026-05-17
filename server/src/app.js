import express from "express";
import cors from "cors";
import authRoutes from "./routes/authRoutes.js";
import courseRoutes from "./routes/courseRoutes.js";
import { config } from "./config.js";
import { getAiStatus } from "./modules/ai.js";
import aiRoutes from "./routes/aiRoutes.js";
import codeRoutes from "./routes/codeRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";

export const app = express();

const allowedOrigins = new Set([
  config.clientUrl,
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5174"
]);

function isAllowedDevOrigin(origin) {
  if (process.env.NODE_ENV === "production") {
    return false;
  }

  try {
    const { hostname, protocol } = new URL(origin);

    if (!["http:", "https:"].includes(protocol)) {
      return false;
    }

    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname.startsWith("10.") ||
      hostname.startsWith("192.168.") ||
      hostname.endsWith(".ngrok-free.dev") ||
      hostname.endsWith(".ngrok-free.app") ||
      hostname.endsWith(".loca.lt") ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname) ||
      /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(hostname)
    );
  } catch {
    return false;
  }
}

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin) || isAllowedDevOrigin(origin)) {
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
app.use("/api/ai", aiRoutes);
app.use("/api", codeRoutes);
app.use("/api/admin", adminRoutes);

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
