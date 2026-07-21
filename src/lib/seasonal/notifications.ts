import "server-only";
import {
  dispatchReservedSmsDelivery,
  finalizeReservedSmsWithoutDispatch,
  reserveFailClosedSmsDelivery,
  type SmsLedgerDb,
} from "@/lib/notification";
import { renderSmsTemplateResult } from "@/lib/smsTemplate";
import { prisma } from "@/lib/prisma";

export const SEASONAL_SMS_MAX_BYTES = 2000;

export function seasonalSmsBytes(body: string) {
  return Buffer.byteLength(body, "utf8");
}

export const SEASONAL_SMS_TRIGGERS = {
  received: "SPECIAL_APPLICATION_RECEIVED_PARENT",
  approved: "SPECIAL_APPLICATION_APPROVED_PARENT",
  waitlisted: "SPECIAL_APPLICATION_WAITLISTED_PARENT",
  rejected: "SPECIAL_APPLICATION_REJECTED_PARENT",
  cancelled: "SPECIAL_APPLICATION_CANCELLED_PARENT",
  accountActivation: "SPECIAL_ACCOUNT_ACTIVATION_PARENT",
  paymentRequest: "SPECIAL_PAYMENT_REQUEST_PARENT",
} as const;

export type SeasonalSmsTrigger = typeof SEASONAL_SMS_TRIGGERS[keyof typeof SEASONAL_SMS_TRIGGERS];
export type SeasonalSmsDeliveryResult = {
  ok: boolean;
  status: "PENDING" | "SENT" | "FAILED" | "SKIPPED";
  deliveryId: string | null;
  errorCode?: string;
  requiresReissue?: boolean;
};
export type SeasonalSmsReservationResult = SeasonalSmsDeliveryResult;

export type SendSeasonalParentSmsInput = {
  trigger: SeasonalSmsTrigger;
  applicationId: string;
  itemId?: string | null;
  recipientPhone: string;
  recipientUserId?: string | null;
  variables: Record<string, string>;
  /** Only explicit manual retries receive a new opaque run id. */
  deliveryRunId?: string;
};

function stableSeasonalEventId(input: Pick<SendSeasonalParentSmsInput, "applicationId" | "itemId" | "trigger">) {
  return [input.applicationId, input.itemId || "application", input.trigger].join(":");
}

function requiresFreshSecret(trigger: SeasonalSmsTrigger) {
  return trigger === SEASONAL_SMS_TRIGGERS.accountActivation;
}

export async function reserveSeasonalParentSms(
  db: SmsLedgerDb,
  input: Omit<SendSeasonalParentSmsInput, "variables">,
): Promise<SeasonalSmsReservationResult> {
  if (!input.applicationId.trim()) return { ok: false, status: "FAILED", deliveryId: null, errorCode: "APPLICATION_ID_REQUIRED" };
  const reserved = await reserveFailClosedSmsDelivery(db, {
    eventType: "SPECIAL_PROGRAM_NOTIFICATION",
    eventId: stableSeasonalEventId(input),
    deliveryRunId: input.deliveryRunId,
    recipientUserId: input.recipientUserId,
    recipientPhone: input.recipientPhone,
    recipientRole: "PARENT",
    trigger: input.trigger,
  });
  return { ...reserved, ...(requiresFreshSecret(input.trigger) ? { requiresReissue: true } : {}) };
}

export async function dispatchSeasonalParentSms(input: {
  deliveryId: string;
  trigger: SeasonalSmsTrigger;
  recipientPhone: string;
  variables: Record<string, string>;
}): Promise<SeasonalSmsDeliveryResult> {
  const rendered = await renderSmsTemplateResult(input.trigger, input.variables);
  if (!rendered.ok) {
    const result: SeasonalSmsDeliveryResult = { ok: false, status: "FAILED", deliveryId: input.deliveryId, errorCode: rendered.reason };
    await finalizeReservedSmsWithoutDispatch({ deliveryId: input.deliveryId, status: "FAILED", errorCode: rendered.reason });
    return { ...result, ...(requiresFreshSecret(input.trigger) && !result.ok ? { requiresReissue: true } : {}) };
  }
  if (seasonalSmsBytes(rendered.body) > SEASONAL_SMS_MAX_BYTES) {
    await finalizeReservedSmsWithoutDispatch({ deliveryId: input.deliveryId, status: "FAILED", errorCode: "MESSAGE_TOO_LONG" });
    return { ok: false, status: "FAILED", deliveryId: input.deliveryId, errorCode: "MESSAGE_TOO_LONG", ...(requiresFreshSecret(input.trigger) ? { requiresReissue: true } : {}) };
  }
  const result = await dispatchReservedSmsDelivery({ deliveryId: input.deliveryId, recipientPhone: input.recipientPhone, body: rendered.body });
  return { ...result, ...(requiresFreshSecret(input.trigger) && !result.ok ? { requiresReissue: true } : {}) };
}

export async function sendSeasonalParentSms(input: SendSeasonalParentSmsInput): Promise<SeasonalSmsDeliveryResult> {
  const { variables, ...reservationInput } = input;
  const reserved = await reserveSeasonalParentSms(prisma, reservationInput);
  if (reserved.status !== "PENDING" || !reserved.deliveryId) return reserved;
  return dispatchSeasonalParentSms({ deliveryId: reserved.deliveryId, trigger: input.trigger, recipientPhone: input.recipientPhone, variables });
}
