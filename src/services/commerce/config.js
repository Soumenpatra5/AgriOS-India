/* Commerce backend feature flag.

   The marketplace runs on the local IndexedDB store by default. When the shared
   commerce backend (Supabase + Razorpay) is provisioned, set VITE_COMMERCE_API=1
   and the marketplace sources listings/orders/payments from /api/commerce/*
   instead. Off = today's fully-local behaviour, so nothing breaks pre-backend. */

export function commerceEnabled() {
  return String(import.meta.env?.VITE_COMMERCE_API || "") === "1";
}
