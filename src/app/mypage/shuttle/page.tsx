import { redirect } from "next/navigation";
import { requireVerifiedParent } from "@/lib/auth-guard";
import { getShuttleExceptionOptions } from "@/lib/shuttle/parent-shuttle-exception";
import ShuttleExceptionClient from "./ShuttleExceptionClient";

export const dynamic = "force-dynamic";

export default async function ParentShuttlePage() {
  const parent = await requireVerifiedParent().catch(() => null);
  // bounced=1 로 목적지를 지운다. 여기로 되돌려보내면 거절 → 판별 → 거절이 무한 반복된다.
  if (!parent) redirect("/mypage/continue?bounced=1");

  const initial = await getShuttleExceptionOptions(parent.appUserId);
  return <ShuttleExceptionClient initial={initial} />;
}
