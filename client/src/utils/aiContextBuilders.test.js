/**
 * Модульные тесты: подготовка контекста для LLM.
 *
 * Особое внимание уделено защите скрытых тестовых сценариев в getFailedTests.
 * Модуль должен гарантировать, что входные данные и ожидаемые результаты
 * скрытых тестов не попадут в контекст, передаваемый ИИ, чтобы предотвратить
 * раскрытие эталонных решений (data leakage) студенту через диалог с нейросетью.
 */
import { describe, expect, it } from "vitest";
import { buildLessonSummaryContext, buildStepsContext, getFailedTests } from "./aiContextBuilders";

const sortedBlocks = [
  {
    id: 10,
    type: "lecture",
    title: "Variables",
    content: "Learn let and const.",
    position: 1
  },
  {
    id: 20,
    type: "practice",
    title: "Functions",
    content: "Write add(a, b).",
    position: 2,
    quiz_data: {
      language: "javascript",
      placeholder_code: "function add(a, b) {\n}"
    }
  }
];

describe("aiContextBuilders", () => {
  it("builds a slim lesson summary without full block content", () => {
    const result = buildLessonSummaryContext({ title: "JavaScript Basics" }, sortedBlocks);

    expect(result).toContain("Урок: JavaScript Basics");
    expect(result).toContain("1. Variables");
    expect(result).toContain("2. Functions");
    expect(result).not.toContain("Learn let and const.");
  });

  it("builds detailed context only for requested steps", () => {
    const result = buildStepsContext({
      text: "@step2 why error?",
      sortedBlocks,
      solutions: {
        20: "function add(a, b) {\n  return a + b\n}"
      },
      submissionState: {
        20: {
          submission: {
            status: "failed",
            result_message: "1 out of 1 tests failed.",
            tests_result: {
              details: [
                {
                  input: "1 2",
                  expected: "3",
                  actual: "SyntaxError",
                  passed: false,
                  exit_code: 1
                }
              ]
            }
          }
        }
      }
    });

    expect(result).toEqual([
      expect.objectContaining({
        stepNumber: 2,
        blockId: 20,
        title: "Functions",
        language: "javascript",
        studentCode: "function add(a, b) {\n  return a + b\n}",
        submissionStatus: "failed",
        submissionMessage: "1 out of 1 tests failed.",
        failedTests: [
          {
            testNumber: 1,
            input: "1 2",
            expected: "3",
            actual: "SyntaxError",
            exitCode: 1,
            isHidden: false
          }
        ]
      })
    ]);
  });
});

describe("getFailedTests()", () => {
  it("GF-01: извлекает детали упавшего теста с корректной нумерацией", () => {
    const submission = {
      tests_result: {
        details: [
          { passed: false, input: "1", expected: "2", actual: "3", exit_code: 1 }
        ]
      }
    };

    expect(getFailedTests(submission)).toEqual([
      { testNumber: 1, input: "1", expected: "2", actual: "3", exitCode: 1, isHidden: false }
    ]);
  });

  it("GF-02: возвращает пустой массив, если все тесты пройдены", () => {
    const submission = {
      tests_result: {
        details: [
          { passed: true, input: "1", expected: "2", actual: "2" }
        ]
      }
    };

    expect(getFailedTests(submission)).toEqual([]);
  });

  it("GF-03: возвращает пустой массив для null-результатов", () => {
    expect(getFailedTests(null)).toEqual([]);
  });

  it("GF-04: возвращает пустой массив, если tests_result отсутствует", () => {
    expect(getFailedTests({ tests_result: null })).toEqual([]);
  });

  it("GF-05: возвращает пустой массив, если details не является массивом", () => {
    expect(getFailedTests({ tests_result: { details: "not_array" } })).toEqual([]);
  });

  it("GF-06: маскирует input/expected/actual для скрытых тестов (предотвращение утечки данных в LLM)", () => {
    const submission = {
      tests_result: {
        details: [
          { passed: false, is_hidden: true, input: "secret", expected: "x", actual: "y", exit_code: 0 }
        ]
      }
    };

    // Все чувствительные данные заменяются на null, ИИ получит только факт падения теста
    expect(getFailedTests(submission)).toEqual([
      { testNumber: 1, input: null, expected: null, actual: null, exitCode: 0, isHidden: true }
    ]);
  });

  it("GF-07: нумерует несколько упавших тестов последовательно", () => {
    const submission = {
      tests_result: {
        details: [
          { passed: false, input: "a", expected: "b", actual: "c" },
          { passed: false, input: "d", expected: "e", actual: "f" }
        ]
      }
    };

    const result = getFailedTests(submission);
    expect(result).toHaveLength(2);
    expect(result[0].testNumber).toBe(1);
    expect(result[1].testNumber).toBe(2);
  });
});
