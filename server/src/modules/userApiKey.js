import crypto from "crypto";
import { config } from "../config.js";

const ALGORITHM = "aes-256-gcm";
const FORMAT_VERSION = "v1";
const IV_LENGTH = 12;
const REQUIRED_KEY_BYTES = 32;

export function isValidUserLlmApiKey(value) {
  if (typeof value !== "string") {
    return false;
  }

  const trimmed = value.trim();
  return trimmed.length >= 20 && trimmed.length <= 300 && !/\s/.test(trimmed);
}

export function isValidUserLlmFolderId(value) {
  if (typeof value !== "string") {
    return false;
  }

  const trimmed = value.trim();
  return trimmed.length >= 6 && trimmed.length <= 128 && /^[A-Za-z0-9_-]+$/.test(trimmed);
}

function getEncryptionKey(encryptionKey = config.userApiKeyEncryptionKey) {
  if (!encryptionKey || typeof encryptionKey !== "string") {
    throw new Error("USER_API_KEY_ENCRYPTION_KEY is not configured");
  }

  const key = Buffer.from(encryptionKey, "base64");

  if (key.length !== REQUIRED_KEY_BYTES) {
    throw new Error("USER_API_KEY_ENCRYPTION_KEY must be a base64-encoded 32-byte key");
  }

  return key;
}

export function encryptUserApiKey(rawApiKey, encryptionKey) {
  const apiKey = rawApiKey.trim();
  const key = getEncryptionKey(encryptionKey);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(apiKey, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    FORMAT_VERSION,
    iv.toString("base64"),
    authTag.toString("base64"),
    ciphertext.toString("base64")
  ].join(":");
}

export function decryptUserApiKey(encryptedApiKey, encryptionKey) {
  if (!encryptedApiKey || typeof encryptedApiKey !== "string") {
    throw new Error("Encrypted API key is missing");
  }

  const [version, ivBase64, authTagBase64, ciphertextBase64] = encryptedApiKey.split(":");

  if (version !== FORMAT_VERSION || !ivBase64 || !authTagBase64 || !ciphertextBase64) {
    throw new Error("Encrypted API key has an invalid format");
  }

  const key = getEncryptionKey(encryptionKey);
  const iv = Buffer.from(ivBase64, "base64");
  const authTag = Buffer.from(authTagBase64, "base64");
  const ciphertext = Buffer.from(ciphertextBase64, "base64");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
