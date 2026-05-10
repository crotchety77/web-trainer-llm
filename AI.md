# AI Ассистент — Context Enrichment

## 1. Цель

AI-чат больше не получает полный текст всех блоков урока в `lessonContext`.
Теперь общий контекст остается компактным, а детальный контекст конкретных шагов передается только по явным ссылкам студента:

```txt
@step2 почему ошибка?
@step1 @step3 объясни разницу
```

## 2. Payload

Клиент отправляет:

```js
{
  userInput,
  lessonContext,
  stepsContext,
  chatHistory,
  mode
}
```

`lessonContext` содержит только summary урока:

```txt
Урок: Основы JavaScript

Шаги:
1. Переменные
2. Функции
3. Циклы
```

`stepsContext` содержит детали только запрошенных шагов:

```js
{
  stepNumber,
  blockId,
  title,
  type,
  task,
  language,
  studentCode,
  submissionStatus,
  submissionMessage,
  stdout,
  stderr,
  failedTests,
  executionTime
}
```

## 3. Client Flow

```txt
[Student message]
  -> LearnPage.handleChatSubmit()
  -> extractStepRefs(userInput)
  -> buildLessonSummaryContext(lesson, sortedBlocks)
  -> buildStepsContext({ sortedBlocks, solutions, submissionState })
  -> POST /api/ai/chat
```

Клиентские модули:

- `client/src/utils/extractStepRefs.js` — расширяемый parser для `@stepN`, с общей функцией `extractContextRefs()`.
- `client/src/utils/aiContextBuilders.js` — сборка `lessonContext` и `stepsContext`.
- `LearnPage.jsx` — только связывает UI state с context builders.

## 4. Prompt Assembly

Сервер остается единственной точкой сборки prompt:

```txt
system prompt
  ↓
lesson summary
  ↓
steps context
  ↓
chat history
  ↓
current user message
```

В `server/src/modules/promptBuilder.js`:

```js
buildPrompt({
  userRole,
  mode,
  lessonContext,
  stepsContext,
  chatHistory,
  userInput
})
```

Если `stepsContext` есть, он сериализуется через `serializeStepsContext()` и добавляется отдельным user-message:

````txt
Контекст шагов:

=== STEP 2 ===
Title: Functions
Language: javascript

Task:
Напишите функцию add(a, b)

Student code:
```javascript
function add(a, b) {
  return a + b
}
```
````

## 5. Sequence Flow

```txt
Student
  -> LearnPage: "@step2 почему ошибка?"
  -> extractStepRefs: [2]
  -> sortedBlocks[1]: block
  -> solutions[block.id]: текущий код из редактора
  -> submissionState[block.id]: результат последней проверки
  -> apiRequest("/api/ai/chat", payload)
  -> aiRoutes: authMiddleware
  -> promptBuilder.buildPrompt()
  -> Yandex GPT
  -> LearnPage: assistant message
```

## 6. AI Behavior

Для `mode = code_help` системный prompt требует:

- если есть syntax/compiler/runtime error, указать строку ошибки, если она есть в контексте;
- объяснить причину ошибки;
- не писать полное решение;
- сначала направлять студента подсказками и вопросами.

## 7. Refactoring Notes

Логика разделена по слоям:

- parsing references — `extractStepRefs.js`;
- client context building — `aiContextBuilders.js`;
- server prompt assembly — `promptBuilder.js`;
- LLM transport — `ai.js`.

Это убирает дублирование между UI и prompt assembly: клиент собирает структурированные данные из состояния страницы, сервер отвечает за порядок сообщений и markdown-сериализацию.

## 8. Extensibility Roadmap

Parser уже подготовлен к новым ссылкам:

- `@quiz2` — контекст конкретного quiz-блока;
- `@solution3` — акцент на решении/попытках;
- `@terminal` — вывод последнего запуска в терминале;
- `@file:utils.js` — контекст файла из IDE/editor state.

Следующий шаг архитектуры: заменить `buildStepsContext()` на registry context builders:

```txt
reference type -> context builder -> structured context -> serializer
```

Это позволит добавлять новые типы ссылок без переписывания `LearnPage.handleChatSubmit()` и `promptBuilder.buildPrompt()`.
