import { describe, it, expect } from "vitest";
import { resolveTransition, ORDER_ACTIONS } from "../orderTransitions.js";
import { validateReviewInput, publicReview } from "../reviews.js";

describe("order state machine", () => {
  it("lets the seller ship a confirmed order and deliver a shipped one", () => {
    expect(resolveTransition("ship", "confirmed", "seller")).toEqual({ to: "shipped", releaseStock: false });
    expect(resolveTransition("deliver", "shipped", "seller")).toEqual({ to: "delivered", releaseStock: false });
  });

  it("lets the buyer cancel an unpaid order and flags stock release", () => {
    expect(resolveTransition("cancel", "pending_payment", "buyer")).toEqual({ to: "cancelled", releaseStock: true });
  });

  it("rejects the wrong role", () => {
    expect(resolveTransition("ship", "confirmed", "buyer").error).toMatch(/seller/);
    expect(resolveTransition("cancel", "pending_payment", "seller").error).toMatch(/buyer/);
  });

  it("rejects illegal source states", () => {
    expect(resolveTransition("deliver", "confirmed", "seller").error).toMatch(/Cannot deliver/);
    expect(resolveTransition("cancel", "shipped", "buyer").error).toMatch(/Cannot cancel/);
    expect(resolveTransition("ship", "delivered", "seller").error).toMatch(/Cannot ship/);
  });

  it("rejects unknown actions", () => {
    expect(resolveTransition("teleport", "confirmed", "seller").error).toMatch(/Unknown action/);
    expect(ORDER_ACTIONS).toEqual(["ship", "deliver", "cancel"]);
  });
});

describe("validateReviewInput", () => {
  const good = { orderId: "o1", subjectType: "listing", subjectId: "l1", rating: 5, comment: "Great" };

  it("accepts a valid review", () => {
    const { value, error } = validateReviewInput(good);
    expect(error).toBeUndefined();
    expect(value).toMatchObject({ orderId: "o1", subjectType: "listing", subjectId: "l1", rating: 5, comment: "Great" });
  });

  it("requires order/subject and a 1-5 integer rating", () => {
    expect(validateReviewInput({}).error).toMatch(/orderId/);
    expect(validateReviewInput({ ...good, subjectType: "moon" }).error).toMatch(/subjectType/);
    expect(validateReviewInput({ ...good, subjectId: "" }).error).toMatch(/subjectId/);
    expect(validateReviewInput({ ...good, rating: 0 }).error).toMatch(/rating/);
    expect(validateReviewInput({ ...good, rating: 6 }).error).toMatch(/rating/);
    expect(validateReviewInput({ ...good, rating: 4.5 }).error).toMatch(/rating/);
  });

  it("defaults and caps the comment", () => {
    expect(validateReviewInput({ ...good, comment: undefined }).value.comment).toBe("");
    expect(validateReviewInput({ ...good, comment: "x".repeat(5000) }).value.comment).toHaveLength(2000);
  });
});

describe("publicReview", () => {
  it("shapes a DB row", () => {
    const out = publicReview({
      id: "r1", order_id: "o1", reviewer_name: "Asha", subject_type: "seller",
      subject_id: "s1", rating: "4", comment: "ok", created_at: "2026-08-12T00:00:00Z",
    });
    expect(out).toEqual({
      id: "r1", orderId: "o1", reviewerName: "Asha", subjectType: "seller",
      subjectId: "s1", rating: 4, comment: "ok", createdAt: "2026-08-12T00:00:00Z",
    });
  });
});
