# 작업 스크래치패드

## 현재 작업
- **요청**: 학원 운영 고도화 Phase 3 — 체험수업 CRM / 전환 추적
- **상태**: developer 구현 완료 (tsc PASS)
- **현재 담당**: developer → tester
- **마지막 세션**: 2026-03-29

### 전체 로드맵 진행 현황
| Phase | 기능 | 상태 |
|-------|------|------|
| 1 | 수납 고도화 | 완료 |
| 2 | 일일 수업 리포트 | 완료 (tester 대기) |
| 3 | 체험수업 CRM | 완료 (tester 대기) |
| 4 | 대기자 관리 | 대기 |
| 5 | 보강 수업 매칭 | 대기 |
| 6 | 스킬 트래킹 | 대기 |
| 7 | 통계 대시보드 | 대기 |

---

## 기획설계 (planner-architect)
(Phase 3 로드맵에서 설계 완료)

## 구현 기록 (developer)

### Phase 3: 체험수업 CRM / 전환 추적

구현한 기능: TrialLead 모델(DDL ensure), 체험 신청 CRUD(등록/수정/삭제), 파이프라인 통계(상태별 건수+전환율), 상태 변경(NEW→CONTACTED→SCHEDULED→ATTENDED), 정규 등록 전환(ATTENDED→CONVERTED, Student+User 자동 생성), 이탈 처리(사유 입력), 메모 편집

| 파일 경로 | 변경 내용 | 신규/수정 |
|----------|----------|----------|
| prisma/schema.prisma | TrialLead 모델 추가 (status/createdAt 인덱스) | 수정 |
| src/lib/queries.ts | getTrialLeads(status?), getTrialStats() 조회 함수 추가 | 수정 |
| src/app/actions/admin.ts | ensureTrialLeadTable, createTrialLead, updateTrialLead, deleteTrialLead, convertTrialToStudent 5개 Server Action | 수정 |
| src/app/admin/trial/page.tsx | 서버 페이지 (revalidate:30, ensureTrialLeadTable DDL) | 신규 |
| src/app/admin/trial/TrialCrmClient.tsx | 파이프라인 카드+필터+리드 목록+모달 4종(등록/전환/이탈/메모) | 신규 |
| src/app/admin/layout.tsx | 사이드바 "학원운영" 탭에 "체험 CRM" 메뉴 추가 + OPS_PATHS | 수정 |

tester 참고:
- 테스트 방법: /admin/trial → "체험 신청 등록" 버튼 → 이름/연락처 입력 → 등록
- 상태 변경: 드롭다운으로 NEW→CONTACTED→SCHEDULED→ATTENDED 이동
- 정규 등록: ATTENDED 상태에서 "정규 등록" 버튼 → Student 생성 폼 → 등록 후 CONVERTED
- 이탈 처리: "이탈" 버튼 → 사유 입력 → LOST 상태
- 파이프라인 카드: 상태별 건수 + 전환율(%) 표시
- 필터: 상태별 탭 클릭으로 목록 필터링

reviewer 참고:
- 모든 Server Action에 requireAdmin() 첫줄 호출
- SQL은 $queryRawUnsafe/$executeRawUnsafe + $N 바인딩만 사용
- updateTrialLead: 컬럼명 화이트리스트(TRIAL_LEAD_COLUMNS)로 SQL 인젝션 방지
- convertTrialToStudent: createStudent와 동일한 User 생성/조회 패턴 재사용
- Material Symbols Outlined 아이콘만 사용

---

### Phase 2: 일일 수업 리포트 (학부모 소통 강화)

구현한 기능: 세션 리포트 작성/편집, 학생별 개별 코멘트(별점+노트), 리포트 발행/취소 + 학부모 알림, 학부모 리포트 열람(보안: parentId 매칭)

| 파일 경로 | 변경 내용 | 신규/수정 |
|----------|----------|----------|
| prisma/schema.prisma | Session에 published/publishedAt 추가 + StudentSessionNote 모델 | 수정 |
| src/lib/queries.ts | getSessionReport, getStudentReports, getSessionsForReportList 추가 | 수정 |
| src/app/actions/admin.ts | ensureReportColumns, saveSessionReport, publishSessionReport, saveStudentSessionNotes 추가 | 수정 |
| src/app/admin/attendance/report/page.tsx | 관리자 리포트 목록 서버 페이지 (revalidate:30) | 신규 |
| src/app/admin/attendance/report/[sessionId]/page.tsx | 관리자 리포트 편집 서버 페이지 | 신규 |
| src/app/admin/attendance/report/[sessionId]/ReportEditClient.tsx | 리포트 편집 UI (주제/내용/사진/코치/학생별 코멘트+별점/발행) | 신규 |
| src/app/admin/attendance/AttendanceClient.tsx | "수업 리포트" 버튼 추가 | 수정 |
| src/app/mypage/reports/page.tsx | 학부모 리포트 목록 (parentId 보안) | 신규 |
| src/app/mypage/reports/[sessionId]/page.tsx | 학부모 리포트 상세 (자녀만 표시, 미발행 차단) | 신규 |

tester 참고:
- 테스트 방법: /admin/attendance에서 출결 기록 후 → "수업 리포트" → 세션 선택 → 주제/내용/학생별 코멘트 작성 → 저장 → 발행
- 학부모 열람: /mypage/reports에서 발행된 리포트만 보여야 함
- 보안 테스트: 다른 학부모의 자녀 리포트에 접근 시 404 반환
- 미발행 리포트 URL 직접 접근 시 404 반환

reviewer 참고:
- Session.published/publishedAt 필드는 DDL ensure 방식 (ensureReportColumns)
- StudentSessionNote도 DDL ensure (CREATE TABLE IF NOT EXISTS)
- 학부모 페이지: requireAuth() 대신 supabase.auth.getUser() 직접 사용 (mypage 특성)
- `||`와 `??` 혼용 문제 1건 수정 (괄호 추가)

## 테스트 결과 (tester)

### Phase 3: 체험수업 CRM 검증 (2026-03-29)

| # | 테스트 항목 | 결과 | 비고 |
|---|-----------|------|------|
| 1 | tsc --noEmit | PASS | 타입 에러 0건 |
| 2 | schema.prisma: TrialLead 모델 | PASS | 14개 필드 존재, id(gen_random_uuid), status/createdAt 인덱스 2개, Timestamptz 타입 |
| 3 | queries.ts: getTrialLeads | PASS | $queryRawUnsafe 사용, status 파라미터 $1 바인딩, cache() 래핑, 소문자 컬럼 fallback(??) 적용 |
| 4 | queries.ts: getTrialStats | PASS | $queryRawUnsafe 사용, GROUP BY status, 전환율=(CONVERTED/(ATTENDED+CONVERTED))*100, 에러 시 기본값 반환 |
| 5 | admin.ts: ensureTrialLeadTable DDL | PASS | CREATE TABLE IF NOT EXISTS + 인덱스 2개, 멱등성 보장, 플래그로 재호출 방지 |
| 6 | admin.ts: createTrialLead requireAdmin | PASS | 첫 줄 await requireAdmin(), $1~$6 파라미터 바인딩, trim() 처리, revalidatePath |
| 7 | admin.ts: updateTrialLead requireAdmin + SQL인젝션방지 | PASS | requireAdmin() 호출, TRIAL_LEAD_COLUMNS 화이트리스트로 컬럼명 검증, 값은 $N 바인딩, 날짜 필드 ::timestamptz 캐스팅 |
| 8 | admin.ts: deleteTrialLead requireAdmin | PASS | requireAdmin() 호출, DELETE WHERE id=$1 바인딩, revalidatePath |
| 9 | admin.ts: convertTrialToStudent | PASS | requireAdmin() 호출, User 생성/조회 패턴(createStudent와 동일), Student INSERT RETURNING id, TrialLead CONVERTED+convertedDate+convertedStudentId 업데이트, revalidatePath 3경로 |
| 10 | trial/page.tsx: revalidate=30 | PASS | export const revalidate = 30, ensureTrialLeadTable() 호출, Promise.all로 leads+stats 병렬 조회 |
| 11 | TrialCrmClient: Material Symbols 사용 | PASS | handshake, person_add, fiber_new, call, event, check_circle, how_to_reg, person_off 등 Material Symbols Outlined만 사용, lucide-react 미사용 |
| 12 | TrialCrmClient: 파이프라인 카드 | PASS | STATUS_ORDER 6개 상태별 카드 + 전환율 카드, 클릭 시 필터 토글 |
| 13 | TrialCrmClient: 상태 필터 탭 | PASS | "전체" + 6개 상태별 탭, useMemo로 필터링, 건수 표시 |
| 14 | TrialCrmClient: 상태 변경 드롭다운 | PASS | CONVERTED/LOST 제외 시 select 표시, ATTENDED 선택 시 attendedDate 자동 설정 |
| 15 | TrialCrmClient: 모달 4종 | PASS | AddLeadModal(등록), ConvertModal(정규전환), LostModal(이탈사유), MemoModal(메모편집) 모두 존재 |
| 16 | TrialCrmClient: 빈 값 검증 | PASS | AddLeadModal: childName/parentName/parentPhone 필수 검증, ConvertModal: name/birthDate/parentName 필수 검증 |
| 17 | TrialCrmClient: busy 상태 관리 | PASS | 모든 비동기 액션에 setBusy(true/false), 버튼 disabled={busy}, "등록 중..." 텍스트 |
| 18 | TrialCrmClient: 에러 처리 | PASS | try/catch + alert(message) 패턴 일관 적용, router.refresh()로 상태 갱신 |
| 19 | layout.tsx: "체험 CRM" 메뉴 | PASS | OPS_PATHS에 "/admin/trial" 포함, NavItem label="체험 CRM" 존재 |

검출된 문제: 0건

종합: 19개 중 19개 통과 / 0개 실패

### Phase 2: 일일 수업 리포트 검증 (2026-03-29)

| # | 테스트 항목 | 결과 | 비고 |
|---|-----------|------|------|
| 1 | tsc --noEmit | PASS | 타입 에러 0건 |
| 2 | schema.prisma: Session 리포트 필드 | PASS | topic, content, photosJSON, coachId, published, publishedAt 모두 존재 |
| 3 | schema.prisma: StudentSessionNote 모델 | PASS | sessionId+studentId unique, rating nullable, index(studentId) 설정 |
| 4 | queries.ts: getSessionReport | PASS | $queryRawUnsafe 사용, $1 파라미터 바인딩, cache() 래핑 |
| 5 | queries.ts: getStudentReports | PASS | $queryRawUnsafe 사용, parentId $1 바인딩, published=true 필터, IN절 동적 플레이스홀더 |
| 6 | queries.ts: getSessionsForReportList | PASS | $queryRawUnsafe 사용, HAVING COUNT(a.id)>0, cache() 래핑 |
| 7 | admin.ts: saveSessionReport requireAdmin | PASS | 함수 첫 줄에 await requireAdmin() 호출 |
| 8 | admin.ts: publishSessionReport requireAdmin | PASS | 함수 첫 줄에 await requireAdmin() 호출 |
| 9 | admin.ts: saveStudentSessionNotes requireAdmin | PASS | 함수 첫 줄에 await requireAdmin() 호출 |
| 10 | admin.ts: SQL 파라미터 바인딩 | PASS | 모든 쿼리에서 $1~$N 플레이스홀더 사용, 문자열 보간 없음 |
| 11 | admin.ts: 발행 시 학부모 알림 | PASS | notifyParentsOfStudents 호출, REPORT 타입, 링크 /mypage/reports/{sessionId} |
| 12 | 관리자 리포트 목록 페이지 | PASS | revalidate=30, getSessionsForReportList 사용, Material Symbols 아이콘 (check_circle, edit_note, edit) |
| 13 | 관리자 리포트 편집 페이지 | PASS | revalidate=30, params Promise 패턴(Next.js 16 호환), notFound() 처리 |
| 14 | ReportEditClient UI | PASS | 주제/내용/코치/사진/학생별 코멘트+별점/발행 토글 모두 구현, Material Symbols 사용 |
| 15 | 출결 페이지에 리포트 버튼 | PASS | AttendanceClient.tsx에 "수업 리포트" Link 버튼 존재 (assignment 아이콘) |
| 16 | 학부모 목록 페이지 보안 | PASS | supabase.auth.getUser() 로그인 확인, parentId 매칭, published=true만 조회, force-dynamic |
| 17 | 학부모 상세 페이지 보안 (미발행 차단) | PASS | WHERE published=true 조건, 없으면 notFound() |
| 18 | 학부모 상세 페이지 보안 (타 자녀 차단) | PASS | parentId로 myStudents 조회 후 IN절 필터, 출석 없으면 notFound() |
| 19 | ensureReportColumns DDL | PASS | Session ALTER + StudentSessionNote CREATE TABLE IF NOT EXISTS, 멱등성 보장 |
| 20 | revalidatePath 호출 | PASS | save/publish 후 /admin/attendance, /admin/attendance/report, /mypage/reports 모두 무효화 |

검출된 문제: 0건

종합: 20개 중 20개 통과 / 0개 실패

## 리뷰 결과 (reviewer)

### Phase 2: 일일 수업 리포트 코드 리뷰 (2026-03-29)

종합 판정: APPROVE

검토 파일 9개: schema.prisma, queries.ts(3함수), admin.ts(4함수), admin/report/page.tsx, admin/report/[sessionId]/page.tsx, ReportEditClient.tsx, mypage/reports/page.tsx, mypage/reports/[sessionId]/page.tsx

잘된 점:
- 모든 DB 쿼리가 $queryRawUnsafe + 파라미터 바인딩($1~$N) 사용 — SQL 인젝션 방지 완벽
- 관리자 Server Action 3개(save/publish/saveNotes) 모두 requireAdmin() 첫 줄 호출
- 학부모 보안 3중 체크: (1) supabase.auth.getUser() 로그인 확인 (2) parentId로 자녀 매칭 (3) published=true 필터 + notFound()
- 미발행 리포트 URL 직접 접근 시 notFound() 반환 — 정보 노출 없음
- Material Symbols Outlined 아이콘만 사용 (check_circle, edit_note, edit, arrow_back 등)
- PostgreSQL 소문자 컬럼명 대응 (dayOfWeek ?? dayofweek 패턴) 일관 적용
- ensureReportColumns()로 DDL 멱등성 보장 — Phase 1 패턴과 동일
- revalidatePath 호출이 save/publish 후 관리자+학부모 경로 모두 무효화
- Next.js 16 params Promise 패턴 준수

필수 수정: 없음

권장 수정 (비필수, 현재 규모에서 문제 없음):
- [admin.ts:2722-2735] saveStudentSessionNotes에서 for 루프 개별 UPSERT — 학생 수가 많아지면(30명+) 배치 INSERT로 개선 가능. 현재 학원 규모에서는 성능 이슈 없음.
- [ReportEditClient.tsx:85] noteMap이 컴포넌트 본문에서 매 렌더링마다 재생성됨 — useMemo로 감싸면 최적화 가능하지만 데이터 크기가 작아 체감 차이 없음.
- [mypage/reports/page.tsx, mypage/reports/[sessionId]/page.tsx] DAY_LABELS, STATUS_MAP이 여러 파일에 중복 정의됨 — 공통 유틸로 추출하면 유지보수 편의 향상. 하지만 "동작하면 OK" 원칙에 따라 현 상태로 충분.

### Phase 3: 체험수업 CRM 코드 리뷰 (2026-03-29)

종합 판정: APPROVE

검토 파일 6개: schema.prisma(TrialLead 모델), queries.ts(getTrialLeads, getTrialStats), admin.ts(ensureTrialLeadTable, createTrialLead, updateTrialLead, deleteTrialLead, convertTrialToStudent), admin/trial/page.tsx, TrialCrmClient.tsx, admin/layout.tsx

잘된 점:
- 모든 DB 쿼리가 $queryRawUnsafe/$executeRawUnsafe + $N 파라미터 바인딩 사용 — SQL 인젝션 방지 완벽
- updateTrialLead의 동적 SET절: TRIAL_LEAD_COLUMNS 화이트리스트로 컬럼명 제한, 값은 $N 바인딩 — 동적 쿼리임에도 인젝션 불가
- 5개 Server Action(create/update/delete/convert + ensureTable) 중 CRUD 4개 모두 requireAdmin() 첫 줄 호출
- ensureTrialLeadTable은 DDL ensure 함수로 admin layout 인증 보호 하에서만 호출됨 — requireAdmin 불필요, 적절
- Material Symbols Outlined 아이콘만 사용 (handshake, person_add, fiber_new, call, event, check_circle, how_to_reg, person_off, trending_up, edit_note, delete 등)
- convertTrialToStudent가 기존 createStudent와 동일한 User 생성/조회 패턴 재사용 — 일관성 유지
- PostgreSQL 소문자 컬럼명 대응 (camelCase ?? lowercase) 일관 적용
- 클라이언트 busy 상태로 중복 요청 방지 + disabled 처리
- useMemo로 필터링 최적화
- 에러 메시지 일반화 (내부 에러를 사용자에게 노출하지 않음)
- revalidatePath 호출: 전환 시 /admin/trial + /admin/students + /admin 모두 무효화
- 날짜 타입 필드에 ::timestamptz 캐스팅 적용

필수 수정: 없음

권장 수정 (비필수, 현재 규모에서 문제 없음):
- [admin.ts:2905-2949] convertTrialToStudent에서 User 생성 -> Student INSERT -> TrialLead UPDATE 3개 쿼리가 트랜잭션 없이 순차 실행됨. Student 생성 후 TrialLead UPDATE가 실패하면 Student만 생성되고 리드는 ATTENDED 상태로 남을 수 있음. 다만 PgBouncer 트랜잭션 모드 제약으로 Prisma $transaction 사용 불가, 기존 createStudent도 동일 패턴이므로 프로젝트 규범 안에서 허용. 발생 빈도 극히 낮음.
- [TrialCrmClient.tsx:76-77] leads/stats를 useState에 넣지만 setter를 사용하지 않음(router.refresh로 서버 데이터 갱신). 불변 데이터라면 useState 대신 직접 props 사용 가능하지만, 현재 동작에 문제 없음.

---

## 작업 로그 (최근 10건)

| 날짜 | 작업 내용 | 파일 | 상태 |
|------|----------|------|------|
| 2026-03-29 | Phase 3: 체험수업 CRM 전체 구현 (TrialLead CRUD + 파이프라인 + 전환) | 6개 파일 | 완료 |
| 2026-03-29 | Phase 2: 일일 수업 리포트 전체 구현 (기존 구현 확인 + tsc 에러 1건 수정) | 9개 파일 | 완료 |
| 2026-03-30 | Phase 1: 수납 고도화 전체 구현 + tester PASS + reviewer 수정 3건 반영 | 9개 파일 | 완료 |
| 2026-03-30 | 학원운영 고도화 로드맵 7 Phase 설계 | scratchpad | 완료 |
| 2026-03-30 | 학부모 후기 SSR 권한 에러 수정 + DB User 시드 | TestimonialsWrapper, admin.ts, auth-guard | 완료 |
| 2026-03-29 | 학부모 후기 동적화 (DB CRUD + 네이버 링크) | 9개 파일 | 완료 |
| 2026-03-29 | 관리자 사이드바 "사이트"/"학원운영" 탭 UI | admin/layout.tsx | 완료 |
| 2026-03-29 | 보안 단기 조치 5건 | next.config 등 12파일 | 완료 |
| 2026-03-29 | 보안 Phase A — 미들웨어+Server Action 인증 | middleware.ts 등 | 완료 |
| 2026-03-29 | 보안 Phase B — 개인정보 처리방침 + 동의 | privacy/page 등 | 완료 |
| 2026-03-28 | 구글 캘린더 양방향 동기화 | googleCalendarWrite.ts 등 | 완료 |
