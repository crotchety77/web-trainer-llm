import { describe, expect, it } from "vitest";
import { extractContextRefs, extractStepRefs } from "./extractStepRefs";

describe("extractStepRefs() (Таблица П.8)", () => {
  it("ES-01: Извлечение множественных ссылок", () => {
    expect(extractStepRefs("@step1 и @step3")).toEqual([1, 3]);
  });

  it("ES-02: Дедупликация повторяющихся ссылок", () => {
    expect(extractStepRefs("@step2 почему @step2 падает")).toEqual([2]);
  });

  it("ES-03: Обработка текста без ссылок", () => {
    expect(extractStepRefs("обычный текст без упоминаний")).toEqual([]);
  });

  it("ES-04: Распознавание числового значения ноль", () => {
    expect(extractStepRefs("@step0")).toEqual([0]);
  });

  it("ES-05: Игнорирование некорректного синтаксиса", () => {
    expect(extractStepRefs("@stepABC")).toEqual([]);
  });
});

describe("extractContextRefs()", () => {
  it("keeps the parser extensible for future context reference types", () => {
    expect(extractContextRefs("@quiz2 @solution3 @terminal @file:utils.js")).toEqual({
      quiz: [2],
      solution: [3],
      terminal: [true],
      file: ["utils.js"]
    });
  });
});
