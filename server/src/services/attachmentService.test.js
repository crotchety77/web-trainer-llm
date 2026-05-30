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

  it("VA-06: Успешный пропуск файла с корректными Magic Bytes (PDF / DOCX)", () => {
    const pdfFile = {
      originalname: "document.pdf",
      mimetype: "application/pdf",
      size: 1024,
      buffer: Buffer.from("%PDF-1.4 mock content")
    };
    expect(validateLectureAttachment(pdfFile)).toBe("");

    const docxFile = {
      originalname: "document.docx",
      mimetype: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      size: 1024,
      buffer: Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00, 0x00])
    };
    expect(validateLectureAttachment(docxFile)).toBe("");
  });

  it("VA-07: Блокировка файла с некорректными Magic Bytes (MIME-Type Spoofing)", () => {
    const fakePdfFile = {
      originalname: "malicious.pdf",
      mimetype: "application/pdf",
      size: 1024,
      buffer: Buffer.from("console.log('malicious script')") // Нет сигнатуры %PDF
    };
    expect(validateLectureAttachment(fakePdfFile)).toBe("Only PDF and DOCX files can be uploaded");

    const fakeDocxFile = {
      originalname: "malicious.docx",
      mimetype: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      size: 1024,
      buffer: Buffer.from("PK-fake-docx-content") // Первые 4 байта не равны PK\x03\x04
    };
    expect(validateLectureAttachment(fakeDocxFile)).toBe("Only PDF and DOCX files can be uploaded");
  });
});
