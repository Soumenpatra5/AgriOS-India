/* Marketplace settlement math (pure). The platform takes a commission (basis
   points) from each order; the remainder settles to the seller. Actual payout
   uses Razorpay Route transfers to the seller's linked account — that requires a
   Route account + seller KYC/linked accounts, so live transfers are wired
   separately (see COMMERCE-BACKEND-SPEC.md B4). This computes the split. */

/* 1 bp = 0.01%. e.g. 250 bps = 2.5%. Reads PLATFORM_COMMISSION_BPS by default. */
export function commissionBps() {
  const n = Number(process.env.PLATFORM_COMMISSION_BPS || 0);
  return Number.isFinite(n) && n >= 0 ? Math.min(n, 10000) : 0;
}

export function computeSettlement(totalPaise, { bps = commissionBps() } = {}) {
  const total = Math.max(0, Math.round(Number(totalPaise) || 0));
  const commissionPaise = Math.round((total * bps) / 10000);
  return { totalPaise: total, commissionPaise, sellerPaise: total - commissionPaise, bps };
}
