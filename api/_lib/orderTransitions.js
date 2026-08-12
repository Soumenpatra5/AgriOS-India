/* Order lifecycle state machine (pure, unit-testable).

   Payment (the B2 webhook) moves a paid order to `confirmed`. From there:
     seller: confirmed --ship--> shipped --deliver--> delivered
     buyer:  pending_payment --cancel--> cancelled   (releases reserved stock)

   Cancelling a PAID order (refund) and seller-initiated cancellation are B4
   (they need the Razorpay refund flow), so they are intentionally not here. */

export const ORDER_TRANSITIONS = {
  ship:    { role: "seller", from: ["confirmed"],       to: "shipped" },
  deliver: { role: "seller", from: ["shipped"],         to: "delivered" },
  cancel:  { role: "buyer",  from: ["pending_payment"], to: "cancelled", releaseStock: true },
};

export const ORDER_ACTIONS = Object.keys(ORDER_TRANSITIONS);

/* Resolve an action for a given current status and requester role.
   Returns { to, releaseStock } on success or { error } (client-safe message). */
export function resolveTransition(action, currentStatus, role) {
  const t = ORDER_TRANSITIONS[action];
  if (!t) return { error: `Unknown action: ${action}` };
  if (t.role !== role) return { error: `Only the ${t.role} can ${action} this order` };
  if (!t.from.includes(currentStatus)) return { error: `Cannot ${action} an order that is ${currentStatus}` };
  return { to: t.to, releaseStock: !!t.releaseStock };
}
