export const MEDIA_REVOCATION_MAX_ATTEMPTS = 5;

export function mediaRevocationRetryDelayMs(attempts: number) {
  const safeAttempts = Math.max(1, Math.min(attempts, MEDIA_REVOCATION_MAX_ATTEMPTS));
  return Math.min(60 * 60_000, 30_000 * (2 ** (safeAttempts - 1)));
}

export function isExpiredMediaRevocationLease(lockedAt: Date | string | null, now = Date.now()) {
  if (!lockedAt) return true;
  return now - new Date(lockedAt).getTime() >= 5 * 60_000;
}
