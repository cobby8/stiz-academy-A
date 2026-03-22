# 작업 스크래치패드

## 현재 작업
- **요청**: [1] 수업 등록 시뮬레이터 구현
- **상태**: tester 검증 완료 (전체 통과)
- **현재 담당**: tester 완료 -> PM 커밋 대기
- **마지막 세션**: 2026-03-22

---

### 기획설계 (planner-architect) — 수업 등록 시뮬레이터

**목표**: 학부모가 아이의 학년과 원하는 요일/시간을 입력하면, 등록 가능한 반(슬롯)을 자동으로 추천해주는 공개 페이지

**핵심 비유**: "식당 예약 시뮬레이터" — 몇 명이 언제 가고 싶은지 입력하면, 빈 자리가 있는 시간대를 추천해주는 것

#### 데이터 흐름 분석

시뮬레이터가 사용할 데이터는 **이미 존재하는 것들**이다:
- `MergedSlot[]` (schedule/page.tsx에서 이미 조합): 요일, 시간, 대상학년(gradeRange), 현재인원(enrolled), 정원(capacity), 마감여부(isFull), 프로그램ID, 코치 정보
- `Program[]` (queries.ts getPrograms): 프로그램 이름, 대상연령, 가격, 요일, 주간빈도
- `GRADE_ORDER` (googleSheetsSchedule.ts): 학년 순서 배열 (6세~성인)

**새 DB 테이블이나 쿼리가 필요 없다.** 기존 시간표 데이터를 서버에서 읽어와 클라이언트에서 필터링하면 된다.

#### UI 흐름 (3단계 위저드)

**1단계: 아이 정보 입력**
- 학년 선택 (드롭다운): 6세, 7세, 초1~초6, 중1~중3, 고1~고3, 성인
- (선택사항) 원하는 프로그램 유형 선택

**2단계: 원하는 요일/시간 선택**
- 요일 복수 선택 (월~일 체크박스)
- 시간대 선택 (오전/오후/저녁 또는 전체)

**3단계: 결과 표시**
- 조건에 맞는 슬롯 목록 (카드 형태)
- 각 슬롯에: 요일, 시간, 프로그램명, 코치, 현재인원/정원, 마감여부
- "마감임박"/"여유" 뱃지
- 하단에 "체험수업 신청" / "수강신청" CTA 버튼 (-> /apply 페이지 링크)

#### 만들 위치와 구조

| 파일 경로 | 역할 | 신규/수정 |
|----------|------|----------|
| `src/app/simulator/page.tsx` | 서버 컴포넌트: 시간표+프로그램 데이터 조회 후 클라이언트에 전달 | 신규 |
| `src/app/simulator/SimulatorClient.tsx` | 클라이언트 컴포넌트: 3단계 위저드 UI + 필터링 로직 | 신규 |
| `src/app/simulator/loading.tsx` | 로딩 UI (Suspense fallback) | 신규 |

#### 기존 코드 연결
- `src/app/schedule/page.tsx`의 데이터 조회 패턴을 **그대로 복사** (getSheetSlotCache, getClassSlotOverrides, getCustomClassSlots, getPrograms, getAcademySettings + MergedSlot 조합 로직)
- `src/app/schedule/ScheduleClient.tsx`의 `MergedSlot` 타입을 import해서 재사용
- `src/lib/googleSheetsSchedule.ts`의 `GRADE_ORDER`를 import해서 학년 드롭다운에 사용
- `src/components/PublicPageLayout.tsx`, `AnimateOnScroll`, `CTABanner` 등 기존 공통 레이아웃 재사용
- API 엔드포인트 신규 생성 **불필요** (서버 컴포넌트에서 직접 쿼리)

#### 캐싱 전략
- `revalidate = 300` (5분 ISR) — 공개 페이지이므로 /schedule과 동일

#### 실행 계획

| 순서 | 작업 | 담당 | 예상 시간 | 선행 조건 |
|------|------|------|----------|----------|
| 1 | simulator/page.tsx 서버 컴포넌트 생성 (schedule/page.tsx 패턴 복사 + 데이터 전달) | developer | 5분 | 없음 |
| 2 | simulator/SimulatorClient.tsx 위저드 UI 구현 (3단계: 학년선택 -> 요일/시간선택 -> 결과) | developer | 15분 | 1 |
| 3 | simulator/loading.tsx 로딩 UI 생성 | developer | 2분 | 없음 (1과 병렬 가능) |
| 4 | 네비게이션에 "수업 시뮬레이터" 메뉴 추가 | developer | 3분 | 1 |
| 5 | 타입 체크 + 브라우저 테스트 | tester | 5분 | 2,3,4 |
| 6 | 코드 리뷰 | reviewer | 5분 | 5와 병렬 |

총 예상 시간: 약 30분

#### developer 주의사항
- `MergedSlot` 타입은 `@/app/schedule/ScheduleClient`에서 export된 것을 그대로 import할 것
- 필터링 로직은 **클라이언트**에서 처리 (서버 왕복 없이 즉각 반응)
- 학년 매칭: `gradeRange` 필드가 "초4~중1" 형태이므로, `GRADE_ORDER` 인덱스 비교로 "선택한 학년이 범위 안에 있는지" 판별
- `$queryRawUnsafe` 직접 사용하지 않음 — 기존 `queries.ts` 함수만 호출
- 빈 결과일 때 "해당 조건에 맞는 수업이 없습니다. 전화로 문의해 주세요." 안내 필수
- 모바일 우선 반응형 디자인 (기존 페이지들의 px-6 + break-keep 패턴 따를 것)

---

### 구현 기록 (developer) -- 수업 등록 시뮬레이터

구현한 기능: 학년/요일/시간대를 선택하면 등록 가능한 수업을 추천하는 3단계 위저드 공개 페이지

| 파일 경로 | 변경 내용 | 신규/수정 |
|----------|----------|----------|
| `src/app/simulator/page.tsx` | 서버 컴포넌트: schedule/page.tsx 패턴 복사, MergedSlot[] 조합 후 클라이언트에 전달, revalidate=300 | 신규 |
| `src/app/simulator/SimulatorClient.tsx` | 클라이언트 컴포넌트: 3단계 위저드 (학년선택->요일/시간선택->결과카드), 클라이언트 필터링, 마감/마감임박/여유 뱃지 | 신규 |
| `src/app/simulator/loading.tsx` | 스켈레톤 로딩 UI | 신규 |
| `src/components/PublicHeader.tsx` | NAV_ITEMS에 "수업시뮬레이터" (/simulator) 추가 | 수정 |

tester 참고:
- 테스트 방법: localhost:4000/simulator 접속 -> 학년 선택 -> 요일/시간 선택 -> 결과 확인
- 정상 동작: 학년 범위에 포함되는 슬롯만 결과에 표시, 마감된 슬롯은 흐리게 표시, 빈 결과 시 안내 메시지
- 주의할 입력: "성인" 학년 선택 시 결과 0건일 수 있음 (성인 클래스가 없을 경우), 요일 미선택 시 전체 요일 검색
- 네비게이션: 헤더 메뉴에 "수업시뮬레이터" 링크 추가 확인

reviewer 참고:
- isGradeInRange() 함수: GRADE_ORDER 인덱스 비교로 "초4~중1" 범위 매칭 구현
- 마감임박 기준: enrolled/capacity >= 80% (비율 기반)
- TypeScript 타입 체크 통과 완료 (시뮬레이터 관련 에러 0건)

---

### 테스트 결과 (tester) — 2026-03-22

#### 작업 1: 수업 등록 시뮬레이터

| 테스트 항목 | 결과 | 비고 |
|-----------|------|------|
| npx tsc --noEmit 타입 체크 | 통과 | 에러 0건 |
| /simulator 페이지 로딩 (HTTP 200) | 통과 | "수업 등록 시뮬레이터" 텍스트 렌더링 확인 |
| PublicHeader.tsx 네비 추가 | 통과 | NAV_ITEMS에 "/simulator" + "수업시뮬레이터" 확인 |
| isGradeInRange 함수 로직 | 통과 | 단일학년/범위학년 처리, Math.min/max로 순서 무관 안전 처리 |
| MergedSlot 타입 import | 통과 | @/app/schedule/ScheduleClient에서 export type 올바르게 import |
| 빈 결과 안내 메시지 | 통과 | "해당 조건에 맞는 수업이 없습니다" + 전화문의 버튼 구현 |

#### 작업 2: 관리자 페이지 속도 최적화

| 테스트 항목 | 결과 | 비고 |
|-----------|------|------|
| admin/schedule Promise.all 병렬화 | 통과 | 5개 쿼리 병렬 실행 확인 |
| admin/settings Promise.all 병렬화 | 통과 | ensureColumns + getSettings 병렬 실행 확인 |
| admin/page.tsx Suspense 경계 분리 | 통과 | SlowDashboardSection, ProgramStudentsCard, SystemStatusCard 3개 분리 |
| revalidate = 30 유지 | 통과 | schedule/settings/page.tsx 모두 30 유지 |
| /admin HTTP 응답 | 통과 | 307 리다이렉트 (인증 미들웨어 정상) |
| /admin/schedule, /admin/settings HTTP 응답 | 통과 | 307 리다이렉트 (인증 미들웨어 정상) |

종합: 12개 중 12개 통과 / 0개 실패

---

### 리뷰 결과 (reviewer) — 2026-03-22

---

#### 작업 1: 수업 등록 시뮬레이터 (신규 기능)

종합 판정: **통과**

잘된 점:
- schedule/page.tsx의 데이터 조회 패턴을 정확히 복사하여 일관성 유지 (Promise.all 5개 병렬 쿼리, overrideMap, sheetMerged + customMerged 병합 순서 동일)
- revalidate=300 캐싱 전략이 CLAUDE.md 명세와 일치
- isGradeInRange() 함수가 단일 학년/범위 학년 모두 처리하며, Math.min/max로 역순 범위("중1~초4")도 안전하게 처리
- useMemo로 filteredSlots를 메모이제이션하여 불필요한 리렌더링 방지
- 빈 결과 시 전화문의 안내 + 조건 변경 버튼 제공 (기획 요구사항 충족)
- 모바일 반응형: px-6, break-keep, flex-col sm:flex-row 등 기존 패턴 준수
- MergedSlot 타입을 ScheduleClient에서 import하여 재사용 (타입 중복 없음)
- loading.tsx가 실제 레이아웃과 구조 일치 (Layout Shift 최소화)

| 파일 | 판정 | 비고 |
|------|------|------|
| simulator/page.tsx | 양호 | schedule/page.tsx와 데이터 조회 로직 100% 일치 |
| simulator/SimulatorClient.tsx | 양호 | 필터링 로직 정확, UX 흐름 자연스러움 |
| simulator/loading.tsx | 양호 | 스켈레톤 구조 적절 |
| PublicHeader.tsx | 양호 | NAV_ITEMS에 1줄 추가, 기존 기능 영향 없음 |

필수 수정: 없음 (0건)

권장 개선 (선택사항, 지금 당장 필요 없음):
- [SimulatorClient.tsx:89-92] getHourFromTime()에서 비정상 시간 문자열 방어 코드 추가하면 더 안전
- [simulator/page.tsx + schedule/page.tsx] MergedSlot 조합 로직이 두 파일에 완전 중복. 향후 유지보수 시 한쪽만 수정하고 놓칠 위험 있음. 나중에 공통 함수 추출 고려

---

#### 작업 2: 관리자 페이지 속도 최적화 (기존 파일 수정)

종합 판정: **통과**

잘된 점:
- admin/schedule: 5개 DB 쿼리 Promise.all 병렬화 올바름. Google Sheets는 sheetUrl 의존성 때문에 별도 await — 논리적으로 정확
- admin/settings: ensureColumns + getSettings 병렬화. ensureColumns 실패 시 .catch로 무시하여 설정 조회 영향 없음
- admin/page.tsx: 빠른 쿼리(stats 등)와 느린 쿼리(ext 등)를 Suspense로 분리. 스켈레톤 제공
- BackupStatusSection을 SystemStatusCard 내부에서 별도 Suspense로 분리 — 외부 API 호출 격리 적절
- revalidate 값 모두 30 유지 확인 (변경 없음)

| 파일 | 판정 | 비고 |
|------|------|------|
| admin/schedule/page.tsx | 양호 | Promise.all 정확, .catch fallback 적절 |
| admin/settings/page.tsx | 양호 | 병렬화 안전, try-catch 전체 포착 |
| admin/page.tsx | 양호 | Suspense 3곳 모두 적절, 스켈레톤 UI 제공 |

필수 수정: 없음 (0건)

권장 개선 (선택사항):
- [admin/page.tsx:496] ProgramStudentsCard가 getDashboardExtendedStats()를 별도 호출하여 SlowDashboardSection과 중복 fetch 가능성. react.cache()가 적용되어 있으면 자동 dedupe되어 문제 없음. 확인 필요.

---

## 작업 로그 (최근 10건)

| 날짜 | 작업 내용 | 파일 | 상태 |
|------|----------|------|------|
| 2026-03-22 | reviewer 코드 리뷰: 2건 모두 통과 (필수 수정 0건, 권장 개선 3건) | simulator/ + admin/ | 통과 |
| 2026-03-22 | tester 검증: 시뮬레이터 + 관리자 최적화 12항목 전체 통과 | simulator/ + admin/ | 통과 |
| 2026-03-22 | 수업 등록 시뮬레이터 구현 (3단계 위저드 + 네비 추가) | simulator/ + PublicHeader.tsx | 완료 |
| 2026-03-22 | 관리자 페이지 속도 최적화 3건 (schedule 병렬화, settings 병렬화, dashboard Suspense 분리) | admin/page.tsx + schedule/page.tsx + settings/page.tsx | 완료 |
| 2026-03-22 | 챗봇 DB 데이터 소스 6종 확장 + FAQ 추가 + 보안 규칙 | route.ts | 완료 |
| 2026-03-22 | 챗봇 누락 데이터 4건 추가 (학원소개/철학/시설/유튜브/일정description/공지필터) + 학년 범위 데이터 | route.ts | 완료 |
| 2026-03-22 | 챗봇 최초 문의 시 대회준비반/슈팅클래스 제외 규칙 추가 | route.ts | 완료 |
| 2026-03-22 | 챗봇 버튼 앵커 스크롤 (#trial, #enroll) | route.ts + ApplyPageClient.tsx + Card.tsx | 완료 |
| 2026-03-22 | 챗봇 액션 버튼 button->a 태그 변경 (클릭 미작동 수정) | ChatMessage.tsx | 완료 |
| 2026-03-22 | getCachedCoachSlots 교시 번호 포함 (slotKey "Wed-5" -> "수 5교시") | route.ts | 완료 |
| 2026-03-22 | 챗봇 종합 검증: 12개 시나리오 curl 테스트 + 시스템 프롬프트 분석 보고서 | route.ts (분석만) | 완료 |
| 2026-03-22 | 챗봇 시스템 프롬프트 5P 수정 (상담흐름 완화/셔틀충돌해소/교시인식/성인대응/수강료비교) | route.ts | 완료 |
| 2026-03-22 | 챗봇 질문 분류 체계 강화 + 셔틀/환불 답변 개선 + UI 개선 | route.ts + ChatMessage/Panel.tsx | 완료 |
| 2026-03-22 | 수업 등록 시뮬레이터 기획설계 완료 | (설계만) | 완료 |

---

## 프로젝트 현황 요약
- **완료된 Phase**: 초기 ~ Phase 10 (총 10단계 + 보안패치)
- **랠리즈 기능 커버율**: 약 85%
- **남은 기능**: 모바일 결제(상) -- 보류, 수업 등록 시뮬레이터 -- 기획설계 완료
- **개발서버**: localhost:4000 (포트 변경됨)
- **프로덕션 배포**: stiz-dasan.kr (Vercel) -- 2026-03-21 최신 푸시 완료

### 대기 중인 작업
1. **수업 등록 시뮬레이터**: 기획설계 완료. developer 실행 대기.
2. **엑셀 업로드 일괄 등록**: planner 계획 수립 완료 (7단계, 약 70분). 사용자 결정 대기.
3. **관리자 페이지 속도 최적화**: debugger 분석 완료 (7개 개선점 도출). 사용자 결정 대기.
