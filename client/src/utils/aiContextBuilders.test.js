import { describe, expect, it } from "vitest";
import { buildLessonSummaryContext, buildStepsContext } from "./aiContextBuilders";

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
