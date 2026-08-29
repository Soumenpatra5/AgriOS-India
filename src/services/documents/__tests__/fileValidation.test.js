import { describe, it, expect } from "vitest";
import { validateFile, findDuplicate, REJECT } from "../fileValidation.js";
import { MAX_DOCUMENT_SIZE_BYTES, MAX_DOCUMENT_SIZE_MB, acceptAttr } from "../documentConfig.js";

/* Node 18+ has File/Blob globally; these build real files so the validator
   reads real bytes rather than a mock of itself. */
const file = (name, bytes, type = "") =>
  new File([new Uint8Array(bytes)], name, { type });

const PDF  = [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34];
const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0];
const PNG  = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const WEBP = [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50];
const EXE  = [0x4d, 0x5a, 0x90, 0x00, 0, 0, 0, 0]; // MZ — Windows executable

describe("validateFile — accepted formats", () => {
  it("accepts a real PDF", async () => {
    const r = await validateFile(file("land.pdf", PDF, "application/pdf"));
    expect(r).toMatchObject({ ok: true, mimeType: "application/pdf" });
    expect(r.type.preview).toBe("pdf");
  });

  it("accepts JPG, PNG and WEBP", async () => {
    for (const [name, bytes, mime, ] of [
      ["a.jpg", JPEG, "image/jpeg"],
      ["a.jpeg", JPEG, "image/jpeg"],
      ["a.png", PNG, "image/png"],
      ["a.webp", WEBP, "image/webp"],
    ]) {
      const r = await validateFile(file(name, bytes, mime));
      expect(r.ok, name).toBe(true);
      expect(r.type.preview).toBe("image");
    }
  });

  it("trusts the signature over a picker that reports no MIME type", async () => {
    const r = await validateFile(file("scan.png", PNG, ""));
    expect(r).toMatchObject({ ok: true, mimeType: "image/png" });
  });
});

describe("validateFile — rejections", () => {
  it("rejects an empty file", async () => {
    expect(await validateFile(file("empty.pdf", []))).toMatchObject({ reason: REJECT.EMPTY });
  });

  it("rejects no file at all", async () => {
    expect(await validateFile(null)).toMatchObject({ ok: false, reason: REJECT.EMPTY });
  });

  it("rejects a file over the configured ceiling and reports the limit", async () => {
    const big = { name: "big.pdf", size: MAX_DOCUMENT_SIZE_BYTES + 1, type: "application/pdf" };
    expect(await validateFile(big)).toMatchObject({
      reason: REJECT.TOO_LARGE, limitMb: MAX_DOCUMENT_SIZE_MB,
    });
  });

  it("rejects a disabled extension", async () => {
    expect(await validateFile(file("sheet.xlsx", PDF))).toMatchObject({ reason: REJECT.BAD_EXTENSION });
  });

  it("rejects an extension we never accept", async () => {
    expect(await validateFile(file("run.exe", EXE))).toMatchObject({ reason: REJECT.BAD_EXTENSION });
  });

  /* The case the brief calls out by name (§31). */
  it("rejects an executable renamed to .pdf, despite a convincing MIME type", async () => {
    const r = await validateFile(file("invoice.pdf", EXE, "application/pdf"));
    expect(r).toMatchObject({ ok: false, reason: REJECT.CONTENT_MISMATCH });
  });

  it("rejects a PNG renamed to .pdf", async () => {
    expect(await validateFile(file("deed.pdf", PNG, "application/pdf")))
      .toMatchObject({ reason: REJECT.CONTENT_MISMATCH });
  });

  it("rejects a RIFF container that is not actually WEBP", async () => {
    const wav = [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45];
    expect(await validateFile(file("clip.webp", wav, "image/webp")))
      .toMatchObject({ reason: REJECT.CONTENT_MISMATCH });
  });

  it("rejects a mime type outside the accepted set", async () => {
    expect(await validateFile(file("x.pdf", PDF, "text/html")))
      .toMatchObject({ reason: REJECT.BAD_MIME });
  });
});

describe("findDuplicate", () => {
  const existing = [
    { fileName: "land.pdf", size: 1024 },
    { fileName: "old.pdf", size: 99, deletedAt: "2026-01-01" },
  ];

  it("matches on name and size together", () => {
    expect(findDuplicate(existing, { name: "land.pdf", size: 1024 })).toBeTruthy();
    expect(findDuplicate(existing, { name: "land.pdf", size: 2048 })).toBe(null);
    expect(findDuplicate(existing, { name: "other.pdf", size: 1024 })).toBe(null);
  });

  it("ignores soft-deleted records", () => {
    expect(findDuplicate(existing, { name: "old.pdf", size: 99 })).toBe(null);
  });
});

describe("config", () => {
  it("offers only enabled formats to the file picker", () => {
    const a = acceptAttr();
    expect(a).toContain("application/pdf");
    expect(a).toContain(".webp");
    expect(a).not.toContain("spreadsheetml"); // extension point, not enabled
  });
});
