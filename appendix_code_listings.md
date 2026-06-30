# Приложение Б. Листинг исходного кода ключевых модулей системы

В данном приложении приведён исходный код основных модулей разработанной интерактивной образовательной веб-платформы. 

**Рекомендации по форматированию для дипломной работы:**
*   **Шрифт:** Consolas (или Courier New).
*   **Размер шрифта:** 10 пт.
*   **Межстрочный интервал:** Одинарный (1.0).
*   **Стиль:** Выравнивание по левому краю, без переноса слов, отступ абзаца 0 см.
*   *Данный объем (около 1100 строк кода) с учетом заголовков займет примерно 20–22 страницы А4.*

---

## 1. СЕРВЕРНАЯ ЧАСТЬ (БЭКЕНД)

### 1.1. Интеграция с Docker-песочницей Piston API (`server/src/modules/pistonExecutor.js`)
Этот модуль отвечает за подключение к API Piston, проверку установленных компиляторов, генерацию оберток ввода-вывода (stdin/stdout) для JavaScript/Python и проверку пользовательского кода на тест-кейсах.

```javascript
import axios from "axios";

const REQUIRED_LANGUAGES = [
  { language: "node", version: "*" },
  { language: "python", version: "3.10.0" }
];

export async function initializePistonLanguages(retries = 5) {
  if (retries === 5) console.log("[piston] Проверка установленных языков программирования...");
  try {
    const pistonUrl = process.env.PISTON_URL || "http://127.0.0.1:2000";

    const response = await axios.get(`${pistonUrl}/api/v2/packages`);
    const installedPackages = response.data.filter(pkg => pkg.installed);
    const installedLangs = installedPackages.map(pkg => pkg.language);
    let missingPackagesCount = 0;

    for (const reqPkg of REQUIRED_LANGUAGES) {
      if (!installedLangs.includes(reqPkg.language)) {
        missingPackagesCount++;
        console.log(`[piston] Язык ${reqPkg.language} не установлен. Начинаю фоновую установку...`);

        axios.post(`${pistonUrl}/api/v2/packages`, reqPkg)
          .then(() => console.log(`[piston] ✅ Язык ${reqPkg.language} успешно установлен!`))
          .catch(err => console.error(`[piston] ❌ Ошибка установки ${reqPkg.language}:`, err.response?.data?.message || err.message));
      } else {
        if (retries === 5) console.log(`[piston] Язык ${reqPkg.language} уже установлен.`);
      }
    }

    if (missingPackagesCount === 0) {
      console.log("[piston] Проверка языка завершена: все необходимые языки доступны.");
    }
  } catch (error) {
    if (retries > 0) {
      console.log(`[piston] Piston еще загружается (${error.message}). Повторная попытка через 3 секунды...`);
      setTimeout(() => initializePistonLanguages(retries - 1), 3000);
    } else {
      console.error("[piston] Не удалось проверить пакеты после нескольких попыток. Piston оффлайн?", error.message);
    }
  }
}

export async function executeCodeOnPiston(code, language, testCases, functionName) {
  try {
    await axios.get(`${process.env.PISTON_URL || "http://127.0.0.1:2000"}/api/v2/runtimes`, { timeout: 1500 });
  } catch (error) {
    console.error("[piston] Health check failed:", error.message);
    return {
      status: "error",
      result_message: "🚫 Сервис автоматической проверки кода временно недоступен (Docker offline). Попробуйте позже.",
      tests_result: { total: 0, passed: 0, failed: 0, details: [] }
    };
  }

  if (!testCases || testCases.length === 0) {
    return {
      status: "accepted",
      result_message: "Code passed. No tests configured.",
      tests_result: { total: 0, passed: 0, failed: 0, details: [] }
    };
  }

  const results = [];
  let passedCount = 0;
  let failedCount = 0;

  for (const testCase of testCases) {
    try {
      let executionCode = code;

      if (functionName && functionName.trim()) {
        const fnName = functionName.trim();
        if (language === "javascript" || language === "js") {
          executionCode = `${code}

// --- Автоматически сгенерированная обертка ---
const fs = require('fs');
const rawInput = fs.readFileSync(0, 'utf-8').trim();
let args = [];
if (rawInput) {
  const lines = rawInput.split('\\n').map(line => line.trim()).filter(Boolean);
  for (const line of lines) {
    try {
      args.push(JSON.parse(line));
    } catch (e) {
      if (line.includes(' ')) {
        const tokens = line.split(/\\s+/).filter(Boolean);
        for (const token of tokens) {
          try {
            args.push(JSON.parse(token));
          } catch (err) {
            args.push(isNaN(Number(token)) ? token : Number(token));
          }
        }
      } else {
        args.push(isNaN(Number(line)) ? line : Number(line));
      }
    }
  }
}
const result = eval(\`${fnName}(...args)\`);
if (result !== undefined) {
  if (typeof result === 'object' && result !== null) {
    console.log(JSON.stringify(result));
  } else {
    console.log(result);
  }
}
`;
        } else if (language === "python" || language === "py") {
          executionCode = `${code}

# --- Автоматически сгенерированная обертка ---
import sys, json
raw_input = sys.stdin.read().strip()
args = []
if raw_input:
    lines = [line.strip() for line in raw_input.split('\\n') if line.strip()]
    for line in lines:
        try:
            args.append(json.loads(line))
        except Exception:
            if ' ' in line:
                for token in line.split():
                    try:
                        args.append(json.loads(token))
                    except Exception:
                        try:
                            args.append(float(token) if '.' in token else int(token))
                        except ValueError:
                            args.append(token)
            else:
                try:
                    args.append(float(line) if '.' in line else int(line))
                except ValueError:
                    args.append(line)
result = eval("${fnName}(*args)")
if result is not None:
    if isinstance(result, (dict, list)):
        print(json.dumps(result, ensure_ascii=False, separators=(',', ':')))
    else:
        print(result)
`;
        }
      }

      const stdinStr = Array.isArray(testCase.input)
        ? testCase.input.join("\n")
        : String(testCase.input ?? "");

      const response = await axios.post(`${process.env.PISTON_URL || "http://127.0.0.1:2000"}/api/v2/execute`, {
        language: language || "javascript",
        version: "*",
        files: [{ content: executionCode }],
        stdin: stdinStr
      });

      const run = response.data.run;
      const actualOutput = (run.stdout || "").trim();
      const expectedOutput = String(testCase.expected_output ?? "").trim();
      const passed = run.code === 0 && actualOutput === expectedOutput;

      if (passed) {
        passedCount++;
      } else {
        failedCount++;
      }

      let finalActualOutput = actualOutput;
      if (run.code !== 0 && run.stderr) {
        const stderrStr = run.stderr.trim();
        let errorMessage = "⚠️ Ошибка выполнения (Runtime Error/Syntax Error)";

        if (language === "javascript" || language === "js") {
          const errorMatch = stderrStr.match(/([a-zA-Z]+Error:.*)/);
          if (errorMatch) errorMessage = `⚠️ ${errorMatch[1]}`;
        } else if (language === "python" || language === "py") {
          const lines = stderrStr.split('\n');
          const lastLine = lines[lines.length - 1];
          if (lastLine && lastLine.includes("Error:")) errorMessage = `⚠️ ${lastLine}`;
        }

        finalActualOutput = errorMessage + "\n(Полный вывод ошибки скрыт платформой)";
      }

      results.push({
        input: testCase.input,
        expected: expectedOutput,
        actual: finalActualOutput,
        passed: passed,
        is_hidden: !!testCase.is_hidden,
        exit_code: run.code,
        raw_stdout: run.stdout || "",
        raw_stderr: run.stderr || ""
      });
    } catch (error) {
      console.error("Piston execution error:", error.message);
      failedCount++;
      results.push({
        input: testCase.input,
        expected: testCase.expected_output,
        actual: "Execution Error: " + (error.response?.data?.message || error.message),
        passed: false,
        is_hidden: !!testCase.is_hidden,
        exit_code: 1
      });
    }
  }

  const isSuccess = failedCount === 0;

  return {
    status: isSuccess ? "passed" : "failed",
    result_message: isSuccess ? "All tests passed successfully!" : `${failedCount} out of ${testCases.length} tests failed.`,
    tests_result: {
      total: testCases.length,
      passed: passedCount,
      failed: failedCount,
      details: results
    }
  };
}
```

---

### 1.2. Конструктор ИИ-подсказок и сериализатор контекста урока (`server/src/modules/promptBuilder.js`)
Этот модуль отвечает за сборку структурированного системного и пользовательского промпта. Он извлекает метаданные лекции, код студента, лог ошибок песочницы Docker и формирует единый контекст.

```javascript
import { SYSTEM_PROMPTS } from "./templatesAi.js";

export function normalizeMessages(history) {
  if (!Array.isArray(history)) return [];
  
  const MAX_HISTORY = 10;
  
  return history
    .filter(msg => msg && (msg.role === "user" || msg.role === "assistant") && typeof msg.text === "string")
    .slice(-MAX_HISTORY)
    .map(msg => ({
      role: msg.role,
      text: msg.text
    }));
}

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

export function buildPrompt({ userRole, mode, lessonContext, stepsContext, chatHistory, userInput }) {
  const systemPrompt = selectSystemPrompt(userRole, mode);
  const normalizedHistory = normalizeMessages(chatHistory);
  
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
```

---

### 1.3. Шаблоны системных инструкций и режимов ИИ (`server/src/modules/templatesAi.js`)
В данном файле описаны когнитивные роли ИИ-ассистента для студента и автора.

```javascript
const MARKDOWN_HINT = "Всегда используй Markdown для форматирования ответов: списки, **жирный** текст, `inline code` и блоки кода.";
const AUTHOR_CLARIFY_HINT = "Если запрос слишком короткий, неясный или в нем недостаточно данных для качественного ответа — вежливо уточни у автора, что именно нужно сделать.";
const STUDENT_CLARIFY_HINT = "Если запрос студента неясен или слишком краток, не давай случайных ответов. Вместо этого вежливо уточни, что именно вызывает затруднение.";

export const SYSTEM_PROMPTS = {
  student: {
    default: `Ты умный наставник по программированию. ${MARKDOWN_HINT} ${STUDENT_CLARIFY_HINT} Помогай студенту понять материал, давай подсказки, но не пиши готовый код за него. Отвечай кратко и по делу.`,
    code_help: `Ты опытный наставник по программированию. ${MARKDOWN_HINT} ${STUDENT_CLARIFY_HINT} Помоги студенту найти ошибку в коде, но не давай сразу готовый ответ. Если в контексте шага есть syntax error или runtime error, укажи строку ошибки, объясни причину и дай подсказку.`,
    explain: `Ты терпеливый преподаватель. ${MARKDOWN_HINT} ${STUDENT_CLARIFY_HINT} Объясни концепцию максимально просто и понятно, шаг за шагом, избегая сложных терминов.`,
    example: `Приведи наглядный пример или аналогию из реальной жизни для концепции, которую запросил пользователь. ${MARKDOWN_HINT} ${STUDENT_CLARIFY_HINT}`,
    search_info: `Ты справочный помощник. Найди и изложи краткую справочную информацию по запросу пользователя. ${MARKDOWN_HINT} ${STUDENT_CLARIFY_HINT} Будь лаконичен.`
  },
  author: {
    default: `Ты умный ИИ-помощник для авторов курсов. ${MARKDOWN_HINT} ${AUTHOR_CLARIFY_HINT} Помогай составлять план уроков, пиши лекции, предлагай практические задачи.`,
    improve_text: `Ты профессиональный редактор. ${MARKDOWN_HINT} ${AUTHOR_CLARIFY_HINT} Улучши предложенный текст: исправь ошибки, упрости стиль для лучшего понимания.`,
    generate_task: `Ты методист. ${MARKDOWN_HINT} ${AUTHOR_CLARIFY_HINT} Придумай практическое задание или тестовые вопросы с вариантами ответов на основе материала.`,
    structure: `Помоги структурировать материал для создания качественного урока. ${MARKDOWN_HINT} ${AUTHOR_CLARIFY_HINT} Разбей его на логические блоки.`
  }
};
```

---

### 1.4. Интеграция с YandexGPT API (`server/src/modules/ai.js`)
Этот модуль отвечает за отправку HTTP POST-запроса к API Yandex Cloud (`Foundation Models Completion API`) с использованием персонального API-ключа и идентификатора папки пользователя.

```javascript
export function getAiStatus() {
  return {
    enabled: true,
    message: "Yandex GPT uses per-user API key and folder settings"
  };
}

export async function generateChatResponse(messages, options = {}) {
  const apiKey = options.apiKey;
  const folderId = options.folderId;

  if (!apiKey || !folderId) {
    throw new Error("Yandex GPT is not configured");
  }

  const response = await fetch("https://llm.api.cloud.yandex.net/foundationModels/v1/completion", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Api-Key ${apiKey}`
    },
    body: JSON.stringify({
      modelUri: `gpt://${folderId}/yandexgpt/latest`,
      completionOptions: {
        stream: false,
        temperature: 0.6,
        maxTokens: "1000"
      },
      messages: messages
    })
  });

  if (!response.ok) {
    await response.text().catch(() => "");
    throw new Error(`Yandex GPT API error: ${response.status}`);
  }

  const data = await response.json();
  return data.result.alternatives[0].message;
}
```

---

### 1.5. Шифрование API-ключей пользователей в базе данных (`server/src/modules/userApiKey.js`)
Для обеспечения безопасности ключей YandexGPT API, которые авторы и студенты вводят в личном кабинете, данный модуль осуществляет симметричное шифрование AES-256-GCM.

```javascript
import crypto from "crypto";
import { config } from "../config.js";

const ALGORITHM = "aes-256-gcm";
const FORMAT_VERSION = "v1";
const IV_LENGTH = 12;
const REQUIRED_KEY_BYTES = 32;

export function isValidUserLlmApiKey(value) {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  return trimmed.length >= 20 && trimmed.length <= 300 && !/\s/.test(trimmed);
}

export function isValidUserLlmFolderId(value) {
  if (typeof value !== "string") return false;
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
```

---

### 1.6. Промежуточное ПО защиты роутов и авторизации (`server/src/middleware/authMiddleware.js`)
Реализует декодирование JWT-токенов из HTTP-заголовков `Authorization: Bearer` и разграничивает права ролей на уровне системы RBAC.

```javascript
import jwt from "jsonwebtoken";
import { config } from "../config.js";

export function authMiddleware(request, response, next) {
  const header = request.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return response.status(401).json({ message: "Authorization token is required" });
  }

  const token = header.slice(7);

  try {
    request.user = jwt.verify(token, config.jwtSecret);
    return next();
  } catch {
    return response.status(401).json({ message: "Invalid or expired token" });
  }
}

export function optionalAuthMiddleware(request, response, next) {
  const header = request.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    request.user = null;
    return next();
  }

  const token = header.slice(7);

  try {
    request.user = jwt.verify(token, config.jwtSecret);
    return next();
  } catch {
    request.user = null;
    return next();
  }
}

export function requireRole(...roles) {
  return (request, response, next) => {
    if (!request.user) {
      return response.status(401).json({ message: "Authorization token is required" });
    }

    if (!roles.includes(request.user.role)) {
      return response.status(403).json({ message: "You do not have access to this action" });
    }

    return next();
  };
}
```

---

### 1.7. API-маршруты отправки кода на проверку в песочницу (`server/src/routes/codeRoutes.js`)

```javascript
import { Router } from "express";
import axios from "axios";
import { executeCodeOnPiston } from "../modules/pistonExecutor.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = Router();

router.use(authMiddleware);

router.post("/run", async (req, res) => {
  const { language, code } = req.body;

  if (!language || !code) {
    return res.status(400).json({ error: "Language and code are required." });
  }

  try {
    const response = await axios.post(`${process.env.PISTON_URL || "http://127.0.0.1:2000"}/api/v2/execute`, {
      language: language,
      version: "*",
      files: [{ content: code }]
    });

    res.json(response.data.run);
  } catch (error) {
    console.error("Code execution error:", error.response?.data || error.message);
    res.status(500).json({ error: "Ошибка выполнения кода" });
  }
});

router.post("/run-tests", async (req, res) => {
  const { language, code, test_cases, function_name } = req.body;

  if (!code) {
    return res.status(400).json({ error: "Code is required." });
  }

  try {
    const executionResult = await executeCodeOnPiston(
      code,
      language,
      test_cases || [],
      function_name
    );
    res.json(executionResult);
  } catch (error) {
    console.error("Test execution error:", error.message);
    res.status(500).json({ error: "Ошибка выполнения тестов" });
  }
});

export default router;
```

---

### 1.8. API-маршруты взаимодействия с ИИ-чат-ассистентом (`server/src/routes/aiRoutes.js`)

```javascript
import { Router } from "express";
import { authMiddleware, requireRole } from "../middleware/authMiddleware.js";
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

router.post("/chat", authMiddleware, requireRole("student", "author", "admin"), async (request, response) => {
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

    const finalMessages = buildPrompt({
      userRole,
      mode,
      lessonContext,
      stepsContext,
      chatHistory,
      userInput
    });

    console.log("\n=== [ai/chat] ОТПРАВКА ДАННЫХ В YANDEX GPT ===");
    console.log(JSON.stringify({
      interaction: "NEW",
      userId: request.user.id,
      role: userRole,
      mode: mode || "default",
      userInput,
      prompt: finalMessages
    }, null, 2));
    console.log("===============================================\n");

    const replyMessage = await generateChatResponse(finalMessages, { apiKey, folderId });
    console.log("--- AI RESPONSE ---");
    console.log(JSON.stringify(replyMessage, null, 2));
    console.log("--- END INTERACTION ---\n");

    return response.json({ message: replyMessage });
  } catch (error) {
    console.error("[ai/chat] Failed:", error.message);
    return response.status(500).json({ message: "Failed to generate AI response", error: error.message });
  }
});

export default router;
```

---

## 2. КЛИЕНТСКАЯ ЧАСТЬ (ФРОНТЕНД)

### 2.1. Сборщик ИИ-контекста шагов и уроков на фронтенде (`client/src/utils/aiContextBuilders.js`)
Этот модуль отвечает за сканирование текущего состояния React-страницы, чтение ответов студента, логов Docker-тестирования, и формирование JSON-структуры контекста шага для отправки на сервер.

```javascript
import { extractStepRefs } from "./extractStepRefs";

const CODE_BLOCK_TYPES = new Set(["practice", "test"]);

function getEditorCode(block, solutions) {
  if (solutions[block.id] !== undefined) {
    return String(solutions[block.id] || "");
  }
  return String(block.quiz_data?.placeholder_code || "");
}

function getSubmissionStatus(blockState) {
  const submission = blockState?.submission;
  if (submission?.status) return submission.status;
  if (typeof submission?.is_correct === "boolean") {
    return submission.is_correct ? "correct" : "incorrect";
  }
  if (blockState?.error) return "error";
  return null;
}

function getSubmissionMessage(blockState) {
  const submission = blockState?.submission;
  return submission?.result_message || blockState?.error || blockState?.hint || null;
}

export function getFailedTests(submission) {
  const details = submission?.tests_result?.details;
  if (!Array.isArray(details)) return [];

  return details
    .filter((test) => !test.passed)
    .map((test, index) => ({
      testNumber: index + 1,
      input: test.is_hidden ? null : test.input,
      expected: test.is_hidden ? null : test.expected,
      actual: test.is_hidden ? null : test.actual,
      exitCode: test.exit_code ?? null,
      isHidden: Boolean(test.is_hidden)
    }));
}

export function buildLessonSummaryContext(lesson, sortedBlocks) {
  if (!lesson) return "Контекст урока пока недоступен.";

  const steps = sortedBlocks.map((block, index) => {
    const summary = block.title || block.content || `Шаг ${index + 1}`;
    return `${index + 1}. ${summary}`;
  });

  return [
    `Урок: ${lesson.title}`,
    "",
    "Шаги:",
    steps.length > 0 ? steps.join("\n") : "Шаги пока не добавлены."
  ].join("\n");
}

export function buildAuthorStepsContext({ text, sortedBlocks, blockDrafts, authorTestCode }) {
  const stepRefs = extractStepRefs(text);
  if (stepRefs.length === 0) return null;

  const stepByNumber = new Map(sortedBlocks.map((block, index) => [index + 1, block]));

  const steps = stepRefs
    .map((stepNumber) => {
      const originalBlock = stepByNumber.get(stepNumber);
      if (!originalBlock) return null;

      const draft = blockDrafts[originalBlock.id] || originalBlock;
      const isCodeBlock = CODE_BLOCK_TYPES.has(draft.type);

      let taskContent = draft.content || "";
      
      if (draft.type === "test" && draft.quiz_data) {
        const options = (draft.quiz_data.options || [])
          .map((opt, i) => `${i + 1}. ${opt.text} ${opt.is_correct ? "(Правильный)" : ""} - Подсказка: ${opt.hint || "нет"}`)
          .join("\n");
        taskContent += `\n\n[Данные теста]\nТип: ${draft.quiz_data.quiz_type}\nВарианты:\n${options}`;
      } else if (draft.type === "practice" && draft.quiz_data) {
        const tests = (draft.quiz_data.test_cases || [])
          .map((t, i) => `Тест ${i + 1}: input=${t.input}, expected=${t.expected}`)
          .join("\n");
        taskContent += `\n\n[Данные практики]\nЯзык: ${draft.quiz_data.language}\nФункция: ${draft.quiz_data.function_name}\nТесты:\n${tests}`;
      }

      return {
        stepNumber,
        blockId: originalBlock.id,
        title: draft.title || "",
        type: draft.type || "",
        task: taskContent,
        language: draft.quiz_data?.language || (isCodeBlock ? "javascript" : null),
        studentCode: isCodeBlock ? (authorTestCode[originalBlock.id] || draft.quiz_data?.placeholder_code || "") : null,
        submissionStatus: "author_draft",
        submissionMessage: "Режим редактирования автора"
      };
    })
    .filter(Boolean);

  return steps.length > 0 ? steps : null;
}

export function buildStepsContext({ text, sortedBlocks, solutions, submissionState }) {
  const stepRefs = extractStepRefs(text);
  if (stepRefs.length === 0) return null;

  const stepByNumber = new Map(sortedBlocks.map((block, index) => [index + 1, block]));

  const steps = stepRefs
    .map((stepNumber) => {
      const block = stepByNumber.get(stepNumber);
      if (!block) return null;

      const blockState = submissionState[block.id] || {};
      const submission = blockState.submission || null;
      const isCodeBlock = CODE_BLOCK_TYPES.has(block.type);

      return {
        stepNumber,
        blockId: block.id,
        title: block.title || "",
        type: block.type || "",
        task: block.content || "",
        language: block.quiz_data?.language || (isCodeBlock ? "javascript" : null),
        studentCode: isCodeBlock ? getEditorCode(block, solutions) : null,
        submissionStatus: getSubmissionStatus(blockState),
        submissionMessage: getSubmissionMessage(blockState),
        stdout: submission?.stdout || null,
        stderr: submission?.stderr || null,
        failedTests: getFailedTests(submission),
        executionTime: submission?.execution_time || submission?.executionTime || null
      };
    })
    .filter(Boolean);

  return steps.length > 0 ? steps : null;
}
```

---

### 2.2. Компонент Monaco Editor (`client/src/components/CodeEditor.jsx`)
Обертка над библиотекой `@monaco-editor/react`, инкапсулирующая синтаксические настройки и режимы отображения.

```javascript
import { useRef, useCallback } from "react";
import Editor from "@monaco-editor/react";

const LANGUAGE_MAP = {
  "javascript": "javascript",
  "js": "javascript",
  "python": "python",
  "py": "python",
  "java": "java",
  "c++": "cpp",
  "cpp": "cpp"
};

export default function CodeEditor({
  value = "",
  onChange,
  language = "javascript",
  height = 250,
  ariaLabel = "Code editor",
  readOnly = false
}) {
  const editorRef = useRef(null);

  const monacoLanguage = LANGUAGE_MAP[language] || "plaintext";

  const handleEditorMount = useCallback((editor) => {
    editorRef.current = editor;
  }, []);

  const handleChange = useCallback((newValue) => {
    if (onChange) {
      onChange(newValue || "");
    }
  }, [onChange]);

  return (
    <div style={{ border: "1px solid #cbd5e1", borderRadius: "6px", overflow: "hidden" }}>
      <Editor
        height={height}
        language={monacoLanguage}
        value={value}
        onChange={handleChange}
        onMount={handleEditorMount}
        theme="vs-dark"
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          lineNumbers: "on",
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 2,
          wordWrap: "on",
          readOnly: readOnly,
          ariaLabel,
          padding: { top: 8, bottom: 8 }
        }}
      />
    </div>
  );
}
```

---

### 2.3. Панель ИИ-чат-ассистента (`client/src/components/AIChatPanel.jsx`)
Интерфейс диалогового окна, отображающий историю сообщений с форматированием Markdown, статус загрузки, индикаторы выбранных шагов и кнопки переключения когнитивных режимов ИИ.

```javascript
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import AssistantTextarea from "./AssistantTextarea";
import AssistantUnavailableNotice from "./AssistantUnavailableNotice";

export default function AIChatPanel({
  user,
  messages,
  chatInput,
  setChatInput,
  onSendMessage,
  onClearHistory,
  isChatLoading,
  isAssistantAvailable,
  activeMode,
  setActiveMode,
  modes = [],
  modeDescriptions = {},
  detectedContext = [],
  chatEndRef,
  className = "assistant-panel"
}) {
  const isMobile = className.includes("assistant-panel-mobile");
  const [isOpen, setIsOpen] = useState(!isMobile);

  useEffect(() => {
    setIsOpen(!isMobile);
  }, [isMobile]);

  const safeMessages = Array.isArray(messages) ? messages : [];
  const safeDetectedContext = Array.isArray(detectedContext) ? detectedContext : [];
  const safeModes = Array.isArray(modes) ? modes : [];
  const activeModeItem = safeModes.find((mode) => mode.id === activeMode);
  const activeModeLabel = activeModeItem ? `${activeModeItem.icon || ""} ${activeModeItem.label}`.trim() : "Выбрать режим";

  function handleModeClick(mode, event) {
    if (!isAssistantAvailable) return;
    setActiveMode?.(activeMode === mode.id ? null : mode.id);
    if (isMobile) setIsOpen(false);
  }

  return (
    <aside className={className} aria-label="Chat assistant">
      <div className="chat-panel-title">
        <span className="eyebrow">Ассистент</span>
        <h2>Чат</h2>
      </div>

      {safeModes.length > 0 ? (
        isMobile ? (
          <details
            className="chat-mode-disclosure"
            open={isOpen}
            onToggle={(event) => setIsOpen(event.currentTarget.open)}
          >
            <summary>
              <span>{activeModeLabel}</span>
              <span className="chat-mode-chevron" aria-hidden="true" />
            </summary>
            <div className="chat-quick-actions">
              {safeModes.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  className={`chat-mode-button ${activeMode === mode.id ? "active" : ""}`}
                  onClick={(event) => handleModeClick(mode, event)}
                  disabled={!isAssistantAvailable}
                >
                  {mode.icon && <span className="chat-mode-icon">{mode.icon}</span>}
                  <span className="chat-mode-label">{mode.label}</span>
                </button>
              ))}
            </div>
          </details>
        ) : (
          <div className="chat-quick-actions">
            {safeModes.map((mode) => (
              <button
                key={mode.id}
                type="button"
                className={`chat-mode-button ${activeMode === mode.id ? "active" : ""}`}
                onClick={(event) => handleModeClick(mode, event)}
                disabled={!isAssistantAvailable}
              >
                {mode.icon && <span className="chat-mode-icon">{mode.icon}</span>}
                <span className="chat-mode-label">{mode.label}</span>
              </button>
            ))}
          </div>
        )
      ) : null}

      <div className="chat-history">
        {safeMessages.length === 0 ? (
          <div className="assistant-placeholder">
            {isAssistantAvailable ? (
              <p>{modeDescriptions[activeMode || "default"]}</p>
            ) : (
              <AssistantUnavailableNotice />
            )}
          </div>
        ) : (
          safeMessages.map((msg, index) => {
            const role = msg?.role === "user" ? "user" : "assistant";
            const text = typeof msg?.text === "string" ? msg.text : String(msg?.text ?? msg?.message ?? "");

            return (
              <div key={index} className={`chat-message ${role}`}>
                {role === "user" ? <strong>{user?.name || "You"}</strong> : null}
                {role === "assistant" ? (
                  <div className="markdown-content">
                    <ReactMarkdown>{text}</ReactMarkdown>
                  </div>
                ) : (
                  <p>{text}</p>
                )}
              </div>
            );
          })
        )}
        {isChatLoading ? <div className="chat-message assistant loading">Печатает...</div> : null}
        {safeMessages.length > 0 ? (
          <div className="chat-clear-row">
            <button
              type="button"
              className="chat-clear-label"
              onClick={onClearHistory}
              title="Очистить историю сообщений"
            >
              Очистить чат
            </button>
          </div>
        ) : null}
        <div ref={chatEndRef} />
      </div>

      <div>
        {safeDetectedContext.length > 0 ? (
          <div className="assistant-context-hints" aria-label="Selected step context">
            {safeDetectedContext.map((stepNumber) => (
              <span key={stepNumber} className="tag-chip">
                @step{stepNumber}
              </span>
            ))}
          </div>
        ) : null}
        <form className="assistant-input-row" onSubmit={(event) => { event.preventDefault(); onSendMessage(); }}>
          <AssistantTextarea
            value={chatInput}
            onChange={setChatInput}
            onSubmit={onSendMessage}
            placeholder={isAssistantAvailable ? (activeMode ? "Введите ваш запрос..." : "Напишите сообщение...") : "Чат недоступен."}
            disabled={isChatLoading || !isAssistantAvailable}
          />
          <button type="submit" className="secondary-button" disabled={isChatLoading || !chatInput.trim() || !isAssistantAvailable}>
            Отправить
          </button>
        </form>
      </div>
    </aside>
  );
}
```
