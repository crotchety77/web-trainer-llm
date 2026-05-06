import { SYSTEM_PROMPTS } from "../routes/templatesAi.js";

/**
 * Очищает историю сообщений от любых системных промптов клиента и скрытых инструкций.
 * Гарантирует, что история содержит только роли 'user' и 'assistant'.
 * Защищает от Prompt Injection через манипуляции с историей на клиенте.
 */
export function normalizeMessages(history) {
  if (!Array.isArray(history)) return [];
  
  return history
    .filter(msg => msg && (msg.role === "user" || msg.role === "assistant") && typeof msg.text === "string")
    .map(msg => ({
      role: msg.role,
      text: msg.text // Копируем только текст, отсекая любые неожиданные свойства объекта
    }));
}

/**
 * Безопасно выбирает системный промпт на основе роли пользователя и режима.
 * Защищает от подмены режима: при любом неизвестном значении используется 'default'.
 */
export function selectSystemPrompt(userRole, mode) {
  const rolePrompts = SYSTEM_PROMPTS[userRole] || SYSTEM_PROMPTS["student"];
  const selectedMode = mode || "default";
  
  return rolePrompts[selectedMode] || rolePrompts["default"];
}

/**
 * Собирает итоговый массив сообщений для LLM.
 * Правила:
 * 1. СТРОГО ОДНО системное сообщение в самом начале (Source of Truth).
 * 2. Контекст урока подаётся как сообщение от пользователя (снижает вес по сравнению с system).
 * 3. Добавляется нормализованная история и текущий запрос.
 */
export function buildPrompt({ userRole, mode, lessonContext, chatHistory, userInput }) {
  const systemPrompt = selectSystemPrompt(userRole, mode);
  const normalizedHistory = normalizeMessages(chatHistory);
  
  // Формируем полностью новый массив, не мутируя входные данные
  const finalMessages = [
    { role: "system", text: systemPrompt }
  ];

  if (lessonContext) {
    finalMessages.push({
      role: "user",
      text: `Контекст урока:\n${lessonContext}`
    });
  }

  finalMessages.push(...normalizedHistory);
  finalMessages.push({ role: "user", text: userInput });

  return finalMessages;
}