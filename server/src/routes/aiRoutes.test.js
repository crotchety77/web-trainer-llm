import crypto from "crypto";
import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "../app.js";
import { config } from "../config.js";
import { pool } from "../db.js";
import { encryptUserApiKey } from "../modules/userApiKey.js";

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

function mockYandexResponse() {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () =>
      Promise.resolve({
        result: {
          alternatives: [
            {
              message: {
                role: "assistant",
                text: "Reply"
              }
            }
          ]
        }
      })
  });
}

describe("ai routes user API key selection", () => {
  beforeEach(() => {
    pool.query.mockReset();
    config.userApiKeyEncryptionKey = crypto.randomBytes(32).toString("base64");
    mockYandexResponse();
  });

  it("uses decrypted user API key and user Folder ID when both are configured", async () => {
    const userApiKey = "user-yandex-api-key-1234567890";
    const folderId = "user-folder-id";
    pool.query.mockResolvedValueOnce({
      rows: [
        {
          llm_api_key_encrypted: encryptUserApiKey(userApiKey, config.userApiKeyEncryptionKey),
          llm_folder_id: folderId
        }
      ]
    });

    const response = await request(app)
      .post("/api/ai/chat")
      .set("Authorization", `Bearer ${createToken()}`)
      .send({ userInput: "Help me" });

    expect(response.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: `Api-Key ${userApiKey}`
        }),
        body: expect.stringContaining(`gpt://${folderId}/yandexgpt/latest`)
      })
    );
  });

  it("rejects chat requests when the user key is missing", async () => {
    pool.query.mockResolvedValueOnce({
      rows: [
        {
          llm_api_key_encrypted: null,
          llm_folder_id: "user-folder-id"
        }
      ]
    });

    const response = await request(app)
      .post("/api/ai/chat")
      .set("Authorization", `Bearer ${createToken()}`)
      .send({ userInput: "Help me" });

    expect(response.status).toBe(503);
    expect(response.body.message).toBe("Chat is unavailable. Add an API key and Folder ID in Dashboard.");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("rejects chat requests when the user Folder ID is missing", async () => {
    pool.query.mockResolvedValueOnce({
      rows: [
        {
          llm_api_key_encrypted: encryptUserApiKey("user-yandex-api-key-1234567890", config.userApiKeyEncryptionKey),
          llm_folder_id: null
        }
      ]
    });

    const response = await request(app)
      .post("/api/ai/chat")
      .set("Authorization", `Bearer ${createToken()}`)
      .send({ userInput: "Help me" });

    expect(response.status).toBe(503);
    expect(response.body.message).toBe("Chat is unavailable. Add an API key and Folder ID in Dashboard.");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("rejects chat requests when the user key is corrupted", async () => {
    pool.query.mockResolvedValueOnce({
      rows: [
        {
          llm_api_key_encrypted: "v1:corrupted:key:value",
          llm_folder_id: "user-folder-id"
        }
      ]
    });

    const response = await request(app)
      .post("/api/ai/chat")
      .set("Authorization", `Bearer ${createToken()}`)
      .send({ userInput: "Help me" });

    expect(response.status).toBe(503);
    expect(response.body.message).toBe("Chat is unavailable. Add an API key and Folder ID in Dashboard.");
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
