import axios from "axios";

const REQUIRED_LANGUAGES = [
  { language: "node", version: "*" },
  { language: "python", version: "3.10.0" }
];

export async function initializePistonLanguages(retries = 5) {
  if (retries === 5) console.log("[piston] Проверка установленных языков программирования...");
  try {
    const pistonUrl = process.env.PISTON_URL || "http://127.0.0.1:2000";

    // Получаем список уже установленных пакетов
    const response = await axios.get(`${pistonUrl}/api/v2/packages`);
    const installedPackages = response.data.filter(pkg => pkg.installed);
    const installedLangs = installedPackages.map(pkg => pkg.language);
    let missingPackagesCount = 0;

    for (const reqPkg of REQUIRED_LANGUAGES) {
      if (!installedLangs.includes(reqPkg.language)) {
        missingPackagesCount++;
        console.log(`[piston] Язык ${reqPkg.language} не установлен. Начинаю фоновую установку (это может занять время)...`);

        // Запускаем установку без await, чтобы не блокировать старт сервера
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

/**
 * Выполняет код с переданными тест-кейсами через Piston API.
 * @param {string} code - Исходный код для выполнения
 * @param {string} language - Язык программирования
 * @param {Array} testCases - Массив тест-кейсов [{ input: "...", expected_output: "..." }]
 * @param {string} functionName - Имя функции для обертки (опционально)
 * @returns {Object} Результат выполнения: status, result_message, tests_result
 */
export async function executeCodeOnPiston(code, language, testCases, functionName) {
  // --- Pre-flight Health Check ---
  try {
    // Проверяем доступность API Piston перед запуском тестов
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

      // stdin: если массив [2, 3] → строка "2 3" (разделитель пробел/перенос)
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

      // Успех = код возврата 0 и вывод совпадает
      const passed = run.code === 0 && actualOutput === expectedOutput;

      if (passed) {
        passedCount++;
      } else {
        failedCount++;
      }

      let finalActualOutput = actualOutput;
      if (run.code !== 0 && run.stderr) {
        // Извлекаем тип ошибки или ставим заглушку
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
