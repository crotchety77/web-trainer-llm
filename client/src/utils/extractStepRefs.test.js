import { describe, expect, it } from "vitest";
import { extractContextRefs, extractStepRefs } from "./extractStepRefs";

describe("extractStepRefs()", () => {
  it("extracts one or more @step references", () => {
    expect(extractStepRefs("@step1 @step3")).toEqual([1, 3]);
  });

  it("deduplicates references and is case-insensitive", () => {
    expect(extractStepRefs("@STEP2 explain @step2 again")).toEqual([2]);
  });

  it("ignores text without step references", () => {
    expect(extractStepRefs("why does this fail?")).toEqual([]);
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
