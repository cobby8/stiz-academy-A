import { redirect } from "next/navigation";
import { requireVerifiedParent } from "@/lib/auth-guard";
import { getUpcomingRegularClassDates } from "@/lib/regular/parent-regular-absence";
import { getRegularMakeupsForParent } from "@/lib/regular/parent-regular-makeup";
import RegularAbsenceClient from "./RegularAbsenceClient";

export const dynamic = "force-dynamic";

export default async function RegularAbsencePage() {
  const parent = await requireVerifiedParent().catch(() => null);
  if (!parent) redirect("/auth/continue?redirect=/mypage/regular-absence");

  // 다가오는 수업일(결석 신고용) + 예정 보강(읽기 전용) 병렬 조회.
  const [children, makeups] = await Promise.all([
    getUpcomingRegularClassDates(parent.appUserId),
    getRegularMakeupsForParent(parent.appUserId),
  ]);
  // Date/BigInt 등 직렬화 안전화(서버 컴포넌트 → 클라이언트 전달)
  const initial = JSON.parse(JSON.stringify(children));
  const initialMakeups = JSON.parse(JSON.stringify(makeups));
  return <RegularAbsenceClient initial={initial} makeups={initialMakeups} />;
}
