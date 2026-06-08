import path from "path";

export const MAX_ATTACHMENT_SIZE_BYTES = 20 * 1024 * 1024;

export function getCourseAttachmentsDir(courseId) {
  return path.resolve(process.cwd(), "uploads", "courses", String(courseId));
}

const ALLOWED_ATTACHMENT_TYPES = new Map([
  [".pdf", "application/pdf"],
  [".docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]
]);

export function parseAttachments(value) {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.filter((item) => item && item.stored_name && item.url);
    }
  } catch {
    // Legacy rows may contain a plain URL in attachment_url.
  }

  return [
    {
      original_name: "Attached file",
      url: String(value),
      stored_name: "",
      size: 0,
      mime_type: ""
    }
  ];
}

export function serializeAttachments(attachments) {
  return JSON.stringify(attachments);
}

export function validateLectureAttachment(file) {
  if (!file) {
    return "Файл вложения обязателен";
  }

  const extension = path.extname(file.originalname || "").toLowerCase();
  const expectedMimeType = ALLOWED_ATTACHMENT_TYPES.get(extension);

  if (!expectedMimeType || file.mimetype !== expectedMimeType) {
    return "Допускается загрузка только файлов PDF и DOCX";
  }

  // Защита от MIME-Type Spoofing: Проверка сигнатуры файла (Magic Bytes)
  if (file.buffer) {
    if (file.buffer.length < 4) {
      return "Допускается загрузка только файлов PDF и DOCX";
    }
    if (extension === ".pdf") {
      const isPdfHeader = file.buffer.toString("utf-8", 0, 4) === "%PDF";
      if (!isPdfHeader) {
        return "Допускается загрузка только файлов PDF и DOCX";
      }
    } else if (extension === ".docx") {
      const isDocxHeader =
        file.buffer[0] === 0x50 &&
        file.buffer[1] === 0x4b &&
        file.buffer[2] === 0x03 &&
        file.buffer[3] === 0x04;
      if (!isDocxHeader) {
        return "Допускается загрузка только файлов PDF и DOCX";
      }
    }
  }

  if (file.size >= MAX_ATTACHMENT_SIZE_BYTES) {
    return "Размер файла вложения не должен превышать 20 МБ";
  }

  return "";
}

export function buildAttachmentDownloadUrl(storedName) {
  return `/api/attachments/${encodeURIComponent(storedName)}`;
}
