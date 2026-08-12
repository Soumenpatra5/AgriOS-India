/* Order lifecycle state machine (pure, unit-testable).

   Payment (the B2 webhook) moves a paid order to `confirmed`. From there:
     seller: confirmed --ship--> shipped --deliver--> delivered
     seller: confirmed|shipped --refund--> refunded   (Razorpay refund + restock)
     buyer:  pending_payment --cancel--> cancelled     (releases reserved stock)

   `cancel` is for UNPAID orders (no money moved). `refund` is the paid-order
   exit: the caller must issue the Razorpay refund and restock. Buyer-initiated
   paid cancellation / disputes remain a further extension. */

export const ORDER_TRANSITIONS = {
  ship:    { roles: ["seller"],        from: ["confirmed"],           to: "shipped" },
  deliver: { roles: ["seller"],        from: ["shipped"],             to: "delivered" },
  cancel:  { roles: ["buyer"],         from: ["pending_payment"],     to: "cancelled",  releaseStock: true },
  refund:  { roles: ["seller"],        from: ["confirmed", "shipped"], to: "refunded",  releaseStock: true, refund: true },
};

export const ORDER_ACTIONS = Object.keys(ORDER_TRANSITIONS);

/* Resolve an action for a given current status and requester role.
   Returns { to, releaseStock, refund } on success or { error } (client-safe). */
export function resolveTransition(action, currentStatus, role) {
  const t = ORDER_TRANSITIONS[action];
  if (!t) return { error: `Unknown action: ${action}` };
  if (!t.roles.includes(role)) return { error: `Only the ${t.roles.join(" or ")} can ${action} this order` };
  if (!t.from.includes(currentStatus)) return { error: `Cannot ${action} an order that is ${currentStatus}` };
  return { to: t.to, releaseStock: !!t.releaseStock, refund: !!t.refund };
}
