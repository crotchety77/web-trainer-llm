/**
 * Модульные тесты: шифрование и валидация пользовательских API-ключей.
 *
 * Тестируемый модуль: userApiKey.js
 * Алгоритм шифрования: AES-256-GCM (аутентифицированное шифрование).
 *
 * Цель тестов — убедиться, что:
 * - API-ключи шифруются и расшифровываются без потери данных;
 * - повреждённые или подделанные зашифрованные значения отклоняются (целостность GCM);
 * - некорректные ключи окружения вызывают предсказуемые ошибки;
 * - каждое шифрование генерирует уникальный IV (защита от повторного использования nonce);
 * - валидация формата ключа отсекает слишком короткие, длинные и содержащие пробелы значения.
 */
import crypto from "crypto";
import { describe, expect, it } from "vitest";
import {
  decryptUserApiKey,
  encryptUserApiKey,
  isValidUserLlmApiKey
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

  // --- Валидация формата API-ключа (граничные значения: 20–300 символов, без пробелов) ---

  it("VK: валидация формата пользовательского API-ключа", () => {
    expect(isValidUserLlmApiKey("yandex-api-key-1234567890")).toBe(true);   // 25 символов — норма
    expect(isValidUserLlmApiKey("short")).toBe(false);                      // < 20 символов
    expect(isValidUserLlmApiKey("yandex api key 1234567890")).toBe(false);  // содержит пробелы
    expect(isValidUserLlmApiKey("a".repeat(301))).toBe(false);             // > 300 символов
  });
});
