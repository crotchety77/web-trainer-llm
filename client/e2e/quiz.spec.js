import { expect, test } from "@playwright/test";

test.describe("Quiz UI Functionality", () => {
  test.beforeEach(async ({ page }) => {
    // 1. Мокаем пользователя
    await page.route("**/api/auth/me", async (route) => {
      await route.fulfill({
        json: { user: { id: 1, name: "Test Student", role: "student" } }
      });
    });

    // 2. Мокаем список уроков
    await page.route("**/api/courses/1/lessons", async (route) => {
      await route.fulfill({ json: { lessons: [{ id: 10, position: 1, title: "Quiz Lesson" }] } });
    });

    // 3. Мокаем сам урок с квизом внутри
    await page.route("**/api/lessons/10", async (route) => {
      await route.fulfill({
        json: {
          lesson: {
            id: 10, position: 1, title: "Quiz Lesson", course_title: "Test Course",
            blocks: [
              {
                id: 100, type: "test", title: "Check your knowledge", position: 1, content: "Which is true?",
                quiz_data: {
                  quiz_type: "single",
                  options: [
                    { text: "Wrong Option", is_correct: false, hint: "Not quite." },
                    { text: "Correct Option", is_correct: true, hint: "" }
                  ]
                },
                is_completed: false
              }
            ]
          }
        }
      });
    });
  });

  test("student can select option, submit, and see success state", async ({ page }) => {
    // Мокаем успешный ответ сервера при сабмите
    await page.route("**/api/blocks/100/submit", async (route) => {
      await route.fulfill({
        status: 201,
        json: { attempt: { is_correct: true }, hint: null }
      });
    });

    await page.goto("/learn/1/10");

    // Ждем рендера квиза
    await expect(page.locator("text=Опрос")).toBeVisible();

    // Выбираем правильный ответ
    await page.locator("text=Correct Option").click();
    await page.locator("button:has-text('Ответить')").click();

    // Проверяем появление зеленого алерта и класса завершенного блока
    await expect(page.locator("text=Правильный ответ!")).toBeVisible();
  });
});