import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import courseRoutes from "../src/routes/courseRoutes.js";
import { pool } from "../src/db.js";

// Мокаем базу данных
vi.mock("../src/db.js", () => ({
  pool: {
    query: vi.fn(),
  },
}));

// Мокаем middleware авторизации (симулируем залогиненного студента)
vi.mock("../src/middleware/authMiddleware.js", () => ({
  authMiddleware: (req, res, next) => {
    req.user = { id: 1, role: "student" };
    next();
  },
  optionalAuthMiddleware: (req, res, next) => next(),
  requireRole: () => (req, res, next) => next(),
}));

const app = express();
app.use(express.json());
app.use("/api", courseRoutes);

describe("Quiz Submissions API (POST /api/blocks/:blockId/submit)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  const mockBlockSingle = {
    id: 100, lesson_id: 10, type: "test", course_id: 5, is_published: true,
    quiz_data: {
      quiz_type: "single",
      options: [
        { text: "Wrong 1", is_correct: false, hint: "Hint 1" },
        { text: "Correct", is_correct: true, hint: "" },
        { text: "Wrong 2", is_correct: false, hint: "Hint 2" }
      ]
    }
  };

  const mockBlockMultiple = {
    id: 101, lesson_id: 10, type: "test", course_id: 5, is_published: true,
    quiz_data: {
      quiz_type: "multiple",
      options: [
        { text: "Correct 1", is_correct: true, hint: "" },
        { text: "Wrong", is_correct: false, hint: "Hint for multiple" },
        { text: "Correct 2", is_correct: true, hint: "" }
      ]
    }
  };

  it("1. [Unit/API] Single choice: правильный ответ -> passed", async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [mockBlockSingle] }) // getBlockWithCourse
      .mockResolvedValueOnce({ rowCount: 0 }) // passedCheck
      .mockResolvedValueOnce({ rows: [{ id: 1, is_correct: true }] }) // insert attempt
      .mockResolvedValueOnce({ rowCount: 1 }); // insert progress

    const response = await request(app)
      .post("/api/blocks/100/submit")
      .send({ answers: [1] }); // Индекс правильного ответа (второй вариант)

    expect(response.status).toBe(201);
    expect(response.body.attempt.is_correct).toBe(true);
    expect(response.body.hint).toBeNull();
    
    // Проверяем, что прогресс (completed) записался в БД
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO user_course_progress"),
      expect.any(Array)
    );
  });

  it("2. [Unit/API] Single choice: неправильный ответ -> failed + hint", async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [mockBlockSingle] }) 
      .mockResolvedValueOnce({ rowCount: 0 }) 
      .mockResolvedValueOnce({ rows: [{ id: 2, is_correct: false }] }); // insert attempt

    const response = await request(app)
      .post("/api/blocks/100/submit")
      .send({ answers: [0] }); // Выбрали первый неверный ответ

    expect(response.status).toBe(201);
    expect(response.body.attempt.is_correct).toBe(false);
    expect(response.body.hint).toBe("Hint 1");
    
    // Проверяем, что прогресс НЕ записался
    expect(pool.query).not.toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO user_course_progress"),
      expect.any(Array)
    );
  });

  it("3. [Unit/API] Multiple choice: частично правильные -> failed + hint для ошибки", async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [mockBlockMultiple] }) 
      .mockResolvedValueOnce({ rowCount: 0 }) 
      .mockResolvedValueOnce({ rows: [{ id: 3, is_correct: false }] }); 

    const response = await request(app)
      .post("/api/blocks/101/submit")
      .send({ answers: [0, 1] }); // Выбрали правильный (0) и неправильный (1)

    expect(response.status).toBe(201);
    expect(response.body.attempt.is_correct).toBe(false);
    expect(response.body.hint).toBe("Hint for multiple"); // Подсказка ответа 1
  });

  it("4. [Validation] Пустой ответ (нет массива) -> failed", async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [mockBlockSingle] }) 
      .mockResolvedValueOnce({ rowCount: 0 }) 
      .mockResolvedValueOnce({ rows: [{ id: 4, is_correct: false }] }); 

    const response = await request(app)
      .post("/api/blocks/100/submit")
      .send({ answers: [] }); // Пустой массив ответов

    expect(response.status).toBe(201);
    expect(response.body.attempt.is_correct).toBe(false);
    expect(response.body.hint).toBe("Ваш ответ неверный. Попробуйте еще раз.");
  });

  it("5. [DB Rule] Попытка ответить на уже сданный блок -> ошибка (400)", async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [mockBlockSingle] }) // Блок найден
      .mockResolvedValueOnce({ rowCount: 1 }); // passedCheck вернул запись (уже сдано!)

    const response = await request(app)
      .post("/api/blocks/100/submit")
      .send({ answers: [1] });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("You have already completed this quiz");
    
    // Убеждаемся, что попытка НЕ записывается в БД
    expect(pool.query).toHaveBeenCalledTimes(2); 
  });

  it("6. [API] 404 если блок не найден", async () => {
    pool.query.mockResolvedValueOnce({ rows: [] }); // Ничего не найдено

    const response = await request(app)
      .post("/api/blocks/999/submit")
      .send({ answers: [1] });

    expect(response.status).toBe(404);
    expect(response.body.message).toBe("Lesson block not found");
  });
});