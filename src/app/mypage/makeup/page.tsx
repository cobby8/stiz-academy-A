import { redirect } from "next/navigation";
import { requireVerifiedParent } from "@/lib/auth-guard";
import { getMakeupOverviewForParent } from "@/lib/makeup/parent-makeup";
import MakeupClient from "./MakeupClient";

export const dynamic = "force-dynamic";

export default async function MakeupPage() {
  const parent = await requireVerifiedParent().catch(() => null);
  // regular-absence 와 동일 — 되돌려보내면 무한 반복이라 목적지를 지운다.
  if (!parent) redirect("/mypage/continue?bounced=1");

  const overview = await getMakeupOverviewForParent(parent.appUserId);
  // Date/BigInt 직렬화 안전화(서버 → 클라이언트)
  const initial = JSON.parse(JSON.stringify(overview));
  return <MakeupClient initial={initial} />;
}
