# Каталог тест-кейсов модульного тестирования

> Все граничные значения и диапазоны извлечены строго из логики исходного кода проекта.  
> Файлы проекта: [server/src](file:///c:/Users/Foxi8/diplom/web-trainer-platform/server/src) | [client/src](file:///c:/Users/Foxi8/diplom/web-trainer-platform/client/src)

---

## 1. Модуль `isValidUserLlmApiKey`

**Файл**: [userApiKey.js](file:///c:/Users/Foxi8/diplom/web-trainer-platform/server/src/modules/userApiKey.js#L9-L16)  
**Контракт**: Принимает `value` (any). Возвращает `true`, если строка (после `trim()`) имеет длину от 20 до 300 символов включительно и не содержит пробелов. Иначе `false`.

| ID | Входные данные | Ожидаемый результат | Тип сценария |
|---|---|---|---|
| VK-01 | `"yandex-api-key-1234567890"` (25 символов) | `true` | Нормальный |
| VK-02 | `"a".repeat(20)` (ровно 20 символов) | `true` | Граничный (нижняя граница) |
| VK-03 | `"a".repeat(19)` (19 символов) | `false` | Граничный (ниже нижней границы) |
| VK-04 | `"a".repeat(300)` (ровно 300 символов) | `true` | Граничный (верхняя граница) |
| VK-05 | `"a".repeat(301)` (301 символ) | `false` | Граничный (выше верхней границы) |
| VK-06 | `"yandex api key 1234567890"` (содержит пробелы) | `false` | Некорректный |
| VK-07 | `"short"` (5 символов) | `false` | Некорректный |
| VK-08 | `""` (пустая строка) | `false` | Некорректный |
| VK-09 | `null` | `false` | Некорректный (не строка) |
| VK-10 | `undefined` | `false` | Некорректный (не строка) |
| VK-11 | `12345` (число) | `false` | Некорректный (не строка) |
| VK-12 | `"  " + "a".repeat(20) + "  "` (пробелы по краям, после trim — 20) | `true` | Граничный (trim) |
| VK-13 | `"a".repeat(21)` (21 символ) | `true` | Граничный (чуть выше нижней границы) |
| VK-14 | `"a".repeat(299)` (299 символов) | `true` | Граничный (чуть ниже верхней границы) |

---

## 2. Модуль `isValidUserLlmFolderId`

**Файл**: [userApiKey.js](file:///c:/Users/Foxi8/diplom/web-trainer-platform/server/src/modules/userApiKey.js#L18-L25)  
**Контракт**: Принимает `value` (any). Возвращает `true`, если строка (после `trim()`) имеет длину от 6 до 128 символов и соответствует паттерну `/^[A-Za-z0-9_-]+$/`. Иначе `false`.

| ID | Входные данные | Ожидаемый результат | Тип сценария |
|---|---|---|---|
| FI-01 | `"folder-id_123"` (13 символов) | `true` | Нормальный |
| FI-02 | `"abcdef"` (ровно 6 символов) | `true` | Граничный (нижняя граница) |
| FI-03 | `"abcde"` (5 символов) | `false` | Граничный (ниже нижней границы) |
| FI-04 | `"a".repeat(128)` (ровно 128 символов) | `true` | Граничный (верхняя граница) |
| FI-05 | `"a".repeat(129)` (129 символов) | `false` | Граничный (выше верхней границы) |
| FI-06 | `"folder id"` (содержит пробел) | `false` | Некорректный (недопустимый символ) |
| FI-07 | `"folder@id!"` (спецсимволы) | `false` | Некорректный (недопустимый символ) |
| FI-08 | `""` (пустая строка) | `false` | Некорректный |
| FI-09 | `null` | `false` | Некорректный (не строка) |
| FI-10 | `"ABC_def-123"` (все допустимые классы символов) | `true` | Нормальный |
| FI-11 | `"a".repeat(7)` (7 символов) | `true` | Граничный (чуть выше нижней границы) |
| FI-12 | `"a".repeat(127)` (127 символов) | `true` | Граничный (чуть ниже верхней границы) |

---

## 3. Модуль `encryptUserApiKey` / `decryptUserApiKey`

**Файл**: [userApiKey.js](file:///c:/Users/Foxi8/diplom/web-trainer-platform/server/src/modules/userApiKey.js#L41-L77)  
**Контракт**: `encryptUserApiKey(rawApiKey, encryptionKey)` — шифрует ключ алгоритмом `aes-256-gcm`, возвращает строку формата `v1:iv:authTag:ciphertext`. `decryptUserApiKey(encrypted, encryptionKey)` — расшифровывает обратно. Ключ шифрования должен быть base64-строкой, декодируемой в ровно 32 байта.

| ID | Входные данные | Ожидаемый результат | Тип сценария |
|---|---|---|---|
| EK-01 | `rawApiKey = "yandex-api-key-1234567890"`, корректный 32-байтный ключ | Зашифрованная строка начинается с `"v1:"`, расшифровка возвращает исходный ключ | Нормальный |
| EK-02 | `encryptionKey = "bad-key"` (не base64 32 байта) | `throw Error(/32-byte/)` | Некорректный |
| EK-03 | `encryptionKey = null` | `throw Error("USER_API_KEY_ENCRYPTION_KEY is not configured")` | Некорректный |
| EK-04 | `encryptionKey = ""` (пустая строка) | `throw Error("USER_API_KEY_ENCRYPTION_KEY is not configured")` | Некорректный |
| EK-05 | Расшифровка повреждённого ciphertext (последние 4 символа заменены) | `throw Error` (ошибка аутентификации GCM) | Некорректный |
| EK-06 | `decryptUserApiKey(null, key)` | `throw Error("Encrypted API key is missing")` | Некорректный |
| EK-07 | `decryptUserApiKey("", key)` | `throw Error("Encrypted API key is missing")` | Некорректный |
| EK-08 | `decryptUserApiKey("wrong:format", key)` | `throw Error("Encrypted API key has an invalid format")` | Некорректный |
| EK-09 | `decryptUserApiKey("v2:a:b:c", key)` (неверная версия) | `throw Error("Encrypted API key has an invalid format")` | Некорректный |
| EK-10 | Два вызова `encrypt` с одним ключом дают разные результаты (случайный IV) | `encrypted1 !== encrypted2`, оба расшифровываются в одно значение | Нормальный |

---

## 4. Модуль `authMiddleware`

**Файл**: [authMiddleware.js](file:///c:/Users/Foxi8/diplom/web-trainer-platform/server/src/middleware/authMiddleware.js#L4-L19)  
**Контракт**: Проверяет заголовок `Authorization: Bearer <token>`. Если отсутствует или не начинается с `"Bearer "` — возвращает 401. Если токен невалидный/просроченный — возвращает 401. Если корректный — помещает payload в `request.user` и вызывает `next()`.

| ID | Входные данные | Ожидаемый результат | Тип сценария |
|---|---|---|---|
| AM-01 | Корректный JWT-токен в заголовке `Authorization: Bearer <valid>` | `next()` вызван, `request.user` содержит payload | Нормальный |
| AM-02 | Заголовок отсутствует | `status 401`, `message: "Authorization token is required"` | Некорректный |
| AM-03 | `Authorization: Basic <token>` (не Bearer) | `status 401`, `message: "Authorization token is required"` | Некорректный |
| AM-04 | `Authorization: Bearer ` (пустой токен) | `status 401`, `message: "Invalid or expired token"` | Граничный |
| AM-05 | `Authorization: Bearer invalid-jwt-string` | `status 401`, `message: "Invalid or expired token"` | Некорректный |
| AM-06 | Просроченный JWT-токен | `status 401`, `message: "Invalid or expired token"` | Граничный |
| AM-07 | `Authorization: Bearer` (без пробела) | `status 401`, `message: "Authorization token is required"` | Граничный |

---

## 5. Модуль `optionalAuthMiddleware`

**Файл**: [authMiddleware.js](file:///c:/Users/Foxi8/diplom/web-trainer-platform/server/src/middleware/authMiddleware.js#L21-L38)  
**Контракт**: Аналогичен `authMiddleware`, но при отсутствии/невалидности токена устанавливает `request.user = null` и вызывает `next()` (без ошибки).

| ID | Входные данные | Ожидаемый результат | Тип сценария |
|---|---|---|---|
| OA-01 | Корректный JWT-токен | `request.user` содержит payload, `next()` вызван | Нормальный |
| OA-02 | Заголовок отсутствует | `request.user = null`, `next()` вызван | Нормальный (гостевой доступ) |
| OA-03 | Невалидный токен | `request.user = null`, `next()` вызван | Некорректный (мягкая обработка) |
| OA-04 | Просроченный токен | `request.user = null`, `next()` вызван | Граничный |

---

## 6. Модуль `requireRole`

**Файл**: [authMiddleware.js](file:///c:/Users/Foxi8/diplom/web-trainer-platform/server/src/middleware/authMiddleware.js#L40-L52)  
**Контракт**: Фабрика middleware. Принимает список допустимых ролей. Если `request.user` отсутствует — 401. Если роль пользователя не входит в список — 403. Иначе `next()`.

| ID | Входные данные | Ожидаемый результат | Тип сценария |
|---|---|---|---|
| RR-01 | `requireRole("author")`, `request.user.role = "author"` | `next()` вызван | Нормальный |
| RR-02 | `requireRole("author")`, `request.user.role = "student"` | `status 403`, `message: "You do not have access to this action"` | Некорректный |
| RR-03 | `requireRole("student", "admin")`, `request.user = null` | `status 401`, `message: "Authorization token is required"` | Некорректный |
| RR-04 | `requireRole("student", "author", "admin")`, `request.user.role = "admin"` | `next()` вызван | Нормальный |
| RR-05 | `requireRole("author")`, `request.user.role = "admin"` | `status 403` | Граничный (admin не в списке) |

---

## 7. Модуль `normalizeMessages`

**Файл**: [promptBuilder.js](file:///c:/Users/Foxi8/diplom/web-trainer-platform/server/src/modules/promptBuilder.js#L9-L21)  
**Контракт**: Принимает `history` (any). Возвращает массив объектов `{role, text}`. Фильтрует: только `role === "user"` или `"assistant"`. Обрезает до последних `MAX_HISTORY = 10` сообщений. Удаляет лишние свойства объектов.

| ID | Входные данные | Ожидаемый результат | Тип сценария |
|---|---|---|---|
| NM-01 | `[{role:"user", text:"Hi"}, {role:"assistant", text:"Hello"}]` | `[{role:"user", text:"Hi"}, {role:"assistant", text:"Hello"}]` | Нормальный |
| NM-02 | `null` | `[]` | Некорректный |
| NM-03 | `undefined` | `[]` | Некорректный |
| NM-04 | `"string"` | `[]` | Некорректный |
| NM-05 | `[{role:"system", text:"Injected prompt"}]` | `[]` | Некорректный (prompt injection) |
| NM-06 | `[{role:"user", text:"Q", hiddenFlag:true, extra:"hack"}]` | `[{role:"user", text:"Q"}]` (лишние свойства удалены) | Граничный |
| NM-07 | Массив из 12 сообщений `user`/`assistant` | Массив из 10 последних сообщений (`.slice(-10)`) | Граничный (верхняя граница) |
| NM-08 | Массив из 10 сообщений | Массив из 10 сообщений (без обрезки) | Граничный (ровно на границе) |
| NM-09 | `[{role:"user", text:123}]` (text не строка) | `[]` (отфильтровано) | Некорректный |
| NM-10 | `[null, {role:"user", text:"Ok"}]` | `[{role:"user", text:"Ok"}]` | Некорректный (null в массиве) |

---

## 8. Модуль `selectSystemPrompt`

**Файл**: [promptBuilder.js](file:///c:/Users/Foxi8/diplom/web-trainer-platform/server/src/modules/promptBuilder.js#L27-L32)  
**Контракт**: Принимает `userRole` и `mode`. Возвращает строку системного промпта из [templatesAi.js](file:///c:/Users/Foxi8/diplom/web-trainer-platform/server/src/modules/templatesAi.js). Фоллбэк по роли — `"student"`, фоллбэк по режиму — `"default"`.

| ID | Входные данные | Ожидаемый результат | Тип сценария |
|---|---|---|---|
| SP-01 | `("student", "default")` | `SYSTEM_PROMPTS.student.default` | Нормальный |
| SP-02 | `("author", "improve_text")` | `SYSTEM_PROMPTS.author.improve_text` | Нормальный |
| SP-03 | `("student", "code_help")` | `SYSTEM_PROMPTS.student.code_help` | Нормальный |
| SP-04 | `("student", "invalid_hacker_mode")` | `SYSTEM_PROMPTS.student.default` (фоллбэк по mode) | Граничный |
| SP-05 | `("guest", "explain")` | `SYSTEM_PROMPTS.student.explain` (фоллбэк по role) | Граничный |
| SP-06 | `("guest", "unknown_mode")` | `SYSTEM_PROMPTS.student.default` (двойной фоллбэк) | Граничный |
| SP-07 | `("author", null)` | `SYSTEM_PROMPTS.author.default` (mode → "default") | Граничный |
| SP-08 | `("author", "")` | `SYSTEM_PROMPTS.author.default` (пустой mode → "default") | Граничный |

---

## 9. Модуль `normalizeTags`

**Файл**: [courseRoutes.js](file:///c:/Users/Foxi8/diplom/web-trainer-platform/server/src/routes/courseRoutes.js#L22-L81)  
**Контракт**: Принимает `input` (массив строк или строку). Парсит теги из формата `#tag`, `tag1,tag2`, или просто слова. Удаляет дубликаты. Возвращает массив уникальных строк.

| ID | Входные данные | Ожидаемый результат | Тип сценария |
|---|---|---|---|
| NT-01 | `["JavaScript", "React"]` | `["JavaScript", "React"]` | Нормальный |
| NT-02 | `"#js, #react, #node"` (строка с запятыми и `#`) | `["js", "react", "node"]` | Нормальный |
| NT-03 | `"#JavaScript #React"` (строка с `#` без запятых) | `["JavaScript", "React"]` | Нормальный |
| NT-04 | `["#tag1", "#tag2"]` (массив с `#`) | `["tag1", "tag2"]` | Нормальный |
| NT-05 | `["JavaScript, React"]` (одна строка с запятой в массиве) | `["JavaScript", "React"]` | Нормальный |
| NT-06 | `""` (пустая строка) | `[]` | Граничный |
| NT-07 | `[]` (пустой массив) | `[]` | Граничный |
| NT-08 | `null` | `[]` (не массив и не строка) | Некорректный |
| NT-09 | `["tag1", "tag1", "tag2"]` (дубликаты) | `["tag1", "tag2"]` (дедупликация через `Set`) | Граничный |
| NT-10 | `["  "]` (пробелы) | `[]` (после trim пусто) | Граничный |
| NT-11 | `123` (число) | `[]` (не массив и не строка) | Некорректный |

---

## 10. Модуль `normalizeBlockPayload`

**Файл**: [courseRoutes.js](file:///c:/Users/Foxi8/diplom/web-trainer-platform/server/src/routes/courseRoutes.js#L94-L104)  
**Контракт**: Принимает объект `body`. Возвращает нормализованный объект с полями `type`, `title`, `content`, `attachmentUrl`, `position`, `quizData`. Поле `attachmentUrl` заполняется только для типа `"lecture"`. Позиция по умолчанию — `1`.

| ID | Входные данные | Ожидаемый результат | Тип сценария |
|---|---|---|---|
| NB-01 | `{type:"lecture", title:"Intro", content:"text", attachment_url:"/f.pdf", position:2}` | `{type:"lecture", title:"Intro", content:"text", attachmentUrl:"/f.pdf", position:2, quizData:{quiz_type:"single", options:[]}}` | Нормальный |
| NB-02 | `{type:"practice", title:"Code", attachment_url:"/f.pdf"}` | `attachmentUrl: ""` (не lecture → URL обнуляется) | Граничный |
| NB-03 | `{type:"test", title:"Quiz"}` | `attachmentUrl: ""`, `position: 1` (дефолт) | Граничный |
| NB-04 | `{type:" LECTURE ", title:" Title "}` | `type:"LECTURE"`, `title:"Title"` (trim, но тип в верхнем регистре) | Граничный |
| NB-05 | `{}` (пустой объект) | `{type:"", title:"", content:"", attachmentUrl:"", position:1, quizData:{quiz_type:"single", options:[]}}` | Граничный |
| NB-06 | `{position: "abc"}` | `position: 1` (`Number("abc")` = `NaN`, `NaN \|\| 1` = `1`) | Некорректный |
| NB-07 | `{position: 0}` | `position: 1` (`0 \|\| 1` = `1`) | Граничный |
| NB-08 | `{position: -5}` | `position: -5` (отрицательное число — валидно синтаксически) | Граничный |

---

## 11. Модуль `validateLectureAttachment`

**Файл**: [attachmentService.js](file:///c:/Users/Foxi8/diplom/web-trainer-platform/server/src/services/attachmentService.js#L43-L60)  
**Контракт**: Принимает объект `file` с полями `originalname`, `mimetype`, `size`. Допустимые типы: `.pdf` (`application/pdf`), `.docx` (`application/vnd.openxmlformats-officedocument.wordprocessingml.document`). Максимальный размер: `< 20 МБ` (20 × 1024 × 1024 = 20971520 байт). Возвращает пустую строку при успехе, строку с ошибкой при неуспехе.

| ID | Входные данные | Ожидаемый результат | Тип сценария |
|---|---|---|---|
| VA-01 | `{originalname:"doc.pdf", mimetype:"application/pdf", size:1000}` | `""` (успех) | Нормальный |
| VA-02 | `{originalname:"doc.docx", mimetype:"application/vnd.openxmlformats-officedocument.wordprocessingml.document", size:1000}` | `""` (успех) | Нормальный |
| VA-03 | `null` | `"Attachment file is required"` | Некорректный |
| VA-04 | `undefined` | `"Attachment file is required"` | Некорректный |
| VA-05 | `{originalname:"doc.txt", mimetype:"text/plain", size:100}` | `"Only PDF and DOCX files can be uploaded"` | Некорректный (недопустимый тип) |
| VA-06 | `{originalname:"doc.pdf", mimetype:"text/plain", size:100}` | `"Only PDF and DOCX files can be uploaded"` (расширение .pdf, но MIME не совпадает) | Некорректный |
| VA-07 | `{originalname:"doc.exe", mimetype:"application/octet-stream", size:100}` | `"Only PDF and DOCX files can be uploaded"` | Некорректный |
| VA-08 | `{originalname:"doc.pdf", mimetype:"application/pdf", size:20971520}` (ровно 20 МБ) | `"Attachment must be smaller than 20 MB"` (`size >= MAX`, проверка `>=`) | Граничный (верхняя граница) |
| VA-09 | `{originalname:"doc.pdf", mimetype:"application/pdf", size:20971519}` (20 МБ − 1 байт) | `""` (успех) | Граничный (чуть ниже верхней границы) |
| VA-10 | `{originalname:"doc.pdf", mimetype:"application/pdf", size:0}` | `""` (успех, размер 0) | Граничный (нижняя граница) |

---

## 12. Модуль `parseAttachments`

**Файл**: [attachmentService.js](file:///c:/Users/Foxi8/diplom/web-trainer-platform/server/src/services/attachmentService.js#L14-L37)  
**Контракт**: Принимает `value` (строку или falsy). Если falsy — возвращает `[]`. Если JSON-массив — фильтрует элементы с полями `stored_name` и `url`. Если не парсится как JSON — создаёт legacy-объект с `url = String(value)`.

| ID | Входные данные | Ожидаемый результат | Тип сценария |
|---|---|---|---|
| PA-01 | `JSON.stringify([{stored_name:"a.pdf", url:"/a.pdf"}])` | `[{stored_name:"a.pdf", url:"/a.pdf"}]` | Нормальный |
| PA-02 | `null` | `[]` | Граничный |
| PA-03 | `""` | `[]` | Граничный |
| PA-04 | `undefined` | `[]` | Граничный |
| PA-05 | `"https://old.url/file.pdf"` (plain URL, legacy) | `[{original_name:"Attached file", url:"https://old.url/file.pdf", stored_name:"", size:0, mime_type:""}]` | Нормальный (legacy) |
| PA-06 | `JSON.stringify([{stored_name:"", url:"/a.pdf"}, {stored_name:"b.pdf", url:"/b.pdf"}])` | `[{stored_name:"b.pdf", url:"/b.pdf"}]` (первый отфильтрован: `stored_name` пуст) | Граничный |
| PA-07 | `"not-json {"` (невалидный JSON) | Legacy-объект с `url: "not-json {"` | Некорректный (fallback) |

---

## 13. Модуль `canReadCourse`

**Файл**: [courseService.js](file:///c:/Users/Foxi8/diplom/web-trainer-platform/server/src/services/courseService.js#L58-L64)  
**Контракт**: Принимает `course` (с полем `is_published`, `author_id`) и `user` (с полями `role`, `id`). Если курс опубликован — `true`. Если не опубликован — `true` только для автора этого курса. Иначе `false`.

| ID | Входные данные | Ожидаемый результат | Тип сценария |
|---|---|---|---|
| CR-01 | `course.is_published = true`, `user = null` | `true` | Нормальный |
| CR-02 | `course.is_published = true`, `user.role = "student"` | `true` | Нормальный |
| CR-03 | `course.is_published = false`, `user = null` | `false` | Некорректный |
| CR-04 | `course.is_published = false`, `user.role = "author"`, `user.id = course.author_id` | `true` | Нормальный (автор видит свой черновик) |
| CR-05 | `course.is_published = false`, `user.role = "author"`, `user.id ≠ course.author_id` | `false` | Некорректный (чужой автор) |
| CR-06 | `course.is_published = false`, `user.role = "student"`, `user.id = course.author_id` | `false` (роль не `"author"`) | Граничный |
| CR-07 | `course.is_published = false`, `user.role = "admin"` | `false` (admin не является исключением в коде) | Граничный |

---

## 14. Модуль `extractStepRefs` / `extractContextRefs`

**Файл**: [extractStepRefs.js](file:///c:/Users/Foxi8/diplom/web-trainer-platform/client/src/utils/extractStepRefs.js)  
**Контракт**: `extractStepRefs(text)` — извлекает номера шагов из паттерна `@step<N>`, возвращает массив уникальных чисел. `extractContextRefs(text, enabledTypes)` — извлекает ссылки всех типов (`step`, `quiz`, `solution`, `terminal`, `file`).

### `extractStepRefs`

| ID | Входные данные | Ожидаемый результат | Тип сценария |
|---|---|---|---|
| ES-01 | `"@step1 @step3"` | `[1, 3]` | Нормальный |
| ES-02 | `"@STEP2 explain @step2 again"` | `[2]` (дедупликация, регистронезависимость) | Граничный |
| ES-03 | `"why does this fail?"` | `[]` (нет ссылок) | Нормальный (нет совпадений) |
| ES-04 | `""` (пустая строка) | `[]` | Граничный |
| ES-05 | `null` | `[]` | Некорректный |
| ES-06 | `123` (число) | `[]` (не строка) | Некорректный |
| ES-07 | `"@step0"` | `[0]` (ноль — валидное число) | Граничный |
| ES-08 | `"@step999"` | `[999]` (большое число) | Граничный |
| ES-09 | `"@stepABC"` | `[]` (`\d+` не совпадает) | Некорректный |
| ES-10 | `"  "` (только пробелы) | `[]` (после trim — пусто) | Граничный |

### `extractContextRefs`

| ID | Входные данные | Ожидаемый результат | Тип сценария |
|---|---|---|---|
| EC-01 | `"@quiz2 @solution3 @terminal @file:utils.js"` | `{quiz:[2], solution:[3], terminal:[true], file:["utils.js"]}` | Нормальный |
| EC-02 | `"@step1"`, `enabledTypes = ["quiz"]` | `{}` (step не включён) | Граничный |
| EC-03 | `"@quiz1 @quiz1"` | `{quiz:[1]}` (дедупликация) | Граничный |
| EC-04 | `"@file:path/to/deep/file.ts"` | `{file:["path/to/deep/file.ts"]}` | Нормальный |
| EC-05 | `"@terminal text @terminal"` | `{terminal:[true]}` (дедупликация `true`) | Граничный |

---

## 15. Модуль `buildLessonSummaryContext`

**Файл**: [aiContextBuilders.js](file:///c:/Users/Foxi8/diplom/web-trainer-platform/client/src/utils/aiContextBuilders.js#L44-L58)  
**Контракт**: Принимает `lesson` (объект с `title`) и `sortedBlocks` (массив блоков). Возвращает строку-резюме урока. Если `lesson` falsy — возвращает заглушку. Использует `block.title || block.content || "Шаг N"` для названия каждого шага.

| ID | Входные данные | Ожидаемый результат | Тип сценария |
|---|---|---|---|
| BL-01 | `lesson = {title: "JS Basics"}`, `sortedBlocks = [{title:"Vars"}, {title:"Funcs"}]` | Содержит `"Урок: JS Basics"`, `"1. Vars"`, `"2. Funcs"` | Нормальный |
| BL-02 | `lesson = null` | `"Контекст урока пока недоступен."` | Граничный |
| BL-03 | `lesson = {title: "X"}`, `sortedBlocks = []` | Содержит `"Шаги пока не добавлены."` | Граничный |
| BL-04 | `sortedBlocks = [{title:"", content:"Do this"}]` | Содержит `"1. Do this"` (fallback на `content`) | Граничный |
| BL-05 | `sortedBlocks = [{title:"", content:""}]` | Содержит `"1. Шаг 1"` (двойной fallback) | Граничный |

---

## 16. Модуль `buildStepsContext`

**Файл**: [aiContextBuilders.js](file:///c:/Users/Foxi8/diplom/web-trainer-platform/client/src/utils/aiContextBuilders.js#L106-L140)  
**Контракт**: Принимает `{text, sortedBlocks, solutions, submissionState}`. Извлекает `@step<N>` из `text`. Для каждого найденного шага собирает детализированный контекст. Возвращает `null` если ссылок нет.

| ID | Входные данные | Ожидаемый результат | Тип сценария |
|---|---|---|---|
| BS-01 | `text: "@step1"`, блок с `id:10, type:"practice"`, `solutions: {10: "code()"}` | Массив с одним объектом, `studentCode: "code()"` | Нормальный |
| BS-02 | `text: "help me"` (нет `@step`) | `null` | Граничный |
| BS-03 | `text: "@step99"`, блоков всего 2 | `null` (степ не найден, результат фильтруется) | Граничный |
| BS-04 | `text: "@step1"`, блок `type:"lecture"` | `studentCode: null` (не code-блок) | Нормальный |
| BS-05 | `text: "@step1"`, `solutions: {}`, блок с `quiz_data.placeholder_code = "fn(){}"` | `studentCode: "fn(){}"` (fallback на placeholder) | Граничный |
| BS-06 | `text: "@step1"`, `submissionState: {10: {submission: {status:"failed", result_message:"Error"}}}` | `submissionStatus: "failed"`, `submissionMessage: "Error"` | Нормальный |
| BS-07 | `text: "@step1"`, `submissionState: {10: {error: "Network error"}}` | `submissionStatus: "error"`, `submissionMessage: "Network error"` | Некорректный |

---

## 17. Модуль `getFailedTests`

**Файл**: [aiContextBuilders.js](file:///c:/Users/Foxi8/diplom/web-trainer-platform/client/src/utils/aiContextBuilders.js#L28-L42)  
**Контракт**: Принимает объект `submission`. Извлекает `submission.tests_result.details` (массив). Фильтрует `!test.passed`. Для скрытых тестов (`is_hidden`) обнуляет `input`, `expected`, `actual`.

| ID | Входные данные | Ожидаемый результат | Тип сценария |
|---|---|---|---|
| GF-01 | `{tests_result: {details: [{passed:false, input:"1", expected:"2", actual:"3", exit_code:1}]}}` | `[{testNumber:1, input:"1", expected:"2", actual:"3", exitCode:1, isHidden:false}]` | Нормальный |
| GF-02 | `{tests_result: {details: [{passed:true, input:"1"}]}}` | `[]` (все прошли) | Нормальный |
| GF-03 | `null` | `[]` | Некорректный |
| GF-04 | `{tests_result: null}` | `[]` | Некорректный |
| GF-05 | `{tests_result: {details: "not_array"}}` | `[]` (`!Array.isArray`) | Некорректный |
| GF-06 | `{tests_result: {details: [{passed:false, is_hidden:true, input:"secret", expected:"x", actual:"y"}]}}` | `[{testNumber:1, input:null, expected:null, actual:null, exitCode:null, isHidden:true}]` | Граничный (скрытый тест) |
| GF-07 | `{tests_result: {details: [{passed:false}, {passed:false}]}}` | `[{testNumber:1, ...}, {testNumber:2, ...}]` (нумерация с 1) | Нормальный |

---

## 18. Модуль `serializeStepsContext`

**Файл**: [promptBuilder.js](file:///c:/Users/Foxi8/diplom/web-trainer-platform/server/src/modules/promptBuilder.js#L73-L100)  
**Контракт**: Принимает массив шагов или один объект шага. Сериализует в текстовый формат с разделителями `=== STEP N ===`. Пустые/null-поля пропускаются.

| ID | Входные данные | Ожидаемый результат | Тип сценария |
|---|---|---|---|
| SS-01 | `{stepNumber:2, title:"Loops", language:"javascript", task:"Print", studentCode:"for...", submissionStatus:"passed"}` | Содержит `"=== STEP 2 ==="`, `"Title: Loops"`, ` ``` javascript`, `"Submission status: passed"` | Нормальный |
| SS-02 | `[step1, step2]` (массив из двух шагов) | Два блока, разделённые `\n\n` | Нормальный |
| SS-03 | `{stepNumber:undefined}` | Содержит `"=== STEP ? ==="` | Граничный |
| SS-04 | `{stepNumber:1, title:"", language:null, task:null}` | Содержит только `"=== STEP 1 ==="`, без пустых полей | Граничный |
| SS-05 | `null` | `""` (фильтрация `.filter(Boolean)`) | Некорректный |

---

## 19. Модуль `buildPrompt`

**Файл**: [promptBuilder.js](file:///c:/Users/Foxi8/diplom/web-trainer-platform/server/src/modules/promptBuilder.js#L109-L137)  
**Контракт**: Собирает итоговый массив сообщений для LLM. Порядок: system → lessonContext (как user) → stepsContext (как user) → chatHistory → userInput.

| ID | Входные данные | Ожидаемый результат | Тип сценария |
|---|---|---|---|
| BP-01 | Все поля заполнены, `chatHistory` из 2 сообщений, `stepsContext` с 1 шагом | Массив из 5 элементов: system + lesson + steps + 2 history + userInput | Нормальный |
| BP-02 | `lessonContext = null`, `stepsContext = null`, `chatHistory = []` | Массив из 2 элементов: system + userInput | Граничный (минимальный набор) |
| BP-03 | `lessonContext = "Draft"`, `stepsContext = null` | Массив из 3 элементов: system + lesson + userInput | Нормальный |
| BP-04 | `chatHistory` содержит `system`-сообщение | `system`-сообщение из истории отфильтровано `normalizeMessages` | Граничный (prompt injection) |
| BP-05 | `chatHistory` из 15 сообщений | Только последние 10 из истории попадают в результат | Граничный |

---

## 20. Модуль валидации `POST /api/auth/register`

**Файл**: [authRoutes.js](file:///c:/Users/Foxi8/diplom/web-trainer-platform/server/src/routes/authRoutes.js#L47-L86)  
**Контракт**: Обязательные поля: `name`, `email`, `password`, `role`. Допустимые роли: `"student"`, `"author"`. Email должен быть уникальным.

| ID | Входные данные | Ожидаемый результат | Тип сценария |
|---|---|---|---|
| RG-01 | `{name:"User", email:"u@e.com", password:"123456", role:"student"}` | `status 201`, `{token, user}` | Нормальный |
| RG-02 | `{name:"", email:"u@e.com", password:"123456", role:"student"}` | `status 400`, `"Name, email, password, and role are required"` | Некорректный |
| RG-03 | `{name:"User", email:"u@e.com", password:"123456", role:"admin"}` | `status 400`, `"Role must be student or author"` | Некорректный (недопустимая роль) |
| RG-04 | `{name:"User", email:"u@e.com", password:"123456", role:"student"}`, email уже существует | `status 409`, `"User with this email already exists"` | Граничный |
| RG-05 | `{}` (пустой объект) | `status 400`, `"Name, email, password, and role are required"` | Некорректный |
| RG-06 | `{name:"User", email:"u@e.com", password:"123456", role:"author"}` | `status 201`, роль в ответе — `"author"` | Нормальный |

---

## 21. Модуль валидации `PUT /api/auth/me/password`

**Файл**: [authRoutes.js](file:///c:/Users/Foxi8/diplom/web-trainer-platform/server/src/routes/authRoutes.js#L235-L281)  
**Контракт**: Обязательные поля: `currentPassword`, `newPassword`. Новый пароль ≥ 6 символов. Новый пароль должен отличаться от текущего. Текущий пароль должен быть верным.

| ID | Входные данные | Ожидаемый результат | Тип сценария |
|---|---|---|---|
| PW-01 | `{currentPassword:"oldpass", newPassword:"newpass123"}`, пароль верный | `status 200`, `"Password updated successfully"` | Нормальный |
| PW-02 | `{currentPassword:"", newPassword:"newpass123"}` | `status 400`, `"Current and new passwords are required"` | Некорректный |
| PW-03 | `{currentPassword:"oldpass", newPassword:"12345"}` (5 символов) | `status 400`, `"New password must be at least 6 characters long"` | Граничный (ниже нижней границы) |
| PW-04 | `{currentPassword:"oldpass", newPassword:"123456"}` (6 символов) | `status 200` (при верном пароле) | Граничный (нижняя граница) |
| PW-05 | `{currentPassword:"samepass", newPassword:"samepass"}` | `status 400`, `"New password must be different from current password"` | Граничный |
| PW-06 | `{currentPassword:"wrong", newPassword:"newpass123"}` | `status 401`, `"Current password is incorrect"` | Некорректный |
| PW-07 | `{currentPassword:"oldpass"}` (нет `newPassword`) | `status 400`, `"Current and new passwords are required"` | Некорректный |

---

## 22. Модуль валидации `POST /api/blocks/:blockId/submissions`

**Файл**: [courseRoutes.js](file:///c:/Users/Foxi8/diplom/web-trainer-platform/server/src/routes/courseRoutes.js#L455-L549)  
**Контракт**: Обязательные поля: `code` (непустая строка после trim). `language` по умолчанию `"javascript"`. Блок должен существовать, иметь тип `"practice"` или `"test"`, курс должен быть опубликован.

| ID | Входные данные | Ожидаемый результат | Тип сценария |
|---|---|---|---|
| SB-01 | `{code:"function f(){}", language:"javascript"}`, блок `type:"practice"`, курс опубликован | `status 201`, `{submission}` | Нормальный |
| SB-02 | `{code:""}` | `status 400`, `"Solution code is required"` | Некорректный |
| SB-03 | `{code:"   "}` (только пробелы) | `status 400`, `"Solution code is required"` (после trim — пусто) | Граничный |
| SB-04 | `:blockId = 0` | `status 400`, `"Invalid block id"` (`Number(0)` → falsy) | Граничный |
| SB-05 | `:blockId = "abc"` | `status 400`, `"Invalid block id"` (`Number("abc")` = `NaN`) | Некорректный |
| SB-06 | Блок не найден | `status 404`, `"Lesson block not found"` | Некорректный |
| SB-07 | Блок `type:"lecture"` | `status 400`, `"Solutions can be submitted only for practice or test blocks"` | Некорректный |
| SB-08 | Курс не опубликован | `status 403`, `"You do not have access to this lesson block"` | Некорректный |
| SB-09 | `{code:"x"}` (без `language`) | `language` по умолчанию `"javascript"` | Граничный |

---

## 23. Модуль валидации `POST /api/blocks/:blockId/submit` (Quiz)

**Файл**: [courseRoutes.js](file:///c:/Users/Foxi8/diplom/web-trainer-platform/server/src/routes/courseRoutes.js#L551-L641)  
**Контракт**: Принимает `answers` (массив индексов). Проверяет правильность ответа, записывает попытку. Повторная отправка уже пройденного квиза — ошибка 400. Отсутствие вариантов — ошибка 400.

| ID | Входные данные | Ожидаемый результат | Тип сценария |
|---|---|---|---|
| QZ-01 | Single choice: `answers: [1]`, правильный индекс | `status 201`, `is_correct: true`, `hint: null` | Нормальный |
| QZ-02 | Single choice: `answers: [0]`, неправильный индекс с hint | `status 201`, `is_correct: false`, `hint: "Hint 1"` | Нормальный |
| QZ-03 | Multiple choice: `answers: [0, 2]`, оба правильных | `status 201`, `is_correct: true` | Нормальный |
| QZ-04 | Multiple choice: `answers: [0, 1]`, один правильный и один неправильный | `status 201`, `is_correct: false`, `hint` от неправильного варианта | Нормальный |
| QZ-05 | `answers: []` (пустой массив) | `status 201`, `is_correct: false`, `hint: "Ваш ответ неверный..."` | Граничный |
| QZ-06 | Квиз уже пройден (passedCheck.rowCount > 0) | `status 400`, `"You have already completed this quiz"` | Граничный |
| QZ-07 | Блок без quiz_data.options (пустой массив) | `status 400`, `"This block does not contain a valid quiz"` | Некорректный |
| QZ-08 | Блок не найден | `status 404`, `"Lesson block not found"` | Некорректный |
| QZ-09 | `answers: "not array"` (не массив) | Преобразуется в `[]`, `is_correct: false` | Некорректный |
| QZ-10 | Неправильный ответ без hint у варианта | `hint: "Ваш ответ неверный. Попробуйте еще раз."` (фоллбэк) | Граничный |

---

## 24. Модуль `apiRequest` (клиент)

**Файл**: [api.js](file:///c:/Users/Foxi8/diplom/web-trainer-platform/client/src/lib/api.js#L3-L21)  
**Контракт**: Выполняет `fetch` по `API_URL + path`. Автоматически добавляет `Content-Type: application/json`. Если `response.ok === false` — бросает `Error` с `data.message` или `"Request failed"`.

| ID | Входные данные | Ожидаемый результат | Тип сценария |
|---|---|---|---|
| AR-01 | `path="/api/test"`, сервер возвращает `{ok:true, data:{id:1}}` | Возвращает `{id:1}` | Нормальный |
| AR-02 | Сервер возвращает `status:400`, `body:{message:"Bad request"}` | `throw Error("Bad request")` | Некорректный |
| AR-03 | Сервер возвращает `status:500`, `body:{}` (без `message`) | `throw Error("Request failed")` (фоллбэк) | Граничный |
| AR-04 | Сервер возвращает невалидный JSON | `data = {}` (`.json().catch(() => ({}))`) | Граничный |
| AR-05 | `options.headers = {Authorization: "Bearer token"}` | Мержится с `Content-Type: application/json` | Нормальный |

---

## 25. Модуль `getAuthHeaders` (клиент)

**Файл**: [auth.js](file:///c:/Users/Foxi8/diplom/web-trainer-platform/client/src/lib/auth.js#L15-L18)  
**Контракт**: Если `localStorage` содержит `auth_token` — возвращает `{Authorization: "Bearer <token>"}`. Иначе — пустой объект `{}`.

| ID | Входные данные | Ожидаемый результат | Тип сценария |
|---|---|---|---|
| AH-01 | `localStorage` содержит `auth_token = "abc123"` | `{Authorization: "Bearer abc123"}` | Нормальный |
| AH-02 | `localStorage` не содержит `auth_token` | `{}` | Граничный |

---

## 26. Модуль `buildAttachmentDownloadUrl`

**Файл**: [attachmentService.js](file:///c:/Users/Foxi8/diplom/web-trainer-platform/server/src/services/attachmentService.js#L62-L64)  
**Контракт**: Принимает `storedName`. Возвращает `/api/attachments/${encodeURIComponent(storedName)}`.

| ID | Входные данные | Ожидаемый результат | Тип сценария |
|---|---|---|---|
| BU-01 | `"abc-123.pdf"` | `"/api/attachments/abc-123.pdf"` | Нормальный |
| BU-02 | `"file name.pdf"` (пробел в имени) | `"/api/attachments/file%20name.pdf"` | Граничный |
| BU-03 | `"файл.pdf"` (кириллица) | `"/api/attachments/%D1%84%D0%B0%D0%B9%D0%BB.pdf"` | Граничный |

---

## 27. Валидация на клиенте: `DashboardPage` (смена пароля)

**Файл**: [DashboardPage.jsx](file:///c:/Users/Foxi8/diplom/web-trainer-platform/client/src/pages/DashboardPage.jsx#L159-L200)  
**Контракт**: Клиентская валидация перед отправкой: текущий пароль обязателен, новый пароль ≥ 6 символов, новый пароль ≠ текущий, новый пароль = подтверждение.

| ID | Входные данные | Ожидаемый результат | Тип сценария |
|---|---|---|---|
| DP-01 | `currentPassword=""` | toast `"Введите текущий пароль."`, запрос не отправлен | Некорректный |
| DP-02 | `newPassword = "12345"` (5 символов) | toast `"Новый пароль должен быть не менее 6 символов."` | Граничный (ниже нижней границы) |
| DP-03 | `newPassword = "123456"` (6 символов) | Запрос отправлен (при остальных условиях валидных) | Граничный (нижняя граница) |
| DP-04 | `currentPassword = newPassword` | toast `"Новый пароль должен отличаться от старого."` | Граничный |
| DP-05 | `newPassword ≠ confirmPassword` | toast `"Пароли не совпадают."` | Некорректный |
| DP-06 | Все валидно | Запрос `PUT /api/auth/me/password` отправлен | Нормальный |

---

## 28. Валидация на клиенте: `DashboardPage` (API-ключ и Folder ID)

**Файл**: [DashboardPage.jsx](file:///c:/Users/Foxi8/diplom/web-trainer-platform/client/src/pages/DashboardPage.jsx#L9-L17)  
**Контракт**: Дублирует серверную валидацию `isValidUserLlmApiKey` (20–300, без пробелов) и `isValidUserLlmFolderId` (6–128, `/^[A-Za-z0-9_-]+$/`).

| ID | Входные данные | Ожидаемый результат | Тип сценария |
|---|---|---|---|
| DC-01 | API-ключ `"too short"` (9 символов) | toast с ошибкой, `apiRequest` не вызван | Некорректный |
| DC-02 | API-ключ `"a".repeat(20)` (20 символов) | `apiRequest` вызван с `PUT /api/auth/me/api-key` | Граничный (нижняя граница) |
| DC-03 | Folder ID `"ab@cd"` (спецсимволы) | toast с ошибкой, `apiRequest` не вызван | Некорректный |
| DC-04 | Folder ID `"abcdef"` (6 символов) | `apiRequest` вызван с `PUT /api/auth/me/folder-id` | Граничный (нижняя граница) |
| DC-05 | Folder ID `"abcde"` (5 символов) | toast с ошибкой, запрос не отправлен | Граничный (ниже нижней границы) |
