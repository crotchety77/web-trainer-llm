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
    // Сброс моков перед каждым тестом
    pool.query.mockReset();
    config.userApiKeyEncryptionKey = crypto.randomBytes(32).toString("base64");
    // Мокируем стандартный успешный ответ внешнего сервиса YandexGPT
    mockYandexResponse();
  });

  it("INT-LLM-01: Сквозной запрос к ИИ-тьютору с расшифровкой ключа из БД", async () => {
    const userApiKey = "user-yandex-api-key-1234567890";
    const folderId = "user-folder-id";
    
    // 1. Имитируем наличие у пользователя зашифрованного ключа и Folder ID в базе данных
    pool.query.mockResolvedValueOnce({
      rows: [
        {
          llm_api_key_encrypted: encryptUserApiKey(userApiKey, config.userApiKeyEncryptionKey),
          llm_folder_id: folderId
        }
      ]
    });

    // 2. Отправляем HTTP POST запрос сообщения к ИИ-ассистенту
    const response = await request(app)
      .post("/api/ai/chat")
      .set("Authorization", `Bearer ${createToken()}`)
      .send({ userInput: "Help me" });

    // 3. Проверяем HTTP статус 200 и то, что fetch был вызван с корректно расшифрованным ключом
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

  it("INT-LLM-02 (А): Блокировка чата при отсутствии API-ключа в профиле", async () => {
    // 1. Имитируем отсутствие API-ключа в базе данных (null)
    pool.query.mockResolvedValueOnce({
      rows: [
        {
          llm_api_key_encrypted: null,
          llm_folder_id: "user-folder-id"
        }
      ]
    });

    // 2. Выполняем HTTP-запрос к чату ИИ
    const response = await request(app)
      .post("/api/ai/chat")
      .set("Authorization", `Bearer ${createToken()}`)
      .send({ userInput: "Help me" });

    // 3. Проверяем статус 503 (сервис недоступен) и блокировку сетевого запроса к ИИ
    expect(response.status).toBe(503);
    expect(response.body.message).toBe("Chat is unavailable. Add an API key and Folder ID in Dashboard.");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("INT-LLM-02 (Б): Блокировка чата при отсутствии Folder ID в профиле", async () => {
    // 1. Имитируем отсутствие Folder ID в базе данных (null)
    pool.query.mockResolvedValueOnce({
      rows: [
        {
          llm_api_key_encrypted: encryptUserApiKey("user-yandex-api-key-1234567890", config.userApiKeyEncryptionKey),
          llm_folder_id: null
        }
      ]
    });

    // 2. Отправляем HTTP-запрос к чату ИИ
    const response = await request(app)
      .post("/api/ai/chat")
      .set("Authorization", `Bearer ${createToken()}`)
      .send({ userInput: "Help me" });

    // 3. Проверяем статус 503 и отсутствие внешних вызовов
    expect(response.status).toBe(503);
    expect(response.body.message).toBe("Chat is unavailable. Add an API key and Folder ID in Dashboard.");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("INT-LLM-03: Обработка сбоев при наличии поврежденного шифротекста в БД", async () => {
    // 1. Имитируем поврежденный шифротекст ключа в базе данных
    pool.query.mockResolvedValueOnce({
      rows: [
        {
          llm_api_key_encrypted: "v1:corrupted:key:value",
          llm_folder_id: "user-folder-id"
        }
      ]
    });

    // 2. Отправляем HTTP-запрос к чату ИИ
    const response = await request(app)
      .post("/api/ai/chat")
      .set("Authorization", `Bearer ${createToken()}`)
      .send({ userInput: "Help me" });

    // 3. Проверяем, что сервер безопасно отдал ошибку 503 и не упал от исключения дешифрования
    expect(response.status).toBe(503);
    expect(response.body.message).toBe("Chat is unavailable. Add an API key and Folder ID in Dashboard.");
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
