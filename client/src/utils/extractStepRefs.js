const REF_PATTERNS = [
  {
    type: "step",
    pattern: /@step(\d+)\b/gi,
    parse: (match) => Number(match[1])
  },
  {
    type: "quiz",
    pattern: /@quiz(\d+)\b/gi,
    parse: (match) => Number(match[1])
  },
  {
    type: "solution",
    pattern: /@solution(\d+)\b/gi,
    parse: (match) => Number(match[1])
  },
  {
    type: "terminal",
    pattern: /@terminal\b/gi,
    parse: () => true
  },
  {
    type: "file",
    pattern: /@file:([^\s]+)/gi,
    parse: (match) => match[1]
  }
];

export function extractContextRefs(text, enabledTypes = REF_PATTERNS.map((ref) => ref.type)) {
  if (typeof text !== "string" || !text.trim()) return {};

  const enabled = new Set(enabledTypes);
  return REF_PATTERNS.reduce((refs, refPattern) => {
    if (!enabled.has(refPattern.type)) return refs;

    const values = [...text.matchAll(refPattern.pattern)]
      .map(refPattern.parse)
      .filter((value) => value !== null && value !== undefined && value !== false);

    if (values.length > 0) {
      refs[refPattern.type] = [...new Set(values)];
    }

    return refs;
  }, {});
}

export function extractStepRefs(text) {
  return extractContextRefs(text, ["step"]).step || [];
}
