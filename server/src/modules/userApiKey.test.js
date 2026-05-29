import crypto from "crypto";
import { describe, expect, it } from "vitest";
import {
  decryptUserApiKey,
  encryptUserApiKey,
  isValidUserLlmApiKey,
  isValidUserLlmFolderId
} from "./userApiKey.js";

// Генерация валидного 32-байтного ключа шифрования (аналог переменной окружения USER_API_KEY_ENCRYPTION_KEY)
const encryptionKey = crypto.randomBytes(32).toString("base64");

describe("userApiKey module", () => {
  // --- Шифрование / расшифровка ---

  it("EK-01: шифрует и расшифровывает API-ключ без потери данных", () => {
    const rawApiKey = "yandex-api-key-1234567890";
    const encryptedApiKey = encryptUserApiKey(rawApiKey, encryptionKey);

    // Зашифрованное значение начинается с версии формата "v1:"
    expect(encryptedApiKey).not.toBe(rawApiKey);
    expect(encryptedApiKey).toMatch(/^v1:/);
    expect(decryptUserApiKey(encryptedApiKey, encryptionKey)).toBe(rawApiKey);
  });

  it("EK-05: отклоняет повреждённый ciphertext (проверка целостности GCM authTag)", () => {
    const encryptedApiKey = encryptUserApiKey("yandex-api-key-1234567890", encryptionKey);
    // Повреждаем последние 4 символа — имитация подмены зашифрованных данных
    const corruptedApiKey = `${encryptedApiKey.slice(0, -4)}abcd`;

    expect(() => decryptUserApiKey(corruptedApiKey, encryptionKey)).toThrow();
  });

  it("EK-02: отклоняет некорректный ключ шифрования (не 32 байта)", () => {
    // Ключ "bad-key" после декодирования из base64 не даст 32 байта
    expect(() => encryptUserApiKey("yandex-api-key-1234567890", "bad-key")).toThrow(
      /32-byte/
    );
  });

  it("EK-10: генерирует разные ciphertext при повторном шифровании (случайный IV)", () => {
    const rawApiKey = "yandex-api-key-1234567890";
    const encrypted1 = encryptUserApiKey(rawApiKey, encryptionKey);
    const encrypted2 = encryptUserApiKey(rawApiKey, encryptionKey);

    // Два шифрования одного ключа дают разные результаты благодаря случайному 12-байтному IV
    expect(encrypted1).not.toBe(encrypted2);
    // Оба корректно расшифровываются в исходное значение
    expect(decryptUserApiKey(encrypted1, encryptionKey)).toBe(rawApiKey);
    expect(decryptUserApiKey(encrypted2, encryptionKey)).toBe(rawApiKey);
  });

  // --- Валидация API-ключа пользователя (Таблица П.1) ---

  it("VK-01: Проверка корректной длины API-ключа", () => {
    expect(isValidUserLlmApiKey("yandex-api-key-1234567890")).toBe(true);
  });

  it("VK-02: Проверка минимальной допустимой длины", () => {
    expect(isValidUserLlmApiKey("a".repeat(20))).toBe(true);
  });

  it("VK-03: Проверка выхода за нижнюю границу длины", () => {
    expect(isValidUserLlmApiKey("a".repeat(19))).toBe(false);
  });

  it("VK-04: Проверка максимальной допустимой длины", () => {
    expect(isValidUserLlmApiKey("a".repeat(300))).toBe(true);
  });

  it("VK-05: Проверка выхода за верхнюю границу длины", () => {
    expect(isValidUserLlmApiKey("a".repeat(301))).toBe(false);
  });

  it("VK-06: Проверка отсутствия пробелов", () => {
    expect(isValidUserLlmApiKey("yandex api key 1234567890")).toBe(false);
  });

  it("VK-07: Проверка обработки некорректных типов данных", () => {
    expect(isValidUserLlmApiKey("")).toBe(false);
    expect(isValidUserLlmApiKey(null)).toBe(false);
    expect(isValidUserLlmApiKey(undefined)).toBe(false);
  });

  it("VK-08: Проверка обработки пробельных символов по краям", () => {
    expect(isValidUserLlmApiKey("   yandex-api-key-1234567890   ")).toBe(true);
  });

  // --- Валидация ID каталога платформы (Таблица П.2) ---

  it("FI-01: Проверка соответствия белому списку символов", () => {
    expect(isValidUserLlmFolderId("my-folder_123")).toBe(true);
  });

  it("FI-02: Проверка минимальной допустимой длины", () => {
    expect(isValidUserLlmFolderId("fld_01")).toBe(true);
  });

  it("FI-03: Проверка выхода за нижнюю границу длины", () => {
    expect(isValidUserLlmFolderId("fld_1")).toBe(false);
  });

  it("FI-04: Проверка максимальной допустимой длины", () => {
    expect(isValidUserLlmFolderId("a".repeat(128))).toBe(true);
  });

  it("FI-05: Проверка обработки недопустимых символов", () => {
    expect(isValidUserLlmFolderId("my_folder@!#")).toBe(false);
  });

  it("FI-06: Проверка обработки некорректных типов данных", () => {
    expect(isValidUserLlmFolderId(null)).toBe(false);
  });
});
