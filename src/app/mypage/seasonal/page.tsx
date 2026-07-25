import { redirect } from "next/navigation";
import { requireVerifiedParent } from "@/lib/auth-guard";
import { getParentSeasonalContext } from "@/lib/seasonal/parent-makeup";
import SeasonalMakeupClient from "./SeasonalMakeupClient";

export const dynamic = "force-dynamic";

export default async function ParentSeasonalPage() {
  const parent = await requireVerifiedParent().catch(() => null);
  if (!parent) redirect("/auth/continue?redirect=/mypage/seasonal");
  const ctx = await getParentSeasonalContext(parent.appUserId);
  const initial = JSON.parse(JSON.stringify(ctx));
  return <SeasonalMakeupClient initial={initial} />;
}
