import { describe, it, expect } from "vitest";
import { validateLectureAttachment, MAX_ATTACHMENT_SIZE_BYTES } from "./attachmentService.js";

describe("validateLectureAttachment() (Таблица П.6)", () => {
  it("VA-01: Контроль допустимого MIME-типа", () => {
    const file = {
      originalname: "document.pdf",
      mimetype: "application/pdf",
      size: 1024
    };
    const result = validateLectureAttachment(file);
    expect(result).toBe("");
  });

  it("VA-02: Блокировка недопустимых текстовых форматов", () => {
    const file = {
      originalname: "notes.txt",
      mimetype: "text/plain",
      size: 1024
    };
    const result = validateLectureAttachment(file);
    expect(result).toBe("Only PDF and DOCX files can be uploaded");
  });

  it("VA-03: Блокировка исполняемых файлов", () => {
    const file = {
      originalname: "app.exe",
      mimetype: "application/x-msdownload",
      size: 1024
    };
    const result = validateLectureAttachment(file);
    expect(result).toBe("Only PDF and DOCX files can be uploaded");
  });

  it("VA-04: Контроль верхней границы размера файла", () => {
    const file = {
      originalname: "large.pdf",
      mimetype: "application/pdf",
      size: MAX_ATTACHMENT_SIZE_BYTES
    };
    const result = validateLectureAttachment(file);
    expect(result).toBe("Attachment must be smaller than 20 MB");
  });

  it("VA-05: Проверка значения, близкого к верхней границе", () => {
    const file = {
      originalname: "borderline.pdf",
      mimetype: "application/pdf",
      size: MAX_ATTACHMENT_SIZE_BYTES - 1
    };
    const result = validateLectureAttachment(file);
    expect(result).toBe("");
  });
});
