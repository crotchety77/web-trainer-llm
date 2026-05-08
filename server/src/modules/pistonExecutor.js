import axios from "axios";

/**
 * Выполняет код с переданными тест-кейсами через Piston API.
 * @param {string} code - Исходный код для выполнения
 * @param {string} language - Язык программирования
 * @param {Array} testCases - Массив тест-кейсов [{ input: "...", expected_output: "..." }]
 * @param {string} functionName - Имя функции для обертки (опционально)
 * @returns {Object} Результат выполнения: status, result_message, tests_result
 */
export async function executeCodeOnPiston(code, language, testCases, functionName) {
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

      const response = await axios.post("http://127.0.0.1:2000/api/v2/execute", {
        language: language || "javascript",
        version: "*",
        files: [{ content: executionCode }],
        stdin: testCase.input || ""
      });

      const run = response.data.run;
      const actualOutput = (run.stdout || "").trim();
      const expectedOutput = (testCase.expected_output || "").trim();

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
        exit_code: run.code
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
