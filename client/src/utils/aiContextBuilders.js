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

function getFailedTests(submission) {
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
