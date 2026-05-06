import { Router } from "express";
import { pool } from "../db.js";
import {
  authMiddleware,
  optionalAuthMiddleware,
  requireRole
} from "../middleware/authMiddleware.js";

const router = Router();
const BLOCK_TYPE_ORDER = ["lecture", "practice", "test"];

function normalizeTags(input) {
  if (Array.isArray(input)) {
    return input
      .map((item) => String(item).trim())
      .filter(Boolean);
  }

  if (typeof input === "string") {
    return input
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function normalizeCoursePayload(body) {
  return {
    title: String(body.title || "").trim(),
    shortDescription: String(body.short_description || "").trim(),
    introContent: String(body.intro_content || "").trim(),
    coverImageUrl: String(body.cover_image_url || "").trim(),
    tagsJson: normalizeTags(body.tags_json || body.tags),
    isPublished: Boolean(body.is_published)
  };
}

function normalizeLessonPayload(body) {
  return {
    title: String(body.title || "").trim(),
    position: Number(body.position) || 1
  };
}

function normalizeBlockPayload(body) {
  return {
    type: String(body.type || "").trim(),
    title: String(body.title || "").trim(),
    content: String(body.content || "").trim(),
    attachmentUrl: String(body.attachment_url || "").trim(),
    position: Number(body.position) || 1
  };
}

async function getCourseById(courseId) {
  const result = await pool.query(
    `SELECT c.id, c.author_id, c.title, c.short_description, c.intro_content,
            c.cover_image_url, c.tags_json, c.is_published, c.created_at,
            u.name AS author_name
     FROM courses c
     JOIN users u ON u.id = c.author_id
     WHERE c.id = $1`,
    [courseId]
  );

  return result.rows[0] || null;
}

async function getLessonWithCourse(lessonId) {
  const result = await pool.query(
    `SELECT l.id, l.course_id, l.title, l.position, l.created_at,
            c.author_id, c.is_published, c.title AS course_title
     FROM lessons l
     JOIN courses c ON c.id = l.course_id
     WHERE l.id = $1`,
    [lessonId]
  );

  return result.rows[0] || null;
}

async function getBlockWithOwnership(blockId) {
  const result = await pool.query(
    `SELECT lb.id, lb.lesson_id, lb.type, lb.title, lb.content, lb.attachment_url,
            lb.position, l.course_id, c.author_id
     FROM lesson_blocks lb
     JOIN lessons l ON l.id = lb.lesson_id
     JOIN courses c ON c.id = l.course_id
     WHERE lb.id = $1`,
    [blockId]
  );

  return result.rows[0] || null;
}

async function getBlockWithCourse(blockId) {
  const result = await pool.query(
    `SELECT lb.id, lb.lesson_id, lb.type, lb.title, l.course_id,
            c.author_id, c.is_published, c.title AS course_title
     FROM lesson_blocks lb
     JOIN lessons l ON l.id = lb.lesson_id
     JOIN courses c ON c.id = l.course_id
     WHERE lb.id = $1`,
    [blockId]
  );

  return result.rows[0] || null;
}

function canReadCourse(course, user) {
  if (course.is_published) {
    return true;
  }

  return Boolean(user && user.role === "author" && user.id === course.author_id);
}

async function fetchLessonsForCourse(courseId) {
  const result = await pool.query(
    `SELECT id, course_id, title, position, created_at
     FROM lessons
     WHERE course_id = $1
     ORDER BY position ASC, id ASC`,
    [courseId]
  );

  return result.rows;
}

async function fetchBlocksForLesson(lessonId) {
  const result = await pool.query(
    `SELECT id, lesson_id, type, title, content, attachment_url, position, created_at
     FROM lesson_blocks
     WHERE lesson_id = $1
     ORDER BY
       CASE type
         WHEN 'lecture' THEN 1
         WHEN 'practice' THEN 2
         WHEN 'test' THEN 3
         ELSE 4
       END ASC,
       position ASC,
       id ASC`,
    [lessonId]
  );

  return result.rows;
}

async function isStudentEnrolled(studentId, courseId) {
  const result = await pool.query(
    "SELECT id FROM enrollments WHERE student_id = $1 AND course_id = $2",
    [studentId, courseId]
  );

  return result.rowCount > 0;
}

router.get("/courses", optionalAuthMiddleware, async (request, response) => {
  const search = String(request.query.search || "").trim().toLowerCase();
  const tag = String(request.query.tag || "").trim().toLowerCase();

  try {
    const result = await pool.query(
      `SELECT c.id, c.author_id, c.title, c.short_description, c.intro_content,
              c.cover_image_url, c.tags_json, c.is_published, c.created_at,
              u.name AS author_name,
              COUNT(l.id)::int AS lessons_count
       FROM courses c
       JOIN users u ON u.id = c.author_id
       LEFT JOIN lessons l ON l.course_id = c.id
       WHERE c.is_published = TRUE
       GROUP BY c.id, u.name
       ORDER BY c.created_at DESC, c.id DESC`
    );

    const courses = result.rows.filter((course) => {
      const matchesSearch =
        !search ||
        course.title.toLowerCase().includes(search) ||
        course.short_description.toLowerCase().includes(search);
      const matchesTag =
        !tag ||
        (Array.isArray(course.tags_json) &&
          course.tags_json.some((item) => String(item).toLowerCase().includes(tag)));

      return matchesSearch && matchesTag;
    });

    return response.json({ courses });
  } catch (error) {
    console.error("[courses/list] Failed:", error.message);
    return response.status(500).json({ message: "Failed to fetch courses" });
  }
});

router.get("/courses/:id", optionalAuthMiddleware, async (request, response) => {
  const courseId = Number(request.params.id);

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
    let isEnrolled = false;

    if (request.user?.role === "student") {
      isEnrolled = await isStudentEnrolled(request.user.id, courseId);
    }

    return response.json({
      course: {
        ...course,
        lessons,
        is_enrolled: isEnrolled
      }
    });
  } catch (error) {
    console.error("[courses/detail] Failed:", error.message);
    return response.status(500).json({ message: "Failed to fetch course" });
  }
});

router.post("/courses", authMiddleware, requireRole("author"), async (request, response) => {
  const payload = normalizeCoursePayload(request.body);

  if (!payload.title) {
    return response.status(400).json({ message: "Course title is required" });
  }

  try {
    const result = await pool.query(
      `INSERT INTO courses (
         author_id, title, short_description, intro_content, cover_image_url, tags_json, is_published
       )
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
       RETURNING id, author_id, title, short_description, intro_content, cover_image_url, tags_json, is_published, created_at`,
      [
        request.user.id,
        payload.title,
        payload.shortDescription,
        payload.introContent,
        payload.coverImageUrl,
        JSON.stringify(payload.tagsJson),
        payload.isPublished
      ]
    );

    return response.status(201).json({ course: result.rows[0] });
  } catch (error) {
    console.error("[courses/create] Failed:", error.message);
    return response.status(500).json({ message: "Failed to create course" });
  }
});

router.patch("/courses/:id", authMiddleware, requireRole("author"), async (request, response) => {
  const courseId = Number(request.params.id);
  const payload = normalizeCoursePayload(request.body);

  if (!courseId) {
    return response.status(400).json({ message: "Invalid course id" });
  }

  if (!payload.title) {
    return response.status(400).json({ message: "Course title is required" });
  }

  try {
    const course = await getCourseById(courseId);

    if (!course) {
      return response.status(404).json({ message: "Course not found" });
    }

    if (course.author_id !== request.user.id) {
      return response.status(403).json({ message: "You can edit only your own courses" });
    }

    const result = await pool.query(
      `UPDATE courses
       SET title = $1,
           short_description = $2,
           intro_content = $3,
           cover_image_url = $4,
           tags_json = $5::jsonb,
           is_published = $6
       WHERE id = $7
       RETURNING id, author_id, title, short_description, intro_content, cover_image_url, tags_json, is_published, created_at`,
      [
        payload.title,
        payload.shortDescription,
        payload.introContent,
        payload.coverImageUrl,
        JSON.stringify(payload.tagsJson),
        payload.isPublished,
        courseId
      ]
    );

    return response.json({ course: result.rows[0] });
  } catch (error) {
    console.error("[courses/update] Failed:", error.message);
    return response.status(500).json({ message: "Failed to update course" });
  }
});

router.get("/my/courses", authMiddleware, requireRole("author"), async (request, response) => {
  try {
    const result = await pool.query(
      `SELECT c.id, c.author_id, c.title, c.short_description, c.intro_content,
              c.cover_image_url, c.tags_json, c.is_published, c.created_at,
              COUNT(l.id)::int AS lessons_count
       FROM courses c
       LEFT JOIN lessons l ON l.course_id = c.id
       WHERE c.author_id = $1
       GROUP BY c.id
       ORDER BY c.created_at DESC, c.id DESC`,
      [request.user.id]
    );

    return response.json({ courses: result.rows });
  } catch (error) {
    console.error("[courses/mine] Failed:", error.message);
    return response.status(500).json({ message: "Failed to fetch your courses" });
  }
});

router.post(
  "/courses/:courseId/enroll",
  authMiddleware,
  requireRole("student"),
  async (request, response) => {
    const courseId = Number(request.params.courseId);

    if (!courseId) {
      return response.status(400).json({ message: "Invalid course id" });
    }

    try {
      const course = await getCourseById(courseId);

      if (!course || !course.is_published) {
        return response.status(404).json({ message: "Published course not found" });
      }

      await pool.query(
        `INSERT INTO enrollments (student_id, course_id)
         VALUES ($1, $2)
         ON CONFLICT (student_id, course_id) DO NOTHING`,
        [request.user.id, courseId]
      );

      return response.status(201).json({ message: "Enrollment saved" });
    } catch (error) {
      console.error("[courses/enroll] Failed:", error.message);
      return response.status(500).json({ message: "Failed to enroll to course" });
    }
  }
);

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

    const blocks = await fetchBlocksForLesson(lessonId);

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

router.post(
  "/lessons/:lessonId/blocks",
  authMiddleware,
  requireRole("author"),
  async (request, response) => {
    const lessonId = Number(request.params.lessonId);
    const payload = normalizeBlockPayload(request.body);

    if (!lessonId) {
      return response.status(400).json({ message: "Invalid lesson id" });
    }

    if (!BLOCK_TYPE_ORDER.includes(payload.type)) {
      return response.status(400).json({ message: "Block type must be lecture, practice, or test" });
    }

    if (!payload.title) {
      return response.status(400).json({ message: "Block title is required" });
    }

    try {
      const lesson = await getLessonWithCourse(lessonId);

      if (!lesson) {
        return response.status(404).json({ message: "Lesson not found" });
      }

      if (lesson.author_id !== request.user.id) {
        return response.status(403).json({ message: "You can edit only your own lesson blocks" });
      }

      const result = await pool.query(
        `INSERT INTO lesson_blocks (lesson_id, type, title, content, attachment_url, position)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, lesson_id, type, title, content, attachment_url, position, created_at`,
        [
          lessonId,
          payload.type,
          payload.title,
          payload.content,
          payload.attachmentUrl,
          payload.position
        ]
      );

      return response.status(201).json({ block: result.rows[0] });
    } catch (error) {
      console.error("[blocks/create] Failed:", error.message);
      return response.status(500).json({ message: "Failed to create block" });
    }
  }
);

router.patch("/blocks/:id", authMiddleware, requireRole("author"), async (request, response) => {
  const blockId = Number(request.params.id);
  const payload = normalizeBlockPayload(request.body);

  if (!blockId) {
    return response.status(400).json({ message: "Invalid block id" });
  }

  if (!BLOCK_TYPE_ORDER.includes(payload.type)) {
    return response.status(400).json({ message: "Block type must be lecture, practice, or test" });
  }

  if (!payload.title) {
    return response.status(400).json({ message: "Block title is required" });
  }

  try {
    const block = await getBlockWithOwnership(blockId);

    if (!block) {
      return response.status(404).json({ message: "Block not found" });
    }

    if (block.author_id !== request.user.id) {
      return response.status(403).json({ message: "You can edit only your own lesson blocks" });
    }

    const result = await pool.query(
      `UPDATE lesson_blocks
       SET type = $1,
           title = $2,
           content = $3,
           attachment_url = $4,
           position = $5
       WHERE id = $6
       RETURNING id, lesson_id, type, title, content, attachment_url, position, created_at`,
      [
        payload.type,
        payload.title,
        payload.content,
        payload.attachmentUrl,
        payload.position,
        blockId
      ]
    );

    return response.json({ block: result.rows[0] });
  } catch (error) {
    console.error("[blocks/update] Failed:", error.message);
    return response.status(500).json({ message: "Failed to update block" });
  }
});

router.post(
  "/blocks/:blockId/submissions",
  authMiddleware,
  requireRole("student"),
  async (request, response) => {
    const blockId = Number(request.params.blockId);
    const code = String(request.body.code || "").trim();
    const language = String(request.body.language || "javascript").trim() || "javascript";

    if (!blockId) {
      return response.status(400).json({ message: "Invalid block id" });
    }

    if (!code) {
      return response.status(400).json({ message: "Solution code is required" });
    }

    try {
      const block = await getBlockWithCourse(blockId);

      if (!block) {
        return response.status(404).json({ message: "Lesson block not found" });
      }

      if (!["practice", "test"].includes(block.type)) {
        return response.status(400).json({ message: "Solutions can be submitted only for practice or test blocks" });
      }

      if (!block.is_published) {
        return response.status(403).json({ message: "You do not have access to this lesson block" });
      }

      const resultStatus = "accepted";
      const resultMessage = "Solution submitted successfully. Automatic code checks are mocked for now.";
      const testsResult = {
        total: 1,
        passed: 1,
        failed: 0
      };

      const result = await pool.query(
        `INSERT INTO submissions (
           student_id, block_id, code, language, status, result_message, tests_result
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
         RETURNING id, student_id, block_id, code, language, status, result_message, tests_result, created_at`,
        [
          request.user.id,
          blockId,
          code,
          language,
          resultStatus,
          resultMessage,
          JSON.stringify(testsResult)
        ]
      );

      return response.status(201).json({ submission: result.rows[0] });
    } catch (error) {
      console.error("[submissions/create] Failed:", error.message);
      return response.status(500).json({ message: "Failed to submit solution" });
    }
  }
);

export default router;
