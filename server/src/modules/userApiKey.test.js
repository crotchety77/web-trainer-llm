import crypto from "crypto";
import { describe, expect, it } from "vitest";
import {
  decryptUserApiKey,
  encryptUserApiKey,
  isValidUserLlmApiKey
} from "./userApiKey.js";

const encryptionKey = crypto.randomBytes(32).toString("base64");

describe("userApiKey module", () => {
  it("encrypts and decrypts API keys", () => {
    const rawApiKey = "yandex-api-key-1234567890";
    const encryptedApiKey = encryptUserApiKey(rawApiKey, encryptionKey);

    expect(encryptedApiKey).not.toBe(rawApiKey);
    expect(encryptedApiKey).toMatch(/^v1:/);
    expect(decryptUserApiKey(encryptedApiKey, encryptionKey)).toBe(rawApiKey);
  });

  it("rejects corrupted encrypted values", () => {
    const encryptedApiKey = encryptUserApiKey("yandex-api-key-1234567890", encryptionKey);
    const corruptedApiKey = `${encryptedApiKey.slice(0, -4)}abcd`;

    expect(() => decryptUserApiKey(corruptedApiKey, encryptionKey)).toThrow();
  });

  it("rejects invalid encryption keys", () => {
    expect(() => encryptUserApiKey("yandex-api-key-1234567890", "bad-key")).toThrow(
      /32-byte/
    );
  });

  it("validates user-facing API key format", () => {
    expect(isValidUserLlmApiKey("yandex-api-key-1234567890")).toBe(true);
    expect(isValidUserLlmApiKey("short")).toBe(false);
    expect(isValidUserLlmApiKey("yandex api key 1234567890")).toBe(false);
    expect(isValidUserLlmApiKey("a".repeat(301))).toBe(false);
  });
});
