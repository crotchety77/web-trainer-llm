import { Router } from "express";
import crypto from "crypto";
import fs from "fs/promises";
import multer from "multer";
import path from "path";
import { pool } from "../db.js";
import {
  authMiddleware,
  optionalAuthMiddleware,
  requireRole
} from "../middleware/authMiddleware.js";
import {
  getCourseAttachmentsDir,
  MAX_ATTACHMENT_SIZE_BYTES,
  buildAttachmentDownloadUrl,
  parseAttachments,
  serializeAttachments,
  validateLectureAttachment
} from "../services/attachmentService.js";
import { canReadCourse, getBlockWithOwnership } from "../services/courseService.js";

const router = Router();

const attachmentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_ATTACHMENT_SIZE_BYTES }
}).single("file");

function handleAttachmentUpload(request, response, next) {
  attachmentUpload(request, response, (error) => {
    if (!error) {
      if (request.file && request.file.originalname) {
        request.file.originalname = Buffer.from(request.file.originalname, "latin1").toString("utf8");
      }
      return next();
    }

    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      return response.status(413).json({ message: "Размер файла вложения не должен превышать 20 МБ" });
    }

    return response.status(400).json({ message: "Не удалось загрузить файл вложения" });
  });
}

router.post(
  "/blocks/:id/attachments",
  authMiddleware,
  requireRole("author"),
  handleAttachmentUpload,
  async (request, response) => {
    const blockId = Number(request.params.id);

    if (!blockId) {
      return response.status(400).json({ message: "Некорректный идентификатор блока" });
    }

    const validationError = validateLectureAttachment(request.file);
    if (validationError) {
      return response.status(400).json({ message: validationError });
    }

    try {
      const block = await getBlockWithOwnership(blockId);

      if (!block) {
        return response.status(404).json({ message: "Блок не найден" });
      }

      if (block.author_id !== request.user.id) {
        return response.status(403).json({ message: "Вы можете редактировать только блоки своих уроков" });
      }

      if (block.type !== "lecture") {
        return response.status(400).json({ message: "Вложения можно загружать только для лекционных блоков" });
      }

      const courseId = block.course_id;
      const courseDir = getCourseAttachmentsDir(courseId);
      await fs.mkdir(courseDir, { recursive: true });

      const extension = path.extname(request.file.originalname).toLowerCase();
      const storedName = `${crypto.randomUUID()}${extension}`;
      const targetPath = path.join(courseDir, storedName);
      await fs.writeFile(targetPath, request.file.buffer);

      const attachment = {
        original_name: path.basename(request.file.originalname),
        stored_name: storedName,
        url: buildAttachmentDownloadUrl(storedName),
        size: request.file.size,
        mime_type: request.file.mimetype,
        uploaded_at: new Date().toISOString()
      };
      const attachments = [...parseAttachments(block.attachment_url), attachment];

      const result = await pool.query(
        `UPDATE lesson_blocks
         SET attachment_url = $1
         WHERE id = $2
         RETURNING id, lesson_id, type, title, content, attachment_url, position, quiz_data, created_at`,
        [serializeAttachments(attachments), blockId]
      );

      return response.status(201).json({
        block: result.rows[0],
        attachments
      });
    } catch (error) {
      console.error("[attachments/upload] Failed:", error.message);
      return response.status(500).json({ message: "Не удалось загрузить файл вложения" });
    }
  }
);

router.delete(
  "/blocks/:id/attachments/:storedName",
  authMiddleware,
  requireRole("author"),
  async (request, response) => {
    const blockId = Number(request.params.id);
    const storedName = path.basename(String(request.params.storedName || ""));

    if (!blockId || !storedName) {
      return response.status(400).json({ message: "Некорректный идентификатор вложения" });
    }

    try {
      const block = await getBlockWithOwnership(blockId);

      if (!block) {
        return response.status(404).json({ message: "Блок не найден" });
      }

      if (block.author_id !== request.user.id) {
        return response.status(403).json({ message: "Вы можете редактировать только блоки своих уроков" });
      }

      const attachments = parseAttachments(block.attachment_url);
      const nextAttachments = attachments.filter((item) => item.stored_name !== storedName);

      if (nextAttachments.length === attachments.length) {
        return response.status(404).json({ message: "Вложение не найдено" });
      }

      await pool.query("UPDATE lesson_blocks SET attachment_url = $1 WHERE id = $2", [
        nextAttachments.length ? serializeAttachments(nextAttachments) : "",
        blockId
      ]);

      try {
        const courseId = block.course_id;
        await fs.unlink(path.join(getCourseAttachmentsDir(courseId), storedName));
      } catch (fileError) {
        if (fileError.code !== "ENOENT") {
          throw fileError;
        }
      }

      return response.json({ attachments: nextAttachments });
    } catch (error) {
      console.error("[attachments/delete] Failed:", error.message);
      return response.status(500).json({ message: "Не удалось удалить вложение" });
    }
  }
);

router.get("/attachments/:storedName", optionalAuthMiddleware, async (request, response) => {
  const storedName = path.basename(String(request.params.storedName || ""));

  if (!storedName) {
    return response.status(400).json({ message: "Некорректный идентификатор вложения" });
  }

  try {
    const result = await pool.query(
      `SELECT lb.attachment_url, c.author_id, c.is_published, c.id AS course_id
       FROM lesson_blocks lb
       JOIN lessons l ON l.id = lb.lesson_id
       JOIN courses c ON c.id = l.course_id
       WHERE lb.type = 'lecture' AND lb.attachment_url LIKE $1`,
      [`%${storedName}%`]
    );

    const matchedRow = result.rows.find((row) =>
      parseAttachments(row.attachment_url).some((item) => item.stored_name === storedName)
    );

    if (!matchedRow) {
      return response.status(404).json({ message: "Вложение не найдено" });
    }

    if (!canReadCourse(matchedRow, request.user)) {
      return response.status(403).json({ message: "У вас нет доступа к этому вложению" });
    }

    const attachment = parseAttachments(matchedRow.attachment_url).find(
      (item) => item.stored_name === storedName
    );
    const courseId = matchedRow.course_id;
    const filePath = path.join(getCourseAttachmentsDir(courseId), storedName);

    return response.download(filePath, attachment.original_name || storedName);
  } catch (error) {
    console.error("[attachments/download] Failed:", error.message);
    return response.status(500).json({ message: "Не удалось скачать вложение" });
  }
});

export default router;
