import { Router } from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { generateChatResponse, getAiStatus } from "../modules/ai.js";

const router = Router();

router.post("/chat", authMiddleware, async (request, response) => {
  const { messages } = request.body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return response.status(400).json({ message: "Messages array is required" });
  }

  if (!getAiStatus().enabled) {
    return response.status(503).json({ message: "AI module is currently unavailable" });
  }

  try {
    // Отправляем массив сообщений в Yandex GPT
    const replyMessage = await generateChatResponse(messages);
    return response.json({ message: replyMessage });
  } catch (error) {
    console.error("[ai/chat] Failed:", error.message);
    return response.status(500).json({ message: "Failed to generate AI response", error: error.message });
  }
});

export default router;