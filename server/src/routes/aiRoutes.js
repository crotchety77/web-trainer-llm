import { Router } from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { generateChatResponse } from "../modules/ai.js";
import { buildPrompt } from "../modules/promptBuilder.js";
import { pool } from "../db.js";
import { decryptUserApiKey } from "../modules/userApiKey.js";

const router = Router();

async function resolveUserLlmSettings(userId) {
  const result = await pool.query(
    "SELECT llm_api_key_encrypted, llm_folder_id FROM users WHERE id = $1",
    [userId]
  );

  const encryptedApiKey = result.rows[0]?.llm_api_key_encrypted;
  const folderId = result.rows[0]?.llm_folder_id?.trim();

  if (!encryptedApiKey || !folderId) {
    return { apiKey: null, folderId: null };
  }

  try {
    return {
      apiKey: decryptUserApiKey(encryptedApiKey),
      folderId
    };
  } catch (error) {
    console.warn("[ai/chat] User LLM API key could not be decrypted:", {
      userId,
      reason: error.message
    });
    return { apiKey: null, folderId: null };
  }
}

router.post("/chat", authMiddleware, async (request, response) => {
  // Ожидаем сырые данные вместо готового массива
  const { userInput, lessonContext, stepsContext, chatHistory, mode } = request.body;
  const userRole = request.user?.role;

  if (!userInput || typeof userInput !== "string") {
    return response.status(400).json({ message: "User input is required" });
  }

  try {
    const { apiKey, folderId } = await resolveUserLlmSettings(request.user.id);

    if (!apiKey || !folderId) {
      return response.status(503).json({ message: "Chat is unavailable. Add an API key and Folder ID in Dashboard." });
    }

    // Сервер контролирует сборку промпта
    const finalMessages = buildPrompt({
      userRole,
      mode,
      lessonContext,
      stepsContext,
      chatHistory,
      userInput
    });

    // Логируем в терминал IDE всё, что уходит к нейросети
    console.log("\n=== [ai/chat] ОТПРАВКА ДАННЫХ В YANDEX GPT ===");
    console.log(JSON.stringify(finalMessages, null, 2));
    console.log("===============================================\n");

    // Отправляем массив сообщений в Yandex GPT
    const replyMessage = await generateChatResponse(finalMessages, { apiKey, folderId });
    return response.json({ message: replyMessage });
  } catch (error) {
    console.error("[ai/chat] Failed:", error.message);
    return response.status(500).json({ message: "Failed to generate AI response", error: error.message });
  }
});

export default router;
