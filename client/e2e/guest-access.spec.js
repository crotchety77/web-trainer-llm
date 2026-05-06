import { expect, test } from "@playwright/test";

test.describe("Guest Access Restrictions", () => {
  test.beforeEach(async ({ page }) => {
    // Используем паттерн **/* для перехвата запросов вне зависимости от хоста
    await page.route("**/api/auth/me", async (route) => {
      await route.fulfill({
        status: 401,
        json: { message: "Authorization token is required" }
      });
    });

    // Мокаем запрос к уроку, чтобы он гарантированно возвращал 401 для гостя
    // Это спровоцирует логику редиректа на клиенте
    await page.route("**/api/lessons/*", async (route) => {
      await route.fulfill({
        status: 401,
        json: { message: "Authorization token is required" }
      });
    });
  });

  test("redirects unauthenticated users from learn page to login", async ({ page }) => {
    // Пытаемся зайти напрямую на страницу урока
    await page.goto("/learn/3/10");
    
    // Ожидаем, что хук useAuthUser({ required: true }) перенаправит гостя на страницу логина
    await expect(page).toHaveURL(/\/login/);
  });

  test("shows disabled lesson links and login prompt on course details page", async ({ page }) => {
    // Перехватываем информацию о курсе универсальным паттерном
    await page.route("**/api/courses/3", async (route) => {
      if (route.request().url().endsWith("/api/courses/3")) {
        await route.fulfill({
          json: {
            course: {
              id: 3,
              title: "JavaScript Basics",
              short_description: "Learn JS from scratch.",
              lessons: [
                {
                  id: 10,
                  position: 1,
                  title: "Intro"
                }
              ]
            }
          }
        });
      } else {
        await route.continue();
      }
    });

    // Заходим на страницу описания курса
    await page.goto("/courses/3");

    // Проверяем, что отображается заголовок курса. Используем level: 1
    // чтобы избежать конфликта с тегом h2, содержащим такой же текст.
    await expect(page.getByRole("heading", { name: "JavaScript Basics", level: 1 })).toBeVisible();

    // Проверяем, что урок отображается, но заблокирован (имеет title "Log in to access lesson")
    const disabledLesson = page.getByTitle("Log in to access lesson");
    await expect(disabledLesson).toBeVisible();
    await expect(disabledLesson).toHaveText(/1\.\s+Intro/);

    // Проверяем наличие текста-подсказки с призывом авторизоваться
    const loginPrompt = page.locator("p.helper-text", { hasText: "to start learning" });
    await expect(loginPrompt).toBeVisible();
  });
});