/**
 * Модульные тесты: ролевая модель доступа (RBAC).
 *
 * Тестируемый middleware: requireRole
 * 
 * Цель тестов — убедиться, что:
 * - доступ предоставляется только пользователям с разрешёнными ролями (author, student, admin);
 * - неавторизованные пользователи (без токена) получают ошибку 401;
 * - авторизованные пользователи без нужной роли (например, student пытается получить доступ к ресурсам author) получают ошибку 403;
 * - администратор (admin) не имеет неявного доступа ко всем ресурсам, если это не указано явно (принцип наименьших привилегий).
 */
import { describe, expect, it, vi } from "vitest";
import { requireRole } from "./authMiddleware.js";

// Вспомогательная функция для имитации Express request, response, next
function createMockContext(user = null) {
  const request = { user };
  const response = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    }
  };
  const next = vi.fn();
  return { request, response, next };
}

describe("requireRole()", () => {
  it("RR-01: разрешает доступ, если роль пользователя совпадает с требуемой", () => {
    // Пользователь имеет роль "author", требуемая роль - "author" -> доступ разрешён
    const { request, response, next } = createMockContext({ id: 1, role: "author" });
    requireRole("author")(request, response, next);

    expect(next).toHaveBeenCalled();
    expect(response.statusCode).toBeNull();
  });

  it("RR-02: запрещает доступ (403), если роль не совпадает", () => {
    // Студент пытается получить доступ к маршруту автора
    const { request, response, next } = createMockContext({ id: 1, role: "student" });
    requireRole("author")(request, response, next);

    expect(next).not.toHaveBeenCalled();
    expect(response.statusCode).toBe(403);
    expect(response.body.message).toBe("You do not have access to this action");
  });

  it("RR-03: возвращает 401, если пользователь не авторизован (нет токена)", () => {
    const { request, response, next } = createMockContext(null);
    requireRole("student", "admin")(request, response, next);

    expect(next).not.toHaveBeenCalled();
    expect(response.statusCode).toBe(401);
    expect(response.body.message).toBe("Authorization token is required");
  });

  it("RR-04: разрешает доступ, если роль входит в список допустимых", () => {
    // Маршрут разрешён для student, author и admin
    const { request, response, next } = createMockContext({ id: 1, role: "admin" });
    requireRole("student", "author", "admin")(request, response, next);

    expect(next).toHaveBeenCalled();
    expect(response.statusCode).toBeNull();
  });

  it("RR-05: запрещает доступ admin, если маршрут только для author", () => {
    // Проверка принципа наименьших привилегий: admin не имеет доступа по умолчанию
    const { request, response, next } = createMockContext({ id: 1, role: "admin" });
    requireRole("author")(request, response, next);

    expect(next).not.toHaveBeenCalled();
    expect(response.statusCode).toBe(403);
  });
});
