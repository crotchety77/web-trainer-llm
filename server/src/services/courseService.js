import { pool } from "../db.js";

export async function getCourseById(courseId) {
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

export async function getLessonWithCourse(lessonId) {
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

export async function getBlockWithOwnership(blockId) {
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

export async function getBlockWithCourse(blockId) {
  const result = await pool.query(
    `SELECT lb.id, lb.lesson_id, lb.type, lb.title, lb.quiz_data, l.course_id,
            c.author_id, c.is_published, c.title AS course_title
     FROM lesson_blocks lb
     JOIN lessons l ON l.id = lb.lesson_id
     JOIN courses c ON c.id = l.course_id
     WHERE lb.id = $1`,
    [blockId]
  );

  return result.rows[0] || null;
}

export function canReadCourse(course, user) {
  if (course.is_published) {
    return true;
  }

  return Boolean(user && user.role === "author" && user.id === course.author_id);
}

export async function fetchLessonsForCourse(courseId) {
  const result = await pool.query(
    `SELECT id, course_id, title, position, created_at
     FROM lessons
     WHERE course_id = $1
     ORDER BY position ASC, id ASC`,
    [courseId]
  );

  return result.rows;
}

export async function fetchBlocksForLesson(lessonId, userId = 0) {
  const result = await pool.query(
    `SELECT lb.id, lb.lesson_id, lb.type, lb.title, lb.content, lb.quiz_data, lb.attachment_url, lb.position, lb.created_at,
            (ucp.id IS NOT NULL) AS is_completed,
            (SELECT answers FROM user_quiz_attempts WHERE block_id = lb.id AND user_id = $2 AND is_correct = TRUE ORDER BY created_at DESC LIMIT 1) AS last_quiz_answers
     FROM lesson_blocks lb
     LEFT JOIN user_course_progress ucp ON ucp.block_id = lb.id AND ucp.user_id = $2
     WHERE lb.lesson_id = $1
     ORDER BY
       CASE lb.type
         WHEN 'lecture' THEN 1
         WHEN 'practice' THEN 2
         WHEN 'test' THEN 3
         ELSE 4
       END ASC,
       lb.position ASC,
       lb.id ASC`,
    [lessonId, userId]
  );

  return result.rows;
}

export async function isStudentEnrolled(studentId, courseId) {
  const result = await pool.query(
    "SELECT id FROM enrollments WHERE student_id = $1 AND course_id = $2",
    [studentId, courseId]
  );

  return result.rowCount > 0;
}
