import PublicPageLayout from "@/components/PublicPageLayout";
import SeasonalApplyClient from "@/components/seasonal/SeasonalApplyClient";

export default async function SeasonalApplyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <PublicPageLayout><SeasonalApplyClient slug={slug} /></PublicPageLayout>;
}
