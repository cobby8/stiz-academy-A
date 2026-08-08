import { redirect } from "next/navigation";
import { requireVerifiedParent } from "@/lib/auth-guard";
import { getEnrollmentChangeOptions } from "@/lib/enrollment/parent-change-request";
import EnrollmentChangeClient from "./EnrollmentChangeClient";

export const dynamic = "force-dynamic";

export default async function EnrollmentChangePage() {
  const parent = await requireVerifiedParent().catch(() => null);
  // bounced=1 로 목적지를 지운다. 여기로 되돌려보내면 거절 → 판별 → 거절이 무한 반복된다.
  // /mypage/continue 로 가야 설치된 학부모 앱이 제 영역을 벗어나지 않는다.
  if (!parent) redirect("/mypage/continue?bounced=1");

  const initial = await getEnrollmentChangeOptions(parent.appUserId);
  return <EnrollmentChangeClient initial={initial} />;
}
