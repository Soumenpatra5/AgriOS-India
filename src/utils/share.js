export async function shareText(text, title) {
  if (navigator.share) {
    try {
      await navigator.share({ title: title || "AgriOS", text });
      return "shared";
    } catch (e) {
      if (e.name === "AbortError") return "cancelled";
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    return "copied";
  } catch {
    return "failed";
  }
}

export const canShare = typeof navigator !== "undefined" && (!!navigator.share || !!navigator.clipboard);
