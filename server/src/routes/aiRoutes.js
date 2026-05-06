import { Router } from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { generateChatResponse, getAiStatus } from "../modules/ai.js";
import { SYSTEM_PROMPTS } from "./templatesAi.js";

const router = Router();

router.post("/chat", authMiddleware, async (request, response) => {
  const { messages, mode } = request.body;
  const userRole = request.user?.role;

  if (!Array.isArray(messages) || messages.length === 0) {
    return response.status(400).json({ message: "Messages array is required" });
  }

  if (!getAiStatus().enabled) {
    return response.status(503).json({ message: "AI module is currently unavailable" });
  }

  try {
    let finalMessages = [...messages];
    const selectedMode = mode || "default";

    // Если клиент передал специальный режим и он доступен для текущей роли,
    // добавляем системный промпт нулевым сообщением.
    if (userRole && SYSTEM_PROMPTS[userRole]?.[selectedMode]) {
      finalMessages.unshift({
        role: "system",
        text: SYSTEM_PROMPTS[userRole][selectedMode] // Замените ключ text/content на тот, который использует ваша обертка Yandex GPT
      });
    }

    // Логируем в терминал IDE всё, что уходит к нейросети
    console.log("\n=== [ai/chat] ОТПРАВКА ДАННЫХ В YANDEX GPT ===");
    console.log(JSON.stringify(finalMessages, null, 2));
    console.log("===============================================\n");

    // Отправляем массив сообщений в Yandex GPT
    const replyMessage = await generateChatResponse(finalMessages);
    return response.json({ message: replyMessage });
  } catch (error) {
    console.error("[ai/chat] Failed:", error.message);
    return response.status(500).json({ message: "Failed to generate AI response", error: error.message });
  }
});

export default router;