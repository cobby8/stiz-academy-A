// 발송 경로 사전 점검 — 실제 문자는 보내지 않는다(sendSmsDetailed 호출 없음).
// 장부 예약/선점까지만 돌려 보고, 만든 흔적은 지운다.
import { PrismaClient } from "@prisma/client";
import { reserveMessageDeliveryBatch, reserveMessageDelivery, claimMessageDelivery } from "./src/lib/message-ledger.ts";
const prisma = new PrismaClient();
const key = `probe:${Date.now()}`;
try {
  const batchId = await reserveMessageDeliveryBatch({
    source: "MANUAL", stableEventKey: key, audienceScope: "EXTERNAL",
    trigger: "MANUAL_MESSAGE", actorUserId: null, actorName: "예약 발송",
    purpose: "사전 점검", reason: "예약 발송 경로 점검", body: "[STIZ] probe", requestedChannel: "SMS",
  });
  console.log("batchId:", batchId ? "OK" : "FAIL(null)");
  if (!batchId) process.exit(1);
  const reserved = await reserveMessageDelivery({
    batchId, source: "MANUAL", stableEventKey: key, eventType: "MANUAL_MESSAGE",
    trigger: "MANUAL_MESSAGE", audienceScope: "EXTERNAL",
    recipientPhone: "01000000000", body: "[STIZ] probe", requestedChannel: "SMS",
  });
  console.log("deliveryId:", reserved.deliveryId ? "OK" : "FAIL(null)");
  if (!reserved.deliveryId) process.exit(1);
  const claimed = await claimMessageDelivery(reserved.deliveryId);
  console.log("claim:", claimed ? "OK" : "FAIL(null)");
  await prisma.$executeRawUnsafe(`DELETE FROM "MessageDelivery" WHERE "batchId"=$1`, batchId);
  await prisma.$executeRawUnsafe(`DELETE FROM "MessageDeliveryBatch" WHERE id=$1`, batchId);
  console.log("정리 완료 — 발송 경로 이상 없음");
} catch (e) {
  console.log("EXCEPTION:", e?.message ?? e);
  process.exit(1);
} finally { await prisma.$disconnect(); }
