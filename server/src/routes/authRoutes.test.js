import crypto from "crypto";
import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "../app.js";
import { config } from "../config.js";
import { pool } from "../db.js";

vi.mock("../db.js", () => ({
  pool: {
    query: vi.fn()
  }
}));

function createToken(payload = {}) {
  return jwt.sign(
    {
      id: 7,
      email: "student@example.com",
      role: "student",
      ...payload
    },
    config.jwtSecret,
    { expiresIn: "1h" }
  );
}

describe("auth API key routes", () => {
  beforeEach(() => {
    pool.query.mockReset();
    config.userApiKeyEncryptionKey = crypto.randomBytes(32).toString("base64");
  });

  it("returns only API key presence in profile responses", async () => {
    pool.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [
        {
          id: 7,
          name: "Student",
          email: "student@example.com",
          role: "student",
          created_at: "2026-05-11T00:00:00.000Z",
          llm_api_key_encrypted: "v1:hidden",
          llm_folder_id: "folder-id"
        }
      ]
    });

    const response = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${createToken()}`);

    expect(response.status).toBe(200);
    expect(response.body.user.has_llm_api_key).toBe(true);
    expect(response.body.user.has_llm_folder_id).toBe(true);
    expect(response.body.user).not.toHaveProperty("llm_api_key_encrypted");
    expect(response.body.user).not.toHaveProperty("llm_folder_id");
  });

  it("rejects invalid API key values", async () => {
    const response = await request(app)
      .put("/api/auth/me/api-key")
      .set("Authorization", `Bearer ${createToken()}`)
      .send({ apiKey: "too short" });

    expect(response.status).toBe(400);
    expect(pool.query).not.toHaveBeenCalled();
  });

  it("saves encrypted API keys without persisting the raw value", async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1, rows: [] });

    const rawApiKey = "yandex-api-key-1234567890";
    const response = await request(app)
      .put("/api/auth/me/api-key")
      .set("Authorization", `Bearer ${createToken()}`)
      .send({ apiKey: rawApiKey });

    expect(response.status).toBe(200);
    expect(response.body.has_llm_api_key).toBe(true);
    expect(pool.query).toHaveBeenCalledWith(
      "UPDATE users SET llm_api_key_encrypted = $1 WHERE id = $2",
      [expect.not.stringContaining(rawApiKey), 7]
    );
  });

  it("clears saved API keys", async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1, rows: [] });

    const response = await request(app)
      .delete("/api/auth/me/api-key")
      .set("Authorization", `Bearer ${createToken()}`);

    expect(response.status).toBe(200);
    expect(response.body.has_llm_api_key).toBe(false);
    expect(pool.query).toHaveBeenCalledWith(
      "UPDATE users SET llm_api_key_encrypted = NULL WHERE id = $1",
      [7]
    );
  });

  it("rejects invalid Folder ID values", async () => {
    const response = await request(app)
      .put("/api/auth/me/folder-id")
      .set("Authorization", `Bearer ${createToken()}`)
      .send({ folderId: "bad folder id" });

    expect(response.status).toBe(400);
    expect(pool.query).not.toHaveBeenCalled();
  });

  it("saves Folder IDs", async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1, rows: [] });

    const response = await request(app)
      .put("/api/auth/me/folder-id")
      .set("Authorization", `Bearer ${createToken()}`)
      .send({ folderId: "folder-id_123" });

    expect(response.status).toBe(200);
    expect(response.body.has_llm_folder_id).toBe(true);
    expect(pool.query).toHaveBeenCalledWith(
      "UPDATE users SET llm_folder_id = $1 WHERE id = $2",
      ["folder-id_123", 7]
    );
  });

  it("clears saved Folder IDs", async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1, rows: [] });

    const response = await request(app)
      .delete("/api/auth/me/folder-id")
      .set("Authorization", `Bearer ${createToken()}`);

    expect(response.status).toBe(200);
    expect(response.body.has_llm_folder_id).toBe(false);
    expect(pool.query).toHaveBeenCalledWith(
      "UPDATE users SET llm_folder_id = NULL WHERE id = $1",
      [7]
    );
  });
});
