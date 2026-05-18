import { Router } from "express";
import { pool } from "../db.js";
import {
  authMiddleware,
  optionalAuthMiddleware,
  requireRole
} from "../middleware/authMiddleware.js";
import { BLOCK_TYPE_ORDER } from "../constants/courseContent.js";
import {
  canReadCourse,
  fetchBlocksForLesson,
  fetchLessonsForCourse,
  getCourseById,
  getLessonWithCourse
} from "../services/courseService.js";

const router = Router();

function normalizeLessonPayload(body) {
  return {
    title: String(body.title || "").trim(),
    position: Number(body.position) || 1
  };
}

router.get("/courses/:courseId/lessons", optionalAuthMiddleware, async (request, response) => {
  const courseId = Number(request.params.courseId);

  if (!courseId) {
    return response.status(400).json({ message: "Invalid course id" });
  }

  try {
    const course = await getCourseById(courseId);

    if (!course) {
      return response.status(404).json({ message: "Course not found" });
    }

    if (!canReadCourse(course, request.user)) {
      return response.status(403).json({ message: "You do not have access to this course" });
    }

    const lessons = await fetchLessonsForCourse(courseId);
    return response.json({ lessons });
  } catch (error) {
    console.error("[lessons/list] Failed:", error.message);
    return response.status(500).json({ message: "Failed to fetch lessons" });
  }
});

router.post(
  "/courses/:courseId/lessons",
  authMiddleware,
  requireRole("author"),
  async (request, response) => {
    const courseId = Number(request.params.courseId);
    const payload = normalizeLessonPayload(request.body);

    if (!courseId) {
      return response.status(400).json({ message: "Invalid course id" });
    }

    if (!payload.title) {
      return response.status(400).json({ message: "Lesson title is required" });
    }

    try {
      const course = await getCourseById(courseId);

      if (!course) {
        return response.status(404).json({ message: "Course not found" });
      }

      if (course.author_id !== request.user.id) {
        return response.status(403).json({ message: "You can edit lessons only in your own course" });
      }

      const result = await pool.query(
        `INSERT INTO lessons (course_id, title, position)
         VALUES ($1, $2, $3)
         RETURNING id, course_id, title, position, created_at`,
        [courseId, payload.title, payload.position]
      );

      return response.status(201).json({ lesson: result.rows[0] });
    } catch (error) {
      console.error("[lessons/create] Failed:", error.message);
      return response.status(500).json({ message: "Failed to create lesson" });
    }
  }
);

router.get("/lessons/:id", authMiddleware, async (request, response) => {
  const lessonId = Number(request.params.id);

  if (!lessonId) {
    return response.status(400).json({ message: "Invalid lesson id" });
  }

  try {
    const lesson = await getLessonWithCourse(lessonId);

    if (!lesson) {
      return response.status(404).json({ message: "Lesson not found" });
    }

    if (
      !lesson.is_published &&
      !(request.user?.role === "author" && request.user.id === lesson.author_id)
    ) {
      return response.status(403).json({ message: "You do not have access to this lesson" });
    }

    const blocks = await fetchBlocksForLesson(lessonId, request.user.id);

    return response.json({
      lesson: {
        ...lesson,
        block_type_order: BLOCK_TYPE_ORDER,
        blocks
      }
    });
  } catch (error) {
    console.error("[lessons/detail] Failed:", error.message);
    return response.status(500).json({ message: "Failed to fetch lesson" });
  }
});

router.patch("/lessons/:id", authMiddleware, requireRole("author"), async (request, response) => {
  const lessonId = Number(request.params.id);
  const payload = normalizeLessonPayload(request.body);

  if (!lessonId) {
    return response.status(400).json({ message: "Invalid lesson id" });
  }

  if (!payload.title) {
    return response.status(400).json({ message: "Lesson title is required" });
  }

  try {
    const lesson = await getLessonWithCourse(lessonId);

    if (!lesson) {
      return response.status(404).json({ message: "Lesson not found" });
    }

    if (lesson.author_id !== request.user.id) {
      return response.status(403).json({ message: "You can edit only your own lessons" });
    }

    const result = await pool.query(
      `UPDATE lessons
       SET title = $1, position = $2
       WHERE id = $3
       RETURNING id, course_id, title, position, created_at`,
      [payload.title, payload.position, lessonId]
    );

    return response.json({ lesson: result.rows[0] });
  } catch (error) {
    console.error("[lessons/update] Failed:", error.message);
    return response.status(500).json({ message: "Failed to update lesson" });
  }
});

router.delete("/lessons/:id", authMiddleware, requireRole("author"), async (request, response) => {
  const lessonId = Number(request.params.id);

  if (!lessonId) {
    return response.status(400).json({ message: "Invalid lesson id" });
  }

  try {
    const lesson = await getLessonWithCourse(lessonId);

    if (!lesson) {
      return response.status(404).json({ message: "Lesson not found" });
    }

    if (lesson.author_id !== request.user.id) {
      return response.status(403).json({ message: "You can delete only your own lessons" });
    }

    await pool.query("DELETE FROM lessons WHERE id = $1", [lessonId]);

    return response.json({ message: "Lesson deleted successfully" });
  } catch (error) {
    console.error("[lessons/delete] Failed:", error.message);
    return response.status(500).json({ message: "Failed to delete lesson" });
  }
});

export default router;
