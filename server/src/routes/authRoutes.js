import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { pool } from "../db.js";
import { config } from "../config.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import {
  encryptUserApiKey,
  isValidUserLlmApiKey,
  isValidUserLlmFolderId
} from "../modules/userApiKey.js";

const router = Router();
const ALLOWED_ROLES = new Set(["student", "author"]);

function createToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role
    },
    config.jwtSecret,
    { expiresIn: "7d" }
  );
}

function sanitizeAuthPayload(payload) {
  return {
    ...payload,
    password: payload.password ? "[hidden]" : undefined
  };
}

function toPublicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    created_at: user.created_at,
    has_llm_api_key: Boolean(user.llm_api_key_encrypted),
    has_llm_folder_id: Boolean(user.llm_folder_id)
  };
}

router.post("/register", async (request, response) => {
  const { name, email, password, role } = request.body;
  console.log("[auth/register] payload:", sanitizeAuthPayload(request.body));

  if (!name || !email || !password || !role) {
    console.warn("[auth/register] Missing required fields");
    return response.status(400).json({ message: "Name, email, password, and role are required" });
  }

  if (!ALLOWED_ROLES.has(role)) {
    console.warn("[auth/register] Invalid role:", role);
    return response.status(400).json({ message: "Role must be student or author" });
  }

  try {
    const existingUser = await pool.query("SELECT id FROM users WHERE email = $1", [email]);

    if (existingUser.rowCount > 0) {
      console.warn("[auth/register] User already exists:", email);
      return response.status(409).json({ message: "User with this email already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, role, created_at, llm_api_key_encrypted, llm_folder_id`,
      [name, email, passwordHash, role]
    );

    const user = result.rows[0];
    const token = createToken(user);
    console.log("[auth/register] User created:", { id: user.id, email: user.email, role: user.role });

    return response.status(201).json({ token, user: toPublicUser(user) });
  } catch (error) {
    console.error("[auth/register] Failed:", error.message);
    return response.status(500).json({ message: "Registration failed", error: error.message });
  }
});

router.post("/login", async (request, response) => {
  const { email, password } = request.body;
  console.log("[auth/login] payload:", sanitizeAuthPayload(request.body));

  if (!email || !password) {
    console.warn("[auth/login] Missing email or password");
    return response.status(400).json({ message: "Email and password are required" });
  }

  try {
    const result = await pool.query(
      "SELECT id, name, email, password_hash, role, created_at, llm_api_key_encrypted, llm_folder_id FROM users WHERE email = $1",
      [email]
    );

    if (result.rowCount === 0) {
      console.warn("[auth/login] User not found:", email);
      return response.status(401).json({ message: "Invalid credentials" });
    }

    const user = result.rows[0];
    const passwordMatches = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatches) {
      console.warn("[auth/login] Password mismatch:", email);
      return response.status(401).json({ message: "Invalid credentials" });
    }

    const token = createToken(user);
    console.log("[auth/login] Success:", { id: user.id, email: user.email, role: user.role });

    return response.json({
      token,
      user: toPublicUser(user)
    });
  } catch (error) {
    console.error("[auth/login] Failed:", error.message);
    return response.status(500).json({ message: "Login failed", error: error.message });
  }
});

router.get("/me", authMiddleware, async (request, response) => {
  console.log("[auth/me] token payload:", request.user);
  try {
    const result = await pool.query(
      "SELECT id, name, email, role, created_at, llm_api_key_encrypted, llm_folder_id FROM users WHERE id = $1",
      [request.user.id]
    );

    if (result.rowCount === 0) {
      console.warn("[auth/me] User not found:", request.user.id);
      return response.status(404).json({ message: "User not found" });
    }

    console.log("[auth/me] Success:", result.rows[0].email);
    return response.json({ user: toPublicUser(result.rows[0]) });
  } catch (error) {
    console.error("[auth/me] Failed:", error.message);
    return response.status(500).json({ message: "Failed to fetch profile", error: error.message });
  }
});

router.put("/me/api-key", authMiddleware, async (request, response) => {
  const { apiKey } = request.body;

  if (!isValidUserLlmApiKey(apiKey)) {
    return response.status(400).json({ message: "API key format is invalid" });
  }

  try {
    const encryptedApiKey = encryptUserApiKey(apiKey);
    await pool.query(
      "UPDATE users SET llm_api_key_encrypted = $1 WHERE id = $2",
      [encryptedApiKey, request.user.id]
    );

    console.log("[auth/api-key] Saved user LLM API key:", { userId: request.user.id });
    return response.json({ has_llm_api_key: true });
  } catch (error) {
    console.error("[auth/api-key] Failed to save user LLM API key:", {
      userId: request.user.id,
      reason: error.message
    });
    return response.status(500).json({ message: "Failed to save API key" });
  }
});

router.delete("/me/api-key", authMiddleware, async (request, response) => {
  try {
    await pool.query(
      "UPDATE users SET llm_api_key_encrypted = NULL WHERE id = $1",
      [request.user.id]
    );

    console.log("[auth/api-key] Removed user LLM API key:", { userId: request.user.id });
    return response.json({ has_llm_api_key: false });
  } catch (error) {
    console.error("[auth/api-key] Failed to remove user LLM API key:", {
      userId: request.user.id,
      reason: error.message
    });
    return response.status(500).json({ message: "Failed to remove API key" });
  }
});

router.put("/me/folder-id", authMiddleware, async (request, response) => {
  const { folderId } = request.body;

  if (!isValidUserLlmFolderId(folderId)) {
    return response.status(400).json({ message: "Folder ID format is invalid" });
  }

  try {
    await pool.query(
      "UPDATE users SET llm_folder_id = $1 WHERE id = $2",
      [folderId.trim(), request.user.id]
    );

    console.log("[auth/folder-id] Saved user LLM folder ID:", { userId: request.user.id });
    return response.json({ has_llm_folder_id: true });
  } catch (error) {
    console.error("[auth/folder-id] Failed to save user LLM folder ID:", {
      userId: request.user.id,
      reason: error.message
    });
    return response.status(500).json({ message: "Failed to save Folder ID" });
  }
});

router.delete("/me/folder-id", authMiddleware, async (request, response) => {
  try {
    await pool.query(
      "UPDATE users SET llm_folder_id = NULL WHERE id = $1",
      [request.user.id]
    );

    console.log("[auth/folder-id] Removed user LLM folder ID:", { userId: request.user.id });
    return response.json({ has_llm_folder_id: false });
  } catch (error) {
    console.error("[auth/folder-id] Failed to remove user LLM folder ID:", {
      userId: request.user.id,
      reason: error.message
    });
    return response.status(500).json({ message: "Failed to remove Folder ID" });
  }
});

export default router;
