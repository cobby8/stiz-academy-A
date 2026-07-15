export const PUSH_OUTBOX_MAX_ATTEMPTS = 5;
export const PUSH_OUTBOX_LEASE_SECONDS = 120;

export function pushRetryDelaySeconds(attemptCount: number) {
  const normalizedAttempt = Math.max(1, Math.floor(attemptCount));
  return Math.min(60 * 60, 30 * 2 ** (normalizedAttempt - 1));
}

export function shouldRetryPush(errorCode: string | undefined) {
  return errorCode !== "NO_SUBSCRIPTION" && errorCode !== "VAPID_NOT_CONFIGURED";
}
