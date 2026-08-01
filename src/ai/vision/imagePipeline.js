/* Image pipeline — pick/capture → compress → Anthropic image block.
   Future disease-detection / OCR models plug in after compression. */

import { LIMITS } from "../config.js";

/* Opens the device picker (or camera on mobile with capture). */
export function pickImage({ capture = false } = {}) {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    if (capture) input.capture = "environment";
    input.onchange = () => resolve(input.files?.[0] || null);
    input.click();
  });
}

/* Downscale + re-encode to JPEG so uploads stay small on rural networks. */
export async function compressImage(file, maxDim = LIMITS.maxImageDim, quality = 0.82) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  canvas.getContext("2d").drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  const dataUrl = canvas.toDataURL("image/jpeg", quality);
  return {
    base64: dataUrl.split(",")[1],
    mediaType: "image/jpeg",
    width: w, height: h,
    bytes: Math.round((dataUrl.length * 3) / 4),
    name: file.name,
  };
}

/* Anthropic vision content block. */
export function toImageBlock(compressed) {
  return {
    type: "image",
    source: { type: "base64", media_type: compressed.mediaType, data: compressed.base64 },
  };
}

/* One-call helper for the chat UI. */
export async function captureImageBlock({ capture = false } = {}) {
  const file = await pickImage({ capture });
  if (!file) return null;
  const compressed = await compressImage(file);
  return { block: toImageBlock(compressed), meta: compressed };
}

/* Re-export new vision services so existing callers don't need path changes. */
export { imageProcessor }    from "../../services/vision/imageProcessor.js";
export { imageValidator }    from "../../services/vision/imageValidator.js";
export { cameraService }     from "../../services/vision/cameraService.js";
export { galleryService }    from "../../services/vision/galleryService.js";
