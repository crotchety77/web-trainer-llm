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
    // Сброс моков перед каждым тестом
    pool.query.mockReset();
    config.userApiKeyEncryptionKey = crypto.randomBytes(32).toString("base64");
  });

  it("INT-SEC-05: Безопасный возврат профиля с маскированием шифротекста ключа", async () => {
    // 1. Имитируем получение данных пользователя из базы данных
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

    // 2. Отправляем авторизованный HTTP GET запрос профиля
    const response = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${createToken()}`);

    // 3. Проверяем HTTP статус и структуру ответа (секретные поля удалены, возвращаются только булевы флаги)
    expect(response.status).toBe(200);
    expect(response.body.user.has_llm_api_key).toBe(true);
    expect(response.body.user.has_llm_folder_id).toBe(true);
    expect(response.body.user).not.toHaveProperty("llm_api_key_encrypted");
    expect(response.body.user).not.toHaveProperty("llm_folder_id");
  });

  it("INT-SEC-02: Отклонение некорректной длины API-ключа", async () => {
    // 1. Отправляем HTTP PUT запрос с коротким некорректным ключом
    const response = await request(app)
      .put("/api/auth/me/api-key")
      .set("Authorization", `Bearer ${createToken()}`)
      .send({ apiKey: "too short" });

    // 2. Проверяем статус 400 и отсутствие вызовов к базе данных
    expect(response.status).toBe(400);
    expect(pool.query).not.toHaveBeenCalled();
  });

  it("INT-SEC-01: Успешное сохранение зашифрованного API-ключа в БД", async () => {
    // 1. Мокаем успешный UPDATE запрос в БД
    pool.query.mockResolvedValueOnce({ rowCount: 1, rows: [] });

    // 2. Отправляем корректный API-ключ в запросе
    const rawApiKey = "yandex-api-key-1234567890";
    const response = await request(app)
      .put("/api/auth/me/api-key")
      .set("Authorization", `Bearer ${createToken()}`)
      .send({ apiKey: rawApiKey });

    // 3. Проверяем успешный HTTP статус и сохранение зашифрованных данных без утечки исходного ключа
    expect(response.status).toBe(200);
    expect(response.body.has_llm_api_key).toBe(true);
    expect(pool.query).toHaveBeenCalledWith(
      "UPDATE users SET llm_api_key_encrypted = $1 WHERE id = $2",
      [expect.not.stringContaining(rawApiKey), 7]
    );
  });

  it("INT-SEC-03: Успешное удаление API-ключа из БД", async () => {
    // 1. Имитируем очистку записи в БД
    pool.query.mockResolvedValueOnce({ rowCount: 1, rows: [] });

    // 2. Вызываем эндпоинт DELETE для API-ключа
    const response = await request(app)
      .delete("/api/auth/me/api-key")
      .set("Authorization", `Bearer ${createToken()}`);

    // 3. Убеждаемся, что статус 200 и в БД записывается NULL
    expect(response.status).toBe(200);
    expect(response.body.has_llm_api_key).toBe(false);
    expect(pool.query).toHaveBeenCalledWith(
      "UPDATE users SET llm_api_key_encrypted = NULL WHERE id = $1",
      [7]
    );
  });

  it("INT-SEC-04: Отклонение запроса на получение профиля без JWT-токена", async () => {
    // 1. Отправляем HTTP GET запрос профиля без заголовка Authorization
    const response = await request(app)
      .get("/api/auth/me");

    // 2. Проверяем блокировку доступа на уровне middleware (HTTP 401)
    expect(response.status).toBe(401);
    expect(pool.query).not.toHaveBeenCalled();
  });

  it("INT-SEC-06: Отклонение некорректного значения Folder ID", async () => {
    const response = await request(app)
      .put("/api/auth/me/folder-id")
      .set("Authorization", `Bearer ${createToken()}`)
      .send({ folderId: "bad folder id" });

    expect(response.status).toBe(400);
    expect(pool.query).not.toHaveBeenCalled();
  });

  it("INT-SEC-07: Успешное сохранение Folder ID в БД", async () => {
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

  it("INT-SEC-08: Успешное удаление Folder ID из БД", async () => {
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
