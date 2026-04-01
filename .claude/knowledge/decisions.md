# 기술 결정 이력
<!-- 담당: planner-architect | 최대 30항목 -->
<!-- "왜 A 대신 B를 선택했는지" 기술 결정의 배경과 이유를 기록 -->

### 2026-03-29 스프레드시트 수강생 이관: 데이터 구조 분석 및 이관 전략
- **분류**: decision
- **발견자**: planner-architect
- **내용**: 구글 스프레드시트(gid=672309223)에 38개 컬럼, 1,152행의 수강생 데이터 확인. 핵심 발견: (1) "결제방법" 컬럼이 결제수단(랠리즈/카드/현금)과 원생상태(휴원/퇴원/이월)를 혼합 -> 이관 시 분리 필요, (2) 현재 DB에 "지점(branch)" 개념이 완전히 누락 -> Student.branchName 문자열 추가 권장 (2개 지점뿐이라 테이블까지는 불필요), (3) 수업선택이 "N교시" 형태 -> 지점+요일+교시 조합으로 Class 매핑표 필요, (4) 같은 학생이 월별 여러 행에 등장 -> 이름+생년월일로 고유 식별 필수. Payment.method, Enrollment.status 확장(WITHDRAWN/PAUSED), Student에 branchName/uniformStatus/referralSource 필드 추가 필요.
- **참조횟수**: 0

### 2026-03-29 학부모 후기 동적화: Faq 패턴 복제 방식 채택
- **분류**: decision
- **발견자**: planner-architect
- **내용**: 학부모 후기를 DB로 전환할 때, 기존 Faq 모델/CRUD 패턴을 그대로 복제하는 방식 채택. 이유: (1) Faq와 구조가 거의 동일 (텍스트 + 순서 + 공개여부), (2) 검증된 패턴이라 버그 위험 최소, (3) 관리자 UI도 FaqAdminClient를 참고하면 빠르게 구현 가능. 네이버 플레이스 URL은 AcademySettings 대신 /admin/testimonials 페이지에서 관리하기로 결정 (후기와 같은 맥락에서 설정하는 것이 직관적).
- **참조횟수**: 0

### 2026-03-29 보안 분석: Server Action 인증 체크 필수화 결정
- **분류**: decision
- **발견자**: planner-architect
- **내용**: 보안 분석 결과, admin.ts의 40개+ Server Action에 인증 체크가 전혀 없음을 발견. Server Action은 HTTP POST 엔드포인트로 노출되므로 인증 없이 누구나 호출 가능. `requireAdmin()` 헬퍼를 만들어 모든 관리자 함수에 적용하기로 결정. 또한 src/middleware.ts가 아예 없어서 미들웨어 보호가 동작하지 않으므로 파일 생성 필수. 회원가입 시 role을 클라이언트에서 보내는 취약점도 서버 측 고정으로 수정 예정.
- **참조횟수**: 0

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

### 2026-03-26 입학 가이드 투어 v1: 직접 구현 방식 채택 -> 5회 실패로 폐기
- **분류**: decision
- **발견자**: planner-architect
- **내용**: v1에서 직접 구현(CSS box-shadow, z-index, 4-div 오버레이)을 시도했으나 5회 연속 실패. 근본 원인: (1) 하이라이트 대상이 너무 큰 섹션(히어로 1920x600px 등), (2) CSS hack으로는 부모 stacking context를 안정적으로 뚫을 수 없음, (3) 슬라이드쇼식 "다음" 버튼 방식은 게임 튜토리얼이 아님. 이 결정은 v2에서 번복됨.
- **참조횟수**: 1

### 2026-03-26 입학 가이드 투어 v2: driver.js 라이브러리 채택 (직접 구현 폐기)
- **분류**: decision
- **발견자**: planner-architect
- **내용**: v1의 5회 실패 후 driver.js(MIT, ~5KB gzipped) 채택. 선택 이유: (1) SVG cutout 방식으로 작은 요소도 정확히 하이라이트 (CSS hack 불필요), (2) pointer-events 자동 처리로 하이라이트된 요소 클릭 가능, (3) onNextClick/onHighlightStarted 콜백으로 "직접 클릭" 방식 구현 가능, (4) vanilla JS라 React 래핑 불필요, (5) 번들 크기 최소. 페이지 간 이동은 URL 파라미터(?tour=phase)로 자체 처리. shepherd.js(AGPL 라이센스)와 react-joyride(React 19 미호환) 제외.
- **참조횟수**: 0

### 2026-03-26 입학 가이드 투어: driver.js + sticky 헤더 위치 버그
- **분류**: decision
- **발견자**: planner-architect
- **내용**: driver.js가 sticky top-0 헤더 내부의 nav 링크를 하이라이트할 때, scrollIntoView 로직이 불필요하게 작동하여 popover 위치가 어긋남. 해결: nav 링크 스텝에 scrollIntoView:false 옵션 적용. 또한 Next.js Link에 DOM addEventListener로 click 리스너를 붙이면 React 합성 이벤트와 실행 순서 충돌 발생. 해결: href 속성 직접 교체 방식으로 전환.
- **참조횟수**: 0

### 2026-03-26 구글 캘린더 양방향 동기화: Service Account + DB 이중 저장 방식
- **분류**: decision
- **발견자**: planner-architect
- **내용**: Phase 1은 "DB를 주 저장소로 유지하면서 구글 캘린더에 best-effort 푸시" 방식. 구글 캘린더를 단일 진실 소스로 전환하는 것은 Phase 2로 유보. 인증은 Service Account(서버-to-서버). googleapis 패키지 사용 (Service Account JWT 서명을 직접 구현하는 것보다 안전). INSERT 시 ID는 crypto.randomUUID()로 미리 생성하여 RETURNING 없이 처리. 구글 API 실패 시 DB 저장만 유지(graceful fallback). 환경변수: GOOGLE_SERVICE_ACCOUNT_KEY(JSON 문자열), GOOGLE_CALENDAR_ID.
- **참조횟수**: 1

### 2026-03-29 체험/수강 신청 자체화: 구글폼 탈피 전략
- **분류**: decision
- **발견자**: planner-architect
- **내용**: 현재 체험/수강 신청은 구글폼 iframe 임베드 방식. TrialLead 모델은 이미 존재하나 관리자 수동 등록만 가능. 자체 폼 전환 시 (1) TrialLead에 필드 확장(birthDate, grade, basketballExp, preferredDay, preferredSlot, hopeNote), (2) 수강 신청 전용 EnrollmentApplication 모델 신규 생성(체험 데이터 자동 채움 + 수강 추가 필드), (3) 공개 /apply/trial, /apply/enroll 폼 페이지 -> Server Action으로 DB 직접 저장, (4) 기존 /admin/trial CRM에 공개 폼 연동, (5) /admin/apply를 구글폼 URL 관리에서 수강 신청 목록 관리로 전환. TrialLead->EnrollmentApplication->Student 3단계 파이프라인 구축.
- **참조횟수**: 0

### 2026-03-29 체험-수강 연속 경험: 심층 검토 11건 보완사항
- **분류**: decision
- **발견자**: planner-architect
- **내용**: 기본 설계 검토 결과 11건의 누락 사항 발견. 핵심 3건: (1) convertTrialToStudent가 Student만 생성하고 Enrollment/Guardian/Payment를 생성하지 않아 전환 프로세스가 끊김 -> convertAndEnroll로 확장 필요, (2) 체험 없이 직접 수강하는 경로(형제/지인추천)가 설계에 빠짐 -> EnrollmentApplication.trialLeadId를 optional로 해결, (3) ParentRequest type에 반변경(CLASS_CHANGE)/휴원(PAUSE)/퇴원(WITHDRAW)이 없어 학부모 셀프서비스 불가. 추가로 스팸방지(honeypot+rate limit), 중복감지(parentPhone 검색), 관리자 알림(대시보드 카운트), 결제안내(paymentGuideText) 등 보완 제안. PM 결정 대기: 미납시 수강상태 정책, 체험일정 선택방식, 알림 연동 범위.
- **참조횟수**: 0

### 2026-03-26 입학 가이드 투어: 기존 시뮬레이터 공존 방식
- **분류**: decision
- **발견자**: planner-architect
- **내용**: 가이드 투어와 기존 /simulator 페이지는 공존. 시뮬레이터는 독립 기능으로 유지하고, 가이드 투어에서 시뮬레이터를 "도착지 중 하나"로 활용. 시뮬레이터를 대체하지 않는 이유: (1) 시뮬레이터는 직접 검색/필터링이 가능한 도구형 페이지, (2) 가이드 투어는 정보 안내 목적, (3) SEO와 챗봇에서 /simulator 직접 링크가 이미 사용 중.
- **참조횟수**: 0
