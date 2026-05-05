import { expect, test } from "@playwright/test";

test("student reads a lesson and submits a solution", async ({ page }) => {
  await page.route("http://localhost:5000/api/auth/me", async (route) => {
    await route.fulfill({
      json: {
        user: {
          id: 7,
          name: "Student",
          email: "student@example.com",
          role: "student"
        }
      }
    });
  });

  await page.route("http://localhost:5000/api/courses/3/lessons", async (route) => {
    await route.fulfill({
      json: {
        lessons: [
          {
            id: 10,
            course_id: 3,
            title: "Intro",
            position: 1
          }
        ]
      }
    });
  });

  await page.route("http://localhost:5000/api/lessons/10", async (route) => {
    await route.fulfill({
      json: {
        lesson: {
          id: 10,
          course_id: 3,
          course_title: "JavaScript Basics",
          title: "Intro",
          position: 1,
          blocks: [
            {
              id: 101,
              lesson_id: 10,
              type: "lecture",
              title: "Theory",
              content: "Read this theory first.",
              attachment_url: "",
              position: 1
            },
            {
              id: 102,
              lesson_id: 10,
              type: "practice",
              title: "Write code",
              content: "Return true from solve.",
              attachment_url: "",
              position: 1
            }
          ]
        }
      }
    });
  });

  await page.route("http://localhost:5000/api/blocks/102/submissions", async (route) => {
    await route.fulfill({
      status: 201,
      json: {
        submission: {
          id: 1,
          status: "accepted",
          result_message: "Solution submitted successfully.",
          tests_result: {
            total: 1,
            passed: 1,
            failed: 0
          }
        }
      }
    });
  });

  await page.addInitScript(() => {
    localStorage.setItem("auth_token", "test-token");
  });

  await page.goto("/learn/3/10");

  await expect(page.getByRole("heading", { name: "JavaScript Basics" })).toBeVisible();
  await expect(page.getByText("Read this theory first.")).toBeVisible();
  await page.getByLabel("Solution code for Write code").fill("function solve() { return true; }");
  await page.getByRole("button", { name: "Submit solution" }).click();

  await expect(page.getByText("Solution submitted successfully.")).toBeVisible();
});
