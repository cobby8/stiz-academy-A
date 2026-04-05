/**
 * FAQ 독립 페이지 — /faq
 *
 * 기존 /apply#faq 앵커에서 독립 페이지로 분리.
 * DB에서 공개 FAQ를 조회하여 FaqClient 아코디언으로 렌더링한다.
 * ISR 60초 캐시로 성능과 실시간성의 균형을 맞춘다.
 */

import { getPublicFaqs } from "@/lib/queries";
import PublicPageLayout from "@/components/PublicPageLayout";
import AnimateOnScroll from "@/components/ui/AnimateOnScroll";
import FaqClient from "./FaqClient";

// ISR 60초 — apply 페이지와 동일한 캐싱 정책
export const revalidate = 60;

export const metadata = {
  title: "자주 묻는 질문 | STIZ 농구교실 다산점",
  description:
    "스티즈 농구교실 다산점 자주 묻는 질문. 체험수업, 수강료, 보강, 준비물 등 궁금한 점을 확인하세요.",
};

export default async function FaqPage() {
  // DB에서 공개 FAQ 조회
  const faqData = await getPublicFaqs();

  return (
    <PublicPageLayout>
      {/* 페이지 히어로 — 다른 공개 페이지와 동일한 그라데이션 패턴 */}
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-navy-900 via-brand-navy-800 to-brand-navy-900 text-white py-16 md:py-20">
        {/* 배경 장식 도형들 */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute right-0 top-0 w-72 h-72 border-[20px] border-white/5 dark:border-brand-neon-cobalt/10 rounded-full translate-x-1/3 -translate-y-1/3 transition-colors duration-300" />
          <div className="absolute left-0 bottom-0 w-48 h-48 border-[15px] border-brand-orange-500/10 dark:border-brand-neon-lime/10 rounded-full -translate-x-1/4 translate-y-1/4 transition-colors duration-300" />
        </div>
        <div className="max-w-6xl mx-auto px-6 md:px-4 relative">
          <AnimateOnScroll>
            <p className="text-brand-orange-500 dark:text-brand-neon-lime text-sm font-bold uppercase tracking-widest mb-3">
              FAQ
            </p>
            <h1 className="text-4xl md:text-5xl font-black mb-4 break-keep">
              자주 묻는 질문
            </h1>
            <p className="text-blue-200 text-lg max-w-xl">
              체험수업, 수강료, 보강 등 궁금한 점을 빠르게 확인하세요.
            </p>
          </AnimateOnScroll>
        </div>
      </section>

      {/* FAQ 아코디언 — 클라이언트 컴포넌트 */}
      <FaqClient faqData={faqData} />
    </PublicPageLayout>
  );
}
