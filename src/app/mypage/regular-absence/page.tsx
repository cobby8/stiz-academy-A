import { redirect } from "next/navigation";
import { requireVerifiedParent } from "@/lib/auth-guard";
import { getUpcomingRegularClassDates } from "@/lib/regular/parent-regular-absence";
import RegularAbsenceClient from "./RegularAbsenceClient";

export const dynamic = "force-dynamic";

export default async function RegularAbsencePage() {
  const parent = await requireVerifiedParent().catch(() => null);
  if (!parent) redirect("/auth/continue?redirect=/mypage/regular-absence");

  const children = await getUpcomingRegularClassDates(parent.appUserId);
  // Date/BigInt 등 직렬화 안전화(서버 컴포넌트 → 클라이언트 전달)
  const initial = JSON.parse(JSON.stringify(children));
  return <RegularAbsenceClient initial={initial} />;
}
