export type ReconcileDecision = "complete" | "pending" | "cancel";

// A transfer request carries `expires_at = lock time + expiry`. After that moment (plus a
// margin for clock skew) the wallet can no longer execute it, so a lock with no matching
// transfer is safe to cancel. Until then it stays locked.
export const CANCEL_MARGIN_SECONDS = 60;

export function reconcileDecision(input: {
  transferFound: boolean;
  lockedAt: Date;
  now: Date;
  transferExpirySeconds: number;
}): ReconcileDecision {
  if (input.transferFound) return "complete";
  const cancelAfter =
    input.lockedAt.getTime() + (input.transferExpirySeconds + CANCEL_MARGIN_SECONDS) * 1000;
  return input.now.getTime() > cancelAfter ? "cancel" : "pending";
}
