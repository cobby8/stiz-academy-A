import { NextRequest, NextResponse } from "next/server";
import { sendSmsDetailed } from "@/lib/sms";
import { claimManualMessageQueue, finalizeMessageDelivery, finalizeMessageDeliveryBatch } from "@/lib/message-ledger";

export const dynamic = "force-dynamic";
const MAX_DISPATCH_PER_RUN = 5;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // 공급자 요청은 건당 최대 5초이므로 5건으로 제한해 60초 함수 경계에 여유를 둡니다.
  const claim = await claimManualMessageQueue(MAX_DISPATCH_PER_RUN);
  const claimed = claim.items;
  const touched = new Set(claim.finalizeBatchIds);
  let sent = 0, failed = 0, uncertain = 0;
  for (const item of claimed) {
    touched.add(item.batchId);
    try {
      const result = await sendSmsDetailed(item.recipient, item.body);
      try {
        await finalizeMessageDelivery({
          deliveryId: item.id, ok: result.ok, provider: result.provider, requestedChannel: "SMS",
          actualChannel: "SMS", messageType: result.messageType || "SMS", providerGroupId: result.groupId,
          providerMessageId: result.messageId, providerStatus: result.ok ? "ACCEPTED" : "FAILED",
          errorCode: result.ok ? null : result.reason?.slice(0, 500),
        });
        if (result.ok) sent++; else failed++;
      } catch (error) {
        // 공급자 호출 이후 장부 확정이 실패한 건은 SENDING으로 두어 stale 시 UNCERTAIN으로 격리한다.
        console.error(`[manual-message-dispatch] ledger finalize failed id=${item.id}`, error);
        uncertain++;
      }
    } catch (error) {
      // 공급자 요청 도달 여부를 알 수 없으므로 FAILED로 재시도 가능하게 만들지 않는다.
      console.error(`[manual-message-dispatch] provider state uncertain id=${item.id}`, error);
      uncertain++;
    }
  }
  for (const batchId of touched) {
    try { await finalizeMessageDeliveryBatch(batchId); } catch (error) {
      console.error(`[manual-message-dispatch] batch finalize failed id=${batchId}`, error);
    }
  }
  return NextResponse.json({ success: failed === 0 && uncertain === 0, processed: claimed.length, sent, failed, uncertain });
}
