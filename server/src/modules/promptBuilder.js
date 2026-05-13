import { SYSTEM_PROMPTS } from "../routes/templatesAi.js";


/**
 * Очищает историю сообщений от любых системных промптов клиента и скрытых инструкций.
 * Гарантирует, что история содержит только роли 'user' и 'assistant'.
 * Защищает от Prompt Injection через манипуляции с историей на клиенте.
 */
export function normalizeMessages(history) {
  if (!Array.isArray(history)) return [];
  
  const MAX_HISTORY = 10;
  
  return history
    .filter(msg => msg && (msg.role === "user" || msg.role === "assistant") && typeof msg.text === "string")
    .slice(-MAX_HISTORY)
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

function hasValue(value) {
  return value !== null && value !== undefined && value !== "";
}

function appendField(lines, label, value) {
  if (hasValue(value)) {
    lines.push(`${label}: ${value}`);
  }
}

function appendBlock(lines, label, value, language = "") {
  if (!hasValue(value)) return;

  lines.push("");
  lines.push(`${label}:`);
  if (language) {
    lines.push(`\`\`\`${language}`);
    lines.push(String(value));
    lines.push("```");
  } else {
    lines.push(String(value));
  }
}

function serializeFailedTests(failedTests) {
  if (!Array.isArray(failedTests) || failedTests.length === 0) return "";

  return failedTests
    .map((test, index) => {
      const lines = [`- Test ${test.testNumber || index + 1}${test.isHidden ? " (hidden)" : ""}`];
      appendField(lines, "  input", test.input);
      appendField(lines, "  expected", test.expected);
      appendField(lines, "  actual", test.actual);
      appendField(lines, "  exitCode", test.exitCode);
      return lines.join("\n");
    })
    .join("\n");
}

export function serializeStepsContext(stepsContext) {
  const steps = Array.isArray(stepsContext) ? stepsContext : [stepsContext];

  return steps
    .filter(Boolean)
    .map((step) => {
      const lines = [`=== STEP ${step.stepNumber || "?"} ===`];

      appendField(lines, "Block ID", step.blockId);
      appendField(lines, "Title", step.title);
      appendField(lines, "Type", step.type);
      appendField(lines, "Language", step.language);

      appendBlock(lines, "Task", step.task);
      appendBlock(lines, "Student code", step.studentCode, step.language || "");
      appendField(lines, "Submission status", step.submissionStatus);
      appendField(lines, "Submission message", step.submissionMessage);
      appendBlock(lines, "stdout", step.stdout);
      appendBlock(lines, "stderr", step.stderr);

      const failedTests = serializeFailedTests(step.failedTests);
      appendBlock(lines, "Failed tests", failedTests);
      appendField(lines, "Execution time", step.executionTime);

      return lines.join("\n");
    })
    .join("\n\n");
}

/**
 * Собирает итоговый массив сообщений для LLM.
 * Правила:
 * 1. СТРОГО ОДНО системное сообщение в самом начале (Source of Truth).
 * 2. Контекст урока подаётся как сообщение от пользователя (снижает вес по сравнению с system).
 * 3. Добавляется нормализованная история и текущий запрос.
 */
export function buildPrompt({ userRole, mode, lessonContext, stepsContext, chatHistory, userInput }) {
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

  const serializedStepsContext = stepsContext ? serializeStepsContext(stepsContext) : "";
  if (serializedStepsContext) {
    finalMessages.push({
      role: "user",
      text: "Контекст шагов:\n\n" + serializedStepsContext
    });
  }

  finalMessages.push(...normalizedHistory);
  finalMessages.push({ role: "user", text: userInput });

  return finalMessages;
}
