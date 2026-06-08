# AI Context Enrichment — Tasks

## Client
- [x] `client/src/utils/extractStepRefs.js` — extensible ref parser
- [x] `LearnPage.jsx` — refactor handleChatSubmit: parse @stepN, build stepsContext, slim lessonContext
- [x] `LearnPage.jsx` — hint UI: show inline pill when @step is detected in input

## Server
- [x] `promptBuilder.js` — add `serializeStepsContext()` helper
- [x] `promptBuilder.js` — update `buildPrompt()` to accept `stepsContext`
- [x] `promptBuilder.js` — update `aiRoutes.js` to pass `stepsContext` from req.body

## Tests
- [x] Update `promptBuilder.test.js` — add tests for `stepsContext` injection
- [x] Add `extractStepRefs.test.js`

## Docs
- [x] Update `AI.md` — new flow, prompt assembly diagram, extensibility roadmap
