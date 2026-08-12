/* Razorpay Checkout loader/opener (browser-only). Lazily injects the Razorpay
   checkout script the first time it's needed, then opens the modal for a
   server-created order. Fulfilment is driven by the server webhook, not the
   success handler here — the handler only advances the UI. */

const SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js";
let scriptPromise = null;

export function loadRazorpay() {
  if (typeof window !== "undefined" && window.Razorpay) return Promise.resolve(true);
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.onload = () => resolve(true);
    s.onerror = () => { scriptPromise = null; resolve(false); };
    document.body.appendChild(s);
  });
  return scriptPromise;
}

/* Open Checkout for a server order. `payment` is the object returned by
   POST /api/commerce/orders ({ keyId, razorpayOrderId, amountPaise, currency }). */
export async function openCheckout(payment, { name = "AgriOS", description = "", prefill = {}, onSuccess, onDismiss } = {}) {
  const ok = await loadRazorpay();
  if (!ok || typeof window === "undefined" || !window.Razorpay) {
    throw new Error("Could not load the payment gateway");
  }
  const rzp = new window.Razorpay({
    key: payment.keyId,
    order_id: payment.razorpayOrderId,
    amount: payment.amountPaise,
    currency: payment.currency || "INR",
    name,
    description,
    prefill,
    theme: { color: "#2f6f4f" },
    handler: (response) => { onSuccess?.(response); },
    modal: { ondismiss: () => { onDismiss?.(); } },
  });
  rzp.open();
}
