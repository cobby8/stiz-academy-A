# 프로젝트 구조 지식
<!-- 담당: planner-architect, developer | 최대 30항목 -->
<!-- 프로젝트의 폴더 구조, 파일 역할, 핵심 패턴을 기록 -->

### 2026-03-22 시간표 데이터 파이프라인
- **분류**: architecture
- **발견자**: planner-architect
- **내용**: 시간표 데이터는 3단계로 조합된다. (1) Google Sheets CSV -> SheetClassSlot[] (SheetSlotCache DB 캐시 or 직접 fetch), (2) ClassSlotOverride 테이블로 라벨/코치/시간/정원 오버라이드, (3) CustomClassSlot 테이블로 시트에 없는 커스텀 슬롯 추가. 최종 결과는 MergedSlot[] 배열. schedule/page.tsx에서 이 조합 로직이 구현되어 있고, ScheduleClient.tsx에서 MergedSlot 타입이 export된다.
- **참조횟수**: 0

### 2026-03-22 공개 페이지 공통 패턴
- **분류**: architecture
- **발견자**: planner-architect
- **내용**: 공개 페이지는 (1) PublicPageLayout 래퍼, (2) 히어로 섹션 (gradient + 장식도형 + AnimateOnScroll), (3) 본문 섹션, (4) CTABanner 하단 CTA 구조를 따른다. ISR 캐싱 적용 (공개=300초, 관리자=30초). 서버 컴포넌트에서 queries.ts 함수로 데이터 조회 후 클라이언트 컴포넌트에 props로 전달하는 패턴.
- **참조횟수**: 0

### 2026-03-22 학년 체계 (GRADE_ORDER)
- **분류**: architecture
- **발견자**: planner-architect
- **내용**: googleSheetsSchedule.ts에 GRADE_ORDER 배열이 정의됨: ["6세","7세","초1"~"초6","중1"~"중3","고1"~"고3","성인"]. MergedSlot.gradeRange는 "초4~중1" 형태의 문자열. formatGradeRange() 함수로 생성. 학년 범위 판별 시 GRADE_ORDER 인덱스 비교 방식 사용.
- **참조횟수**: 0
