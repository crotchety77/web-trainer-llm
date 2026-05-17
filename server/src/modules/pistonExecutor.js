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

    for (const reqPkg of REQUIRED_LANGUAGES) {
      if (!installedLangs.includes(reqPkg.language)) {
        console.log(`[piston] Язык ${reqPkg.language} не установлен. Начинаю фоновую установку (это может занять время)...`);

        // Запускаем установку без await, чтобы не блокировать старт сервера
        axios.post(`${pistonUrl}/api/v2/packages`, reqPkg)
          .then(() => console.log(`[piston] ✅ Язык ${reqPkg.language} успешно установлен!`))
          .catch(err => console.error(`[piston] ❌ Ошибка установки ${reqPkg.language}:`, err.response?.data?.message || err.message));
      } else {
        if (retries === 5) console.log(`[piston] Язык ${reqPkg.language} уже установлен.`);
      }
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
          executionCode = `${code}\n\n// --- Автоматически сгенерированная обертка ---\nconst fs = require('fs');\nconst input = fs.readFileSync(0, 'utf-8').trim().split(/\\s+/).filter(Boolean);\nif (input.length > 0) {\n  const args = input.map(x => isNaN(Number(x)) ? x : Number(x));\n  const result = eval(\`${fnName}(...args)\`);\n  if (result !== undefined) console.log(result);\n} else {\n  const result = eval(\`${fnName}()\`);\n  if (result !== undefined) console.log(result);\n}`;
        } else if (language === "python" || language === "py") {
          executionCode = `${code}\n\n# --- Автоматически сгенерированная обертка ---\nimport sys\ninput_data = sys.stdin.read().split()\nargs = []\nfor x in input_data:\n    try:\n        args.append(int(x))\n    except ValueError:\n        try:\n            args.append(float(x))\n        except ValueError:\n            args.append(x)\nresult = eval("${fnName}(*args)")\nif result is not None:\n    print(result)\n`;
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
