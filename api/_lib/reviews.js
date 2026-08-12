/* Pure helpers for reviews (unit-testable). A review is written by the buyer of
   a DELIVERED order, about either a listing in that order or its seller. */

export const REVIEW_SUBJECT_TYPES = ["listing", "seller"];

export function validateReviewInput(body) {
  const b = body || {};
  if (!b.orderId || typeof b.orderId !== "string") return { error: "orderId is required" };
  if (!REVIEW_SUBJECT_TYPES.includes(b.subjectType)) return { error: "subjectType must be listing or seller" };
  if (!b.subjectId || typeof b.subjectId !== "string") return { error: "subjectId is required" };
  const rating = Number(b.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { error: "rating must be an integer 1-5" };
  const comment = b.comment != null ? String(b.comment).slice(0, 2000) : "";
  return { value: { orderId: b.orderId, subjectType: b.subjectType, subjectId: b.subjectId, rating, comment } };
}

export function publicReview(row) {
  return {
    id: row.id,
    orderId: row.order_id,
    reviewerName: row.reviewer_name ?? undefined,
    subjectType: row.subject_type,
    subjectId: row.subject_id,
    rating: Number(row.rating),
    comment: row.comment ?? "",
    createdAt: row.created_at,
  };
}
