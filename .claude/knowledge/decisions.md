# 기술 결정 이력
<!-- 담당: planner-architect | 최대 30항목 -->
<!-- "왜 A 대신 B를 선택했는지" 기술 결정의 배경과 이유를 기록 -->

### 2026-03-22 수업 시뮬레이터: API 없이 클라이언트 필터링 방식 채택
- **분류**: decision
- **발견자**: planner-architect
- **내용**: 시뮬레이터용 별도 API 엔드포인트를 만들지 않고, 서버 컴포넌트에서 기존 queries.ts 함수로 전체 슬롯 데이터를 조회한 뒤 클라이언트에서 필터링하는 방식을 선택. 이유: (1) 슬롯 데이터량이 적어 전체 전달해도 부담 없음, (2) 필터 변경 시 서버 왕복 없이 즉각 반응, (3) schedule/page.tsx와 동일한 패턴이라 유지보수 용이, (4) 새 DB 쿼리 불필요.
- **참조횟수**: 0

### 2026-03-22 수업 시뮬레이터: 독립 페이지(/simulator) 방식 채택
- **분류**: decision
- **발견자**: planner-architect
- **내용**: /schedule 페이지에 탭으로 추가하는 대신 독립 페이지로 분리. 이유: (1) 위저드 형태의 단계별 UI가 필요하여 시간표와 혼재 시 복잡해짐, (2) SEO와 공유 가능한 URL 확보, (3) 기존 시간표 페이지에 영향 없음, (4) 나중에 챗봇에서 /simulator로 바로 연결 가능.
- **참조횟수**: 0

### 2026-03-26 관리자 페이지 캐싱: force-dynamic 전면 폐지 -> revalidate:30 통일
- **분류**: decision
- **발견자**: planner-architect
- **내용**: CLAUDE.md에는 "/admin/schedule은 revalidate:30, 나머지 /admin/*은 force-dynamic"으로 기술되어 있으나, 실제 코드 분석 결과 전체 15개 admin 페이지가 이미 revalidate:30으로 통일되어 있음. force-dynamic 사용 페이지 0개. Server Action 호출 시 revalidatePath로 즉시 무효화되므로 실시간성도 보장됨. CLAUDE.md 업데이트 필요.
- **참조횟수**: 0
