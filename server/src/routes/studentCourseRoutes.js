import { Router } from "express";
import { pool } from "../db.js";
import { authMiddleware, requireRole } from "../middleware/authMiddleware.js";

const router = Router();

router.get("/student/courses", authMiddleware, requireRole("student"), async (request, response) => {
  try {
    const result = await pool.query(
      `SELECT c.id, c.title, c.short_description, c.cover_image_url,
              (SELECT COUNT(lb.id) FROM lesson_blocks lb JOIN lessons l ON l.id = lb.lesson_id WHERE l.course_id = c.id)::int AS total_blocks,
              (SELECT COUNT(ucp.id) FROM user_course_progress ucp WHERE ucp.course_id = c.id AND ucp.user_id = $1)::int AS completed_blocks
       FROM enrollments e
       JOIN courses c ON c.id = e.course_id
       WHERE e.student_id = $1
       ORDER BY e.enrolled_at DESC`,
      [request.user.id]
    );
    return response.json({ enrollments: result.rows });
  } catch (error) {
    console.error("[student/courses] Failed:", error.message);
    return response.status(500).json({ message: "Failed to fetch student courses" });
  }
});

export default router;
