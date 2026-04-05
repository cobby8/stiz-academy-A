import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getSkillCategories, getStudentSkills, getSkillHistory } from "@/lib/queries";
import Link from "next/link";
import SkillRadarChart from "@/components/SkillRadarChart";

// 학부모 마이페이지는 실시간 데이터 필요
export const dynamic = "force-dynamic";

/**
 * 학부모용 스킬 열람 페이지
 * 로그인한 부모의 자녀별 스킬 현황 + 레이더 차트 + 성장 이력
 * 보안: parentId 매칭으로 본인 자녀만 열람 가능
 */
export default async function MyPageSkillsPage() {
    // 인증 확인
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center">
                <span className="material-symbols-outlined text-5xl text-gray-300 mb-4">lock</span>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">로그인이 필요합니다</h2>
                <p className="text-gray-500 dark:text-gray-400 mb-6">
                    스킬 현황은 학부모 계정으로 로그인 후 확인할 수 있습니다.
                </p>
                <Link
                    href="/login"
                    className="bg-brand-orange-500 dark:bg-brand-neon-lime dark:text-brand-navy-900 text-white font-bold px-6 py-3 rounded-xl hover:bg-orange-600 transition"
                >
                    로그인하기
                </Link>
            </div>
        );
    }

    // DB에서 학부모 정보 조회 (parentId 매칭 보안)
    const parents = await prisma.$queryRawUnsafe<any[]>(
        `SELECT id FROM "User" WHERE email = $1 LIMIT 1`,
        user.email,
    );
    if (!parents[0]) {
        return (
            <div className="py-20 text-center text-gray-400">
                등록된 학부모 정보가 없습니다.
            </div>
        );
    }
    const parentId = parents[0].id;

    // 해당 학부모의 자녀 목록 조회
    const children = await prisma.$queryRawUnsafe<any[]>(
        `SELECT id, name FROM "Student" WHERE "parentId" = $1 ORDER BY "createdAt" ASC`,
        parentId,
    );

    if (children.length === 0) {
        return (
            <div className="py-20 text-center text-gray-400">
                <span className="material-symbols-outlined text-5xl mb-3 block">person_off</span>
                <p>등록된 자녀가 없습니다.</p>
            </div>
        );
    }

    // 카테고리 목록
    const categories = await getSkillCategories();

    if (categories.length === 0) {
        return (
            <div className="max-w-2xl mx-auto">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">스킬 현황</h1>
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 py-16 text-center text-gray-400">
                    <span className="material-symbols-outlined text-5xl mb-3 block">
                        sports_basketball
                    </span>
                    <p className="text-sm">아직 스킬 평가 항목이 설정되지 않았습니다.</p>
                </div>
            </div>
        );
    }

    // 자녀별 스킬 데이터를 병렬 조회
    const childrenData = await Promise.all(
        children.map(async (child: any) => {
            const [skills, history] = await Promise.all([
                getStudentSkills(child.id),
                getSkillHistory(child.id),
            ]);
            return { ...child, skills, history };
        }),
    );

    return (
        <div className="max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">스킬 현황</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                자녀의 기술별 성장 현황을 확인할 수 있습니다.
            </p>

            <div className="space-y-8">
                {childrenData.map((child) => {
                    // 레이더 차트용 데이터 구성
                    const chartCats = categories.map((c) => ({
                        name: c.name,
                        maxLevel: c.maxLevel,
                    }));
                    const chartVals = categories.map((c) => {
                        const skill = child.skills.find(
                            (s: any) => s.categoryId === c.id,
                        );
                        return skill ? skill.level : 0;
                    });
                    const hasSkills = child.skills.length > 0;

                    return (
                        <div
                            key={child.id}
                            className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
                        >
                            {/* 자녀 이름 헤더 */}
                            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
                                <h2 className="font-bold text-gray-900 dark:text-white text-lg">
                                    {child.name}
                                </h2>
                            </div>

                            {hasSkills ? (
                                <div className="p-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {/* 레이더 차트 */}
                                        <div className="flex flex-col items-center">
                                            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">
                                                종합 스킬
                                            </h3>
                                            <SkillRadarChart
                                                categories={chartCats}
                                                values={chartVals}
                                            />
                                        </div>

                                        {/* 스킬 상세 바 */}
                                        <div>
                                            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">
                                                항목별 레벨
                                            </h3>
                                            <div className="space-y-3">
                                                {categories.map((cat) => {
                                                    const skill = child.skills.find(
                                                        (s: any) =>
                                                            s.categoryId === cat.id,
                                                    );
                                                    const level = skill ? skill.level : 0;
                                                    const pct =
                                                        cat.maxLevel > 0
                                                            ? (level / cat.maxLevel) * 100
                                                            : 0;

                                                    return (
                                                        <div key={cat.id}>
                                                            <div className="flex items-center justify-between mb-1">
                                                                <span className="text-sm text-gray-700 dark:text-gray-200">
                                                                    {cat.icon && (
                                                                        <span className="material-symbols-outlined text-[16px] align-middle mr-1 text-gray-400">
                                                                            {cat.icon}
                                                                        </span>
                                                                    )}
                                                                    {cat.name}
                                                                </span>
                                                                <span className="text-sm font-bold text-orange-600">
                                                                    {level}/{cat.maxLevel}
                                                                </span>
                                                            </div>
                                                            {/* 프로그레스 바 */}
                                                            <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2">
                                                                <div
                                                                    className="bg-orange-500 h-2 rounded-full transition-all"
                                                                    style={{
                                                                        width: `${pct}%`,
                                                                    }}
                                                                />
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>

                                    {/* 최근 평가 이력 */}
                                    {child.history.length > 0 && (
                                        <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-800">
                                            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">
                                                최근 평가 이력
                                            </h3>
                                            <div className="space-y-2">
                                                {child.history
                                                    .slice(0, 10)
                                                    .map((h: any) => (
                                                        <div
                                                            key={
                                                                h.assessedAt +
                                                                h.categoryId
                                                            }
                                                            className="flex items-center gap-3 text-sm border-l-2 border-orange-200 pl-3 py-1"
                                                        >
                                                            <span className="text-gray-400 text-xs min-w-[70px]">
                                                                {new Date(
                                                                    h.assessedAt,
                                                                ).toLocaleDateString(
                                                                    "ko-KR",
                                                                )}
                                                            </span>
                                                            <span className="font-medium text-gray-700 dark:text-gray-200">
                                                                {h.categoryName}
                                                            </span>
                                                            <span className="text-xs font-bold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">
                                                                Lv.{h.level}
                                                            </span>
                                                            {h.note && (
                                                                <span className="text-gray-400 text-xs truncate">
                                                                    {h.note}
                                                                </span>
                                                            )}
                                                        </div>
                                                    ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="py-12 text-center text-gray-400">
                                    <span className="material-symbols-outlined text-4xl mb-2 block">
                                        pending
                                    </span>
                                    <p className="text-sm">
                                        아직 평가 기록이 없습니다.
                                    </p>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
