# 코딩 규칙 및 스타일
<!-- 담당: developer, reviewer | 최대 30항목 -->
<!-- 이 프로젝트만의 코드 스타일, 네이밍 규칙, 패턴을 기록 -->

### [2026-03-22] 공개 페이지 서버 컴포넌트 데이터 조회 패턴
- **분류**: convention
- **발견자**: reviewer
- **내용**: 공개 페이지(schedule, simulator 등)는 Promise.all로 5개 쿼리(getAcademySettings, getSheetSlotCache, getClassSlotOverrides, getCustomClassSlots, getPrograms)를 병렬 실행 후, overrideMap + sheetMerged + customMerged 순서로 MergedSlot[]을 조합한다. revalidate=300 (5분 ISR).
- **참조횟수**: 0

### [2026-03-22] 관리자 페이지 Suspense 분리 패턴
- **분류**: convention
- **발견자**: reviewer
- **내용**: admin 대시보드는 빠른 쿼리(DB 카운트 등)와 느린 쿼리(Supabase Storage, 경영통계 등)를 Suspense 경계로 분리한다. 느린 섹션은 별도 async 서버 컴포넌트로 만들어 스켈레톤 fallback을 제공한다.
- **참조횟수**: 0

### [2026-03-22] 클라이언트 필터링 useMemo 패턴
- **분류**: convention
- **발견자**: reviewer
- **내용**: 서버에서 전체 데이터를 받아 클라이언트에서 필터링할 때는 useMemo로 감싸서 의존성 배열(선택된 필터값들)이 변경될 때만 재계산한다. (SimulatorClient, ScheduleClient 참고)
- **참조횟수**: 0
