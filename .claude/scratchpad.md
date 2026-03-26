# 작업 스크래치패드

## 현재 작업
- **요청**: 관리자 페이지(/admin/*) 속도 최적화
- **상태**: planner-architect 분석 완료
- **현재 담당**: developer 구현 완료 -> tester 검증 대기
- **마지막 세션**: 2026-03-26

---

### 기획설계 (planner-architect) — 2026-03-26

#### 관리자 페이지 속도 최적화 분석 및 계획

**목표**: /admin/* 페이지들의 데이터 로딩 속도 개선

**현재 상태 요약**:
- 전체 15개 admin 페이지 중 14개가 revalidate:30 (ISR), force-dynamic 사용 페이지 0개 (이미 최적화됨)
- 대부분 페이지에서 Promise.all 병렬 쿼리 적용 완료
- queries.ts 함수 대부분 react.cache() 적용 완료
- 대시보드(page.tsx)에 Suspense 스트리밍 이미 적용

**발견된 병목 5건**:

| # | 병목 | 위치 | 영향도 | 난이도 |
|---|------|------|--------|--------|
| 1 | getDashboardExtendedStats 이중 호출 | admin/page.tsx (L208 + L496) | 높음 | 하 |
| 2 | getClassWithStudents 직렬 쿼리 | queries.ts L1301-1325 | 중간 | 하 |
| 3 | schedule 페이지 Google Sheets 직렬 대기 | admin/schedule/page.tsx L21 | 중간 | 중 |
| 4 | getStudentActivity 3단계 직렬 (1->2->3) | queries.ts L837-908 | 중간 | 중 |
| 5 | 대형 Client 컴포넌트 번들 (793줄, 705줄) | ProgramsAdminClient, ScheduleAdminClient | 낮음 | 상 |

**상세 분석**:

1. **getDashboardExtendedStats 이중 호출** (영향도: 높음 / 난이도: 하)
   - SlowDashboardSection(L208)과 ProgramStudentsCard(L496)에서 동일 함수를 2번 호출
   - react.cache()가 적용되어 있어 같은 렌더링 사이클이면 1회만 실행되지만,
     두 컴포넌트가 별도 Suspense 경계에 있어 cache가 공유되지 않을 가능성 있음
   - **해결**: ProgramStudentsCard에 ext를 props로 전달하거나, SlowDashboardSection 안에서 함께 렌더

2. **getClassWithStudents 직렬 쿼리** (영향도: 중간 / 난이도: 하)
   - 반 정보 조회(L1304) 완료 후 수강생 조회(L1316) 실행 = 2회 직렬
   - classRows null 체크 후 studentRows를 가져오므로 순서 의존성 있지만,
     classId는 이미 파라미터로 있으므로 Promise.all로 병렬화 가능
   - **해결**: Promise.all([classRows, studentRows]) 후 classRows null 체크

3. **schedule 페이지 Google Sheets 직렬 대기** (영향도: 중간 / 난이도: 중)
   - 5개 DB 쿼리는 Promise.all로 병렬 실행 (좋음)
   - 하지만 Google Sheets fetch는 settings.googleSheetsScheduleUrl이 필요해서 직렬 대기
   - Google Sheets는 외부 네트워크 호출이라 500ms~2초 소요
   - **해결**: settings만 먼저 가져오고, 나머지 4개 DB 쿼리 + Sheets를 Promise.all로 병렬화

4. **getStudentActivity 3단계 직렬** (영향도: 중간 / 난이도: 중)
   - 1단계: 원생 기본 정보 (null 체크 필요)
   - 2단계: 수강/출결/수납/통계 Promise.all (좋음)
   - 3단계: 갤러리 (classIds에 의존)
   - 1단계는 null 체크 때문에 직렬 불가피하지만, 3단계 갤러리를 2단계와 합칠 수 있음
   - **해결**: 2단계에서 classIds를 별도 쿼리로 가져와 갤러리도 2단계에 합류시킴

5. **대형 Client 컴포넌트** (영향도: 낮음 / 난이도: 상)
   - ProgramsAdminClient 793줄, ScheduleAdminClient 705줄
   - 관리자 페이지라 사용자 수 적고, 코드 분할 효과 제한적
   - 현재 단계에서는 보류 추천

**실행 계획**:

| 순서 | 작업 | 담당 | 예상 시간 | 선행 조건 |
|------|------|------|----------|----------|
| 1 | 대시보드 getDashboardExtendedStats 이중 호출 제거 | developer | 5분 | 없음 |
| 2 | getClassWithStudents 쿼리 병렬화 | developer | 5분 | 없음 |
| 3 | schedule 페이지 settings 분리 + Sheets 병렬화 | developer | 10분 | 없음 |
| 4 | getStudentActivity 갤러리 쿼리 2단계 합류 | developer | 10분 | 없음 |
| 5 | tsc 검증 + 코드 리뷰 | tester | 5분 | 1~4단계 |

1~4단계는 모두 독립적이므로 한 번에 진행 가능. 총 예상 소요: 약 30분.

**developer 주의사항**:
- $queryRawUnsafe 패턴 절대 변경 금지 (PgBouncer 호환)
- react.cache() 감싸진 함수는 유지
- revalidate: 30 설정 변경 금지
- 쿼리 결과의 컬럼명 대소문자 fallback 패턴 유지

---

### 구현 기록 (developer) — 2026-03-26

구현한 기능: 관리자 페이지 속도 최적화 4건 (쿼리 병렬화 + 이중 호출 제거)

| 파일 경로 | 변경 내용 | 신규/수정 |
|----------|----------|----------|
| src/app/admin/page.tsx | getDashboardExtendedStats 이중 호출 제거: ProgramStudentsCard를 props 기반 ProgramStudentsCardUI로 변경, SlowDashboardSection 안에서 ext 재사용. Bottom Row를 Suspense 안으로 이동 | 수정 |
| src/lib/queries.ts (getClassWithStudents) | classRows + studentRows를 Promise.all로 병렬 실행, 이후 classRows null 체크 | 수정 |
| src/app/admin/schedule/page.tsx | settings만 먼저 가져오고, DB 쿼리 4개 + Google Sheets fetch를 Promise.all로 병렬 실행 | 수정 |
| src/lib/queries.ts (getStudentActivity) | 갤러리 쿼리를 서브쿼리 방식으로 변경하여 3단계 직렬을 2단계로 축소. classIds를 DB 서브쿼리로 직접 조회 | 수정 |

tester 참고:
- 테스트 방법: /admin 대시보드, /admin/schedule, /admin/classes/[id], /admin/students/[id] 각각 접속하여 정상 렌더링 확인
- 정상 동작: 기존과 동일한 데이터 표시, 렌더링 속도만 개선
- 주의할 입력: 갤러리 데이터가 없는 원생, 수강 내역이 없는 원생도 테스트 필요

reviewer 참고:
- $queryRawUnsafe 패턴 유지, react.cache() 구조 유지, revalidate:30 변경 없음
- 갤러리 쿼리가 서브쿼리 방식으로 변경됨 (IN (SELECT ...)) - 성능상 enrollments가 적으므로 문제 없음

---

### 테스트 결과 (tester) — 2026-03-26

| 테스트 항목 | 결과 | 비고 |
|-----------|------|------|
| tsc --noEmit (소스 코드) | 통과 | src/ 내 타입 에러 0건. .next/ 자동생성 파일에서만 에러 (빌드캐시 문제, 무관) |
| 대시보드: ProgramStudentsCardUI props 기반 전환 | 통과 | L499: async 제거, programStudents를 props로 받음 확인 |
| 대시보드: SlowDashboardSection에서 getDashboardExtendedStats 1회만 호출 | 통과 | L222에서만 호출, L409에서 ext.programStudents를 직접 전달 |
| 대시보드: Bottom Row가 Suspense 안에 포함 | 통과 | L407-434 전체가 SlowDashboardSection 내부, L490 Suspense로 감싸짐 |
| 대시보드: ProgramStudentsCard 독립 호출 제거 | 통과 | 파일 전체에서 getDashboardExtendedStats 실제 호출은 L222 1건만 존재 |
| getClassWithStudents: Promise.all 병렬화 | 통과 | L1302: Promise.all([classRows, studentRows]) 패턴 확인 |
| getClassWithStudents: classRows null 체크 위치 | 통과 | L1325: Promise.all 이후에 if (!classRows[0]) return null 위치 정확 |
| getClassWithStudents: $queryRawUnsafe 유지 | 통과 | L1304, L1313 모두 prisma.$queryRawUnsafe 사용 |
| schedule: settings 먼저 가져오기 | 통과 | L9: settings를 await로 먼저 가져온 후 sheetUrl 추출 |
| schedule: 나머지 쿼리 + Sheets 병렬 실행 | 통과 | L14: Promise.all로 DB 4개 + Sheets 1개 동시 실행, sheetUrl 없으면 빈 배열 반환 |
| getStudentActivity: 갤러리 2단계 합류 | 통과 | L898-906: galleryPosts가 2단계 Promise.all에 포함됨 (기존 3단계 제거) |
| getStudentActivity: 서브쿼리 방식 | 통과 | L901-903: IN (SELECT e."classId" FROM "Enrollment" e WHERE e."studentId" = $1) 올바름 |
| getStudentActivity: 반환값 유지 | 통과 | enrollments, attendanceStats, payments, galleryPosts 모두 반환 구조 동일 |
| 런타임: /admin 접속 | 건너뜀 | 개발서버 응답 불가(hang). 포트 4000 LISTENING 중이나 요청 처리 안 됨. 서버 재시작 필요 |
| 런타임: /admin/schedule 접속 | 건너뜀 | 동일 사유 |

총 15개 항목 중 13개 통과 / 0개 실패 / 2개 건너뜀

건너뜀 사유: 개발서버가 hang 상태. 포트 4000에서 LISTENING이지만 HTTP 응답을 보내지 않음 (메인 페이지 /도 동일). 서버 재시작 후 런타임 테스트 필요.

---

### 리뷰 결과 (reviewer) — 2026-03-26

종합 판정: **통과**

잘된 점:
- 4건 모두 기존 아키텍처 규칙($queryRawUnsafe, react.cache(), revalidate:30, 컬럼명 fallback)을 정확히 유지
- 대시보드 이중 호출 제거: ProgramStudentsCardUI를 props 기반으로 전환하여 깔끔하게 해결. SlowDashboardSection 안에서 ext를 재사용하는 방식이 명확
- getClassWithStudents 병렬화: classId가 이미 파라미터로 있으므로 안전하게 Promise.all 적용. null 체크가 이후에 올바르게 위치
- schedule 페이지: settings만 먼저 가져오고 나머지를 병렬화. sheetUrl 없을 때 Promise.resolve([])와 .catch(() => []) 에러 처리가 안전
- getStudentActivity 갤러리 서브쿼리: IN (SELECT ...) 방식으로 3단계를 2단계로 축소. enrollments가 소규모이므로 서브쿼리 성능 문제 없음

필수 수정: 없음

권장 수정:
- [admin/page.tsx:508] ProgramStudentsCardUI 내부에서 maxCnt를 map 루프 안에서 매번 계산함. 루프 밖으로 빼면 불필요한 반복 제거. 프로그램 수가 적어서 실질적 영향은 거의 없으나, 코드 의도가 더 명확해짐. (수정 여부는 developer 재량)

안전성 체크리스트:
- [통과] $queryRawUnsafe 패턴 유지
- [통과] react.cache() 감싸진 함수 구조 유지
- [통과] revalidate: 30 설정 변경 없음
- [통과] 컬럼명 대소문자 fallback 패턴 유지

정확성 체크리스트:
- [통과] Promise.all 병렬화 시 에러 핸들링: 각 함수에 try-catch 있고, schedule은 추가로 .catch
- [통과] null 체크 로직: getClassWithStudents는 Promise.all 이후, getStudentActivity는 1단계 이후 유지
- [통과] 서브쿼리 SQL 문법 올바름 (IN (SELECT e."classId" FROM "Enrollment" e WHERE e."studentId" = $1))
- [통과] 반환값 형태/구조 변경 없음

---

## 작업 로그 (최근 10건)

| 날짜 | 작업 내용 | 파일 | 상태 |
|------|----------|------|------|
| 2026-03-26 | admin 속도 최적화 tester 검증: 13통과/0실패/2건너뜀(서버hang) | page.tsx, queries.ts, schedule/page.tsx | 검증완료 |
| 2026-03-26 | admin 속도 최적화 구현 4건 (이중호출제거/쿼리병렬화/Sheets병렬화/갤러리합류) | page.tsx, queries.ts, schedule/page.tsx | 구현완료 |
| 2026-03-26 | admin 속도 최적화 분석: 5개 병목 발견, 4건 개선 계획 수립 | queries.ts, admin/page.tsx, admin/schedule/page.tsx | 분석완료 |
| 2026-03-22 | 최적화 3건 tester 검증 (폰트/MergedSlot/middleware) 18통과/3건너뜀 | layout.tsx, fonts.ts, mergeSlots.ts, middleware.ts | 완료 |
| 2026-03-22 | 코드 품질: MergedSlot 공통 함수 추출 + middleware.ts 활성화 | mergeSlots.ts, middleware.ts | 완료 |
| 2026-03-22 | 폰트 로딩 CDN->next/font 전환 (Google Fonts 5종) | layout.tsx, lib/fonts.ts | 완료 |
| 2026-03-22 | 앱 최적화 4건 (OG/sitemap/robots/error/API인증) | layout.tsx, sitemap.ts, robots.ts, error.tsx | 완료 |
| 2026-03-22 | 시뮬레이터 + 관리자 최적화 (구현/테스트/리뷰 전체 통과) | simulator/ + admin/ | 완료 |
| 2026-03-22 | 챗봇 종합 개선 (분류체계/프롬프트/데이터소스/UI/버튼) | route.ts + ChatMessage/Panel.tsx | 완료 |

---

## 프로젝트 현황 요약
- **완료된 Phase**: 초기 ~ Phase 10 (총 10단계 + 보안패치)
- **릴리즈 기능 커버율**: 약 85%
- **남은 기능**: 모바일 결제(상) -- 보류, 수업 등록 시뮬레이터 -- 기획설계 완료
- **개발서버**: localhost:4000 (포트 변경됨)
- **프로덕션 배포**: stiz-dasan.kr (Vercel) -- 2026-03-21 최신 푸시 완료

### 대기 중인 작업
1. **관리자 페이지 속도 최적화**: 구현 완료. tsc 통과. tester 정적 검증 통과(13/13). 런타임 테스트 2건 건너뜀(서버hang).
2. **수업 등록 시뮬레이터**: 기획설계 완료. developer 실행 대기.
3. **엑셀 업로드 일괄 등록**: planner 계획 수립 완료 (7단계, 약 70분). 사용자 결정 대기.
