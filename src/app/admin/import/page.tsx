/**
 * 수강생 데이터 이관 페이지 — 서버 컴포넌트
 *
 * 구글 스프레드시트의 수강생 CSV 데이터를 DB로 이관한다.
 * 서버에서는 특별한 데이터 로딩이 필요 없고,
 * 모든 로직은 클라이언트(ImportClient)에서 API를 호출한다.
 */

import ImportClient from "./ImportClient";
import RallyzRosterPreview from "./RallyzRosterPreview";
import { getCachedAdminSettingsPayload } from "@/lib/adminReadPayloads";

// ISR 30초 — 관리자 페이지 공통 설정
export const revalidate = 30;

export default async function ImportPage() {
  const { settings } = await getCachedAdminSettingsPayload();
  return (
    <div className="space-y-8">
      <RallyzRosterPreview />
      <div className="border-t pt-6 dark:border-gray-700">
        <details className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <summary className="cursor-pointer text-sm font-semibold text-gray-700 dark:text-gray-200">
            기존 스프레드시트 이관 도구 (보관)
          </summary>
          <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-100">
            이 구형 경로는 학생·수강 외 데이터를 저장하고 결제 기록도 만들 수 있습니다. Rallyz 명단 대조와 사이트 단독 운영 이관에는 사용하지 마세요.
          </p>
          <div className="mt-4">
            <ImportClient defaultSheetUrl={settings?.googleSheetsScheduleUrl ?? ""} />
          </div>
        </details>
      </div>
    </div>
  );
}
