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

### [2026-03-26] lucide-react 아이콘 사용 잔존 (conventions 위반)
- **분류**: convention
- **발견자**: planner-architect
- **내용**: CLAUDE.md에서 "Material Symbols Outlined 아이콘 사용, lucide-react 등 타 라이브러리 금지"로 규정되어 있으나, gallery/GalleryPublicClient.tsx (X, ChevronLeft, ChevronRight, Image, Play, Calendar)와 notices/page.tsx (Pin, Paperclip)에서 lucide-react를 여전히 사용 중. 교체 필요.
- **참조횟수**: 0

### [2026-03-28] 네비게이션 메뉴 4카테고리 구조
- **분류**: convention
- **발견자**: pm (사용자 지시)
- **내용**: 헤더 메뉴는 4개 상위 항목으로 구성. (1) 학원 소개 — /about 직접 링크, 드롭다운 없음. (2) 수업 안내 ▾ — 프로그램, 시간표, 연간일정. (3) 소식/안내 ▾ — 공지, 갤러리, FAQ(/faq), 이용약관(/terms). (4) 수업찾기 — /simulator 직접 링크. CTA 버튼은 "신청하기"(/apply).
- **참조횟수**: 0

### [2026-03-27] 체험수업 비용 표기 규칙
- **분류**: convention
- **발견자**: pm (사용자 지시)
- **내용**: 체험수업은 무료가 아니라 **1회 1만원의 체험비**가 있다. "무료 체험", "체험수업은 무료" 등의 표현은 절대 사용하지 않는다. 올바른 표현: "체험비 1만원", "체험수업 1회 1만원". FAQ, 배지, 투어 안내, 관리자 플레이스홀더 등 모든 곳에서 동일 적용.
- **참조횟수**: 0

### [2026-03-29] Server Action 인증 가드 패턴
- **분류**: convention
- **발견자**: reviewer
- **내용**: 모든 관리자 전용 Server Action 함수는 첫 줄에 `await requireAdmin()`을 호출한다. 인증 가드 파일(auth-guard.ts)은 `"use server"` 지시자 없이 순수 서버 유틸리티로 유지한다. 학부모도 사용할 함수(알림 읽음, 요청 접수 등)는 향후 `requireAuth()`로 변경 필요.
- **참조횟수**: 0
