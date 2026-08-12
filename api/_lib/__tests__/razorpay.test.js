import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import { verifyWebhookSignature, razorpayConfigured } from "../razorpay.js";

const sign = (body, secret) => crypto.createHmac("sha256", secret).update(body, "utf8").digest("hex");

describe("verifyWebhookSignature", () => {
  const secret = "whsec_test_123";
  const body = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: "pay_1", order_id: "order_1" } } } });

  it("accepts a correct signature", () => {
    expect(verifyWebhookSignature(body, sign(body, secret), secret)).toBe(true);
  });

  it("rejects a tampered body", () => {
    const good = sign(body, secret);
    expect(verifyWebhookSignature(body + " ", good, secret)).toBe(false);
  });

  it("rejects a wrong secret", () => {
    expect(verifyWebhookSignature(body, sign(body, "other"), secret)).toBe(false);
  });

  it("rejects missing signature / secret / body", () => {
    expect(verifyWebhookSignature(body, "", secret)).toBe(false);
    expect(verifyWebhookSignature(body, sign(body, secret), "")).toBe(false);
    expect(verifyWebhookSignature(null, sign(body, secret), secret)).toBe(false);
  });

  it("does not throw on a length-mismatched signature", () => {
    expect(verifyWebhookSignature(body, "abc", secret)).toBe(false);
  });
});

describe("razorpayConfigured", () => {
  it("reflects env presence", () => {
    const save = { id: process.env.RAZORPAY_KEY_ID, secret: process.env.RAZORPAY_KEY_SECRET };
    delete process.env.RAZORPAY_KEY_ID; delete process.env.RAZORPAY_KEY_SECRET;
    expect(razorpayConfigured()).toBe(false);
    process.env.RAZORPAY_KEY_ID = "rzp_test"; process.env.RAZORPAY_KEY_SECRET = "sec";
    expect(razorpayConfigured()).toBe(true);
    // restore
    if (save.id === undefined) delete process.env.RAZORPAY_KEY_ID; else process.env.RAZORPAY_KEY_ID = save.id;
    if (save.secret === undefined) delete process.env.RAZORPAY_KEY_SECRET; else process.env.RAZORPAY_KEY_SECRET = save.secret;
  });
});
