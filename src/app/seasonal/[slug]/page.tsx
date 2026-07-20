import PublicPageLayout from "@/components/PublicPageLayout";
import SeasonalDetailClient from "@/components/seasonal/SeasonalDetailClient";

export default async function SeasonalDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <PublicPageLayout><SeasonalDetailClient slug={slug} /></PublicPageLayout>;
}
