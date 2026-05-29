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
      
      // Добавляем информацию о тестах/опросах для контекста автора
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
