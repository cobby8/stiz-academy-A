/**
 * @param {{ ok: boolean, reason?: string, groupId?: string, messageId?: string }} result
 */
export function isSafeShuttleSmsRetry(result) {
  if (result.ok || result.groupId || result.messageId) return false;
  const reason = result.reason ?? "";
  return reason.startsWith("Solapi failed:") || reason.startsWith("Bizppurio failed:");
}

export function buildNoShowEventId(logicalKey, serviceDateKey, direction) {
  return `no-show:${logicalKey}:${serviceDateKey}:${direction}`;
}
