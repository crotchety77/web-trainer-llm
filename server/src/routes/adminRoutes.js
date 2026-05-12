import { Router } from "express";
import { pool } from "../db.js";
import { authMiddleware, requireRole } from "../middleware/authMiddleware.js";

const router = Router();

// Get all users with pagination and search
router.get("/users", authMiddleware, requireRole("admin"), async (request, response) => {
  const { query = "", page = 1, limit = 20 } = request.query;
  const offset = (page - 1) * limit;

  console.log(`[admin/users] Fetching users: query="${query}", page=${page}, limit=${limit}`);

  try {
    const searchQuery = `%${query}%`;
    
    // Count total matches
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM users 
       WHERE name ILIKE $1 OR email ILIKE $1`,
      [searchQuery]
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Fetch paginated results
    const usersResult = await pool.query(
      `SELECT id, name, email, role, created_at 
       FROM users 
       WHERE name ILIKE $1 OR email ILIKE $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [searchQuery, limit, offset]
    );

    console.log(`[admin/users] Found ${usersResult.rowCount} users (Total matching: ${total})`);

    return response.json({
      users: usersResult.rows,
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total
      }
    });
  } catch (error) {
    console.error("[admin/users] Failed to fetch users:", error.message);
    return response.status(500).json({ message: "Failed to fetch users" });
  }
});
// Delete a user
router.delete("/users/:id", authMiddleware, requireRole("admin"), async (request, response) => {
  const { id } = request.params;

  if (parseInt(id, 10) === request.user.id) {
    return response.status(400).json({ message: "You cannot delete your own account" });
  }

  try {
    const result = await pool.query("DELETE FROM users WHERE id = $1", [id]);

    if (result.rowCount === 0) {
      return response.status(404).json({ message: "User not found" });
    }

    console.log(`[admin/users] Deleted user with ID: ${id}`);
    return response.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("[admin/users] Failed to delete user:", error.message);
    return response.status(500).json({ message: "Failed to delete user" });
  }
});

export default router;
