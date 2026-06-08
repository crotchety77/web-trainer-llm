import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { config } from "../config.js";
import { pool } from "../db.js";
import { app } from "../app.js";

vi.mock("../db.js", () => ({
  pool: {
    query: vi.fn()
  }
}));

function createToken(payload) {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: "1h" });
}

describe("course routes", () => {
  beforeEach(() => {
    pool.query.mockReset();
  });

  it("returns lessons for a published course", async () => {
    pool.query
      .mockResolvedValueOnce({
        rows: [
          {
            id: 3,
            author_id: 2,
            title: "JavaScript Basics",
            short_description: "",
            intro_content: "",
            cover_image_url: "",
            tags_json: [],
            is_published: true,
            author_name: "Author"
          }
        ]
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 10,
            course_id: 3,
            title: "Intro",
            position: 1
          }
        ]
      });

    const response = await request(app).get("/api/courses/3/lessons");

    expect(response.status).toBe(200);
    expect(response.body.lessons).toHaveLength(1);
    expect(response.body.lessons[0].title).toBe("Intro");
  });

  it("returns lesson blocks ordered by course route query", async () => {
    pool.query
      .mockResolvedValueOnce({
        rows: [
          {
            id: 10,
            course_id: 3,
            title: "Intro",
            position: 1,
            author_id: 2,
            is_published: true,
            course_title: "JavaScript Basics"
          }
        ]
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 101,
            lesson_id: 10,
            type: "lecture",
            title: "Theory",
            content: "Read theory",
            attachment_url: "",
            position: 1
          },
          {
            id: 102,
            lesson_id: 10,
            type: "practice",
            title: "Practice",
            content: "Write code",
            attachment_url: "",
            position: 1
          }
        ]
      });

    const token = createToken({
      id: 7,
      email: "student@example.com",
      role: "student"
    });

    const response = await request(app)
      .get("/api/lessons/10")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.lesson.blocks.map((block) => block.type)).toEqual(["lecture", "practice"]);
  });

  it("forbids access to an unpublished lesson for non-authors", async () => {
    pool.query.mockResolvedValueOnce({
      rows: [
        {
          id: 10,
          course_id: 3,
          title: "Draft lesson",
          position: 1,
          author_id: 2,
          is_published: false,
          course_title: "Draft course"
        }
      ]
    });

    const token = createToken({
      id: 7,
      email: "student@example.com",
      role: "student"
    });

    const response = await request(app)
      .get("/api/lessons/10")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(response.body.message).toBe("You do not have access to this lesson");
  });

  it("creates a solution submission for an authorized student", async () => {
    const token = createToken({
      id: 7,
      email: "student@example.com",
      role: "student"
    });

    pool.query
      .mockResolvedValueOnce({
        rows: [
          {
            id: 102,
            lesson_id: 10,
            type: "practice",
            title: "Practice",
            course_id: 3,
            author_id: 2,
            is_published: true
          }
        ]
      })
      .mockResolvedValueOnce({
        rows: []
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            student_id: 7,
            block_id: 102,
            code: "function solve() { return true; }",
            language: "javascript",
            status: "accepted",
            result_message: "Solution submitted successfully. No automated tests configured.",
            tests_result: {
              total: 1,
              passed: 1,
              failed: 0
            }
          }
        ]
      });

    const response = await request(app)
      .post("/api/blocks/102/submissions")
      .set("Authorization", `Bearer ${token}`)
      .send({
        code: "function solve() { return true; }",
        language: "javascript"
      });

    expect(response.status).toBe(201);
    expect(response.body.submission.status).toBe("accepted");
    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO submissions"), [
      7,
      102,
      "function solve() { return true; }",
      "javascript",
      "accepted",
      "Solution submitted successfully. No automated tests configured.",
      JSON.stringify({
        total: 1,
        passed: 1,
        failed: 0
      })
    ]);
  });

  it("rejects empty solution code", async () => {
    const token = createToken({
      id: 7,
      email: "student@example.com",
      role: "student"
    });

    const response = await request(app)
      .post("/api/blocks/102/submissions")
      .set("Authorization", `Bearer ${token}`)
      .send({ code: "   " });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Solution code is required");
    expect(pool.query).not.toHaveBeenCalled();
  });

  it("requires authentication for solution submission", async () => {
    const response = await request(app)
      .post("/api/blocks/102/submissions")
      .send({ code: "function solve() { return true; }" });

    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Authorization token is required");
  });
});
