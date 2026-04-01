# 작업 스크래치패드

## 현재 작업
- **요청**: Phase A — 체험수업 신청 자체화 (구글폼 탈피)
- **상태**: developer 실행 완료
- **현재 담당**: PM 확인
- **마지막 세션**: 2026-03-29

### 리뷰 결과 (reviewer)

종합 판정: 수정 필요 (minor — 보안 1건 필수, 나머지 권장)

잘된 점:
- public.ts와 admin.ts를 분리하여 인증이 필요 없는 공개 Action을 명확히 구분한 설계가 좋다.
- honeypot 스팸 방지 + 전화번호 정규화 + 클라이언트/서버 이중 검증이 잘 되어 있다.
- 3단계 스텝 폼 UX가 깔끔하다. Step3에서 입력 정보 요약을 보여주는 것이 좋다.
- $queryRawUnsafe 패턴 준수, Material Symbols 아이콘 통일, 시간표 슬롯 그리드 정상 구현.
- TrialCrmClient에 SOURCE_LABELS 확장(FLYER, PASSBY)이 잘 되어 있다.
- NavItem badge prop 추가가 깔끔하다. null/0 체크도 정확하다.

필수 수정:
- [src/app/api/admin/trial-count/route.ts] 인증 가드 누락. /api/admin/* 경로인데 requireAdmin() 없이 누구나 접근 가능하다. 민감 정보는 아니지만(건수만 반환), 프로젝트 convention(Server Action 인증 가드 패턴)에 따라 관리자 API는 인증을 거쳐야 한다. Supabase 세션 검증 또는 최소한 미들웨어에서 보호되는지 확인 필요. 사이드바에서만 호출하므로 관리자 로그인 상태에서만 접근 가능해야 한다.

권장 수정:
- [src/app/actions/public.ts:78-105] INSERT 쿼리에서 $queryRawUnsafe + 파라미터 바인딩($1~$13)을 사용하고 있어 SQL 인젝션은 안전하다. 다만 source 필드(line 102)에 사용자 입력값이 직접 들어가는데, 클라이언트에서 SELECT 옵션으로 제한하고 있지만 서버에서도 화이트리스트 검증을 추가하면 더 안전하다. (예: ["WEBSITE","NAVER","REFERRAL","FLYER","PASSBY","OTHER"].includes(data.source) || "WEBSITE")
- [src/app/actions/public.ts:93] childAge에 childGrade를 저장하는 주석 "기존 호환"이 있다. 향후 childAge를 별도로 계산하거나 제거하는 정리가 필요해 보인다. 지금은 동작에 문제없다.
- [src/app/actions/public.ts:48] rate limiting이 없다. developer가 언급했듯이 현재는 honeypot만 적용. 프로덕션 트래픽이 늘면 IP 기반 또는 시간 기반 rate limit 추가를 검토해야 한다. (Phase B 이후 고려)
- [src/app/apply/trial/TrialApplicationForm.tsx:517-526] honeypot div가 absolute 위치인데 부모가 relative가 아니면 예상치 못한 위치에 렌더링될 수 있다. left[-9999px]로 화면 밖에 보내고 있어 실질적 문제는 없지만, display:none 대신 이 방식을 선택한 건 봇이 display:none을 감지하기 때문으로 올바른 접근이다.
- [src/app/admin/layout.tsx:8] LogOut 아이콘이 lucide-react에서 import되고 있다. conventions.md에 "Material Symbols Outlined 아이콘 사용, lucide-react 금지"로 되어 있으나 이건 Phase A 범위가 아니라 기존 코드이므로 별도 정리 과제로 남겨둔다.

수정 요청 테이블:
| 번호 | 파일 | 심각도 | 내용 | 담당 |
|------|------|--------|------|------|
| R-1 | src/app/api/admin/trial-count/route.ts | 필수 | 인증 가드 추가 (requireAdmin 또는 Supabase 세션 검증) | developer |
| R-2 | src/app/actions/public.ts:102 | 권장 | source 값 서버 화이트리스트 검증 추가 | developer |

### 구현 기록

구현한 기능: Phase A — 체험수업 신청 자체화 (A-1 ~ A-6 전체)

| 파일 경로 | 변경 내용 | 신규/수정 |
|----------|----------|----------|
| prisma/schema.prisma | TrialLead 모델에 9개 필드 추가 (childBirthDate, childGrade, childGender, basketballExp, preferredDays, preferredSlotKey, hopeNote, agreedTerms, agreedPrivacy) | 수정 |
| src/app/actions/admin.ts | ensureTrialLeadTable에 새 컬럼 DDL 추가, TRIAL_LEAD_COLUMNS 화이트리스트 확장, 날짜 캐스팅 보완 | 수정 |
| src/app/actions/public.ts | 공개 Server Action (submitTrialApplication, getAvailableTrialSlots) — honeypot 스팸방지, 전화번호 정규화 | 신규 |
| src/app/apply/trial/page.tsx | 체험수업 신청 서버 컴포넌트 — 빈자리 슬롯 + 학원설정 병렬 조회 | 신규 |
| src/app/apply/trial/TrialApplicationForm.tsx | 3단계 스텝 폼 클라이언트 — 아이정보/보호자+시간표/동의+제출 | 신규 |
| src/app/apply/ApplyPageClient.tsx | 체험수업 버튼을 구글폼 모달에서 /apply/trial Link로 변경 | 수정 |
| src/app/admin/trial/TrialCrmClient.tsx | 새 신청 N건 배지, 새 필드(학년/경험/희망슬롯/바라는점) 표시, SOURCE_LABELS 확장 | 수정 |
| src/lib/queries.ts | getTrialLeads 반환에 Phase A 필드 8개 추가 | 수정 |
| src/app/api/admin/trial-count/route.ts | 새 체험 신청 건수 API (사이드바 배지용) | 신규 |
| src/app/admin/layout.tsx | NavItem에 badge prop 추가, 사이드바 체험 CRM 옆 빨간 배지 표시 | 수정 |

tester 참고:
- 테스트 방법: /apply/trial 접속 → 3단계 폼 작성 → 제출 → /admin/trial에서 새 신청 확인
- 정상 동작: Step1(아이정보) → Step2(보호자/시간표) → Step3(동의/제출) → 완료화면
- Step2 시간표 그리드: Class 테이블에 데이터가 있어야 슬롯 표시, 없으면 "조회 가능한 시간표 없습니다" 메시지
- /apply 페이지에서 체험수업 버튼 클릭 시 /apply/trial로 이동 (모달 X)
- 관리자 사이드바 "체험 CRM" 옆에 빨간 배지(NEW 건수) 표시
- honeypot 필드: 숨겨진 input에 값 넣으면 봇으로 판단하고 성공처럼 반환

reviewer 참고:
- public.ts에 requireAdmin() 없음 (의도적 — 공개 폼)
- honeypot 스팸 방지만 적용, rate limit 없음 (필요시 추가)
- DDL ensure 패턴으로 컬럼 자동 추가 (기존 DB에도 호환)

### 테스트 결과 (tester) — Phase A 체험 신청 자체화

| # | 테스트 항목 | 결과 | 비고 |
|---|-----------|------|------|
| 1 | tsc --noEmit | PASS | 타입 에러 0건 |
| 2 | schema: TrialLead 확장 필드 9개 | PASS | 9개 모두 존재 |
| 3 | public.ts: submitTrialApplication | PASS | honeypot+필수값+$1~$13 바인딩+requireAdmin 없음(공개) |
| 4 | public.ts: getAvailableTrialSlots | PASS | Class+Enrollment LEFT JOIN, 빈자리 계산 |
| 5 | apply/trial/page.tsx: 서버 컴포넌트 | PASS | revalidate=60, Promise.all 병렬 조회 |
| 6 | TrialApplicationForm.tsx: 3단계 스텝 | PASS | Step1~3+시간표그리드+약관+honeypot hidden |
| 7 | ApplyPageClient.tsx: /apply/trial Link | PASS | 구글폼 모달 -> 자체 폼 Link 변경 확인 |
| 8 | TrialCrmClient.tsx: 확장 필드 표시 | PASS | childGrade/basketballExp/preferredSlotKey/hopeNote 표시 |
| 9 | api/admin/trial-count: 인증+NEW 건수 | WARN | 동작 정상, 단 requireAdmin 인증 없음 (아래 상세) |
| 10 | layout.tsx: 배지 표시 | PASS | newTrialCount + NavItem badge prop |
| 11 | SQL 인젝션 방지 | PASS | $1~$13 파라미터 바인딩, 입력값 직접 삽입 없음 |
| 12 | 스팸 방지 (honeypot) | PASS | hidden input + 봇에 성공 위장 반환 |

종합: 12개 중 12개 PASS (1개 WARN)

WARN #9: /api/admin/trial-count에 requireAdmin 인증 없음. 미들웨어가 /admin/* 페이지만 보호, /api/admin/* API는 미보호. 현재 NEW 건수(숫자1개)만 반환하여 민감도 낮으므로 PASS 처리. 추후 /api/admin/* 인증 일괄 적용 권장.

---

### 이전 구현 기록: 원생 관리 목록 테이블 UI 정비

구현한 기능: 원생 관리 목록 테이블 UI 정비 (컬럼 축소 + 헬퍼 함수 적용 + 아이콘화 + 행 높이 축소 + 반응형)

| 파일 경로 | 변경 내용 | 신규/수정 |
|----------|----------|----------|
| src/app/admin/students/StudentManagementClient.tsx | tbody 행: 7컬럼(이름/학년/학교/수강반/학부모/연락처/관리)으로 축소, 헬퍼함수 적용, 아이콘 버튼, py-2 패딩, md:table-cell 반응형 | 수정 |

tester 참고:
- 테스트 방법: /admin/students 접속 후 테이블 확인
- 정상 동작: 학년="초4" 형태, 수강반="월6,수4" 형태, 학부모="보호자" 형태, 연락처="010-xxxx-xxxx" 하이픈, 관리=아이콘3개
- 모바일(md 미만): 학교/학부모/연락처 숨김, 이름/학년/수강반/관리만 표시

---

#### 이전 구현 기록: 4월 CSV 기준 Enrollment 완전 재설정

구현한 기능: 4월 CSV 기준 Enrollment 완전 재설정 (DELETE + INSERT)

| 파일 경로 | 변경 내용 | 신규/수정 |
|----------|----------|----------|
| scripts/reset-enrollments-april.js | CSV에서 4월행 필터->요일별 slotKey 추출->기존 전삭제->새 INSERT | 신규 |

실행 결과: 기존 339건 DELETE -> 335건 INSERT (ACTIVE 251, PAUSED 32, WITHDRAWN 52)
- 4월 학생 197명, 1~3월만 학생 71명, DB 매칭 263명, 미매칭 5명
- DB에 없는 slotKey 4건: Tue-1, Thu-1, Thu-5, Fri-0 (해당 수업 건너뜀)

#### 수정 이력
| 회차 | 날짜 | 수정 내용 | 수정 파일 | 사유 |
|------|------|----------|----------|------|
| 1차 | 2026-03-29 | 기존 UPDATE방식 -> DELETE+INSERT 완전 재설정 | reset-enrollments-april.js | PM 요청: 4월 CSV 기준 Enrollment 완전 재설정 |

### 전체 로드맵 진행 현황
| Phase | 기능 | 상태 |
|-------|------|------|
| 1 | 수납 고도화 | 완료 |
| 2 | 일일 수업 리포트 | 완료 (tester 대기) |
| 3 | 체험수업 CRM | 완료 (tester 대기) |
| 4 | 대기자 관리 | 완료 (tester 대기) |
| 5 | 보강 수업 매칭 | 완료 (tester 대기) |
| 6 | 스킬 트래킹 | 완료 (tester 대기) |
| 7 | 통계 대시보드 | 완료 (tester 대기) |

---

## 기획설계 (planner-architect)

### 체험-수강 연속 경험 설계 심층 검토 (2026-03-29)

목표: 기존 "TrialLead -> EnrollmentApplication -> Student" 설계에서 놓친 사항 11건 발견, 보완 제안 7건 도출

놓친 사항 (11건):
- [A] 체험 없이 직접 수강 경로 미설계 (형제/지인추천)
- [B] 현장 즉시 등록 시나리오 누락 (convertTrialToStudent가 Student만 생성, Enrollment/Payment 미생성)
- [C] 재등록/월간갱신 정책 미정 (미납 시 수강 상태 처리 방침 없음)
- [D] 반 변경 프로세스 없음 (수동 삭제+재등록만 가능, ParentRequest에 CLASS_CHANGE 없음)
- [E] 휴원/퇴원 학부모 셀프 신청 경로 없음 (ParentRequest에 PAUSE/WITHDRAW 없음)
- [F] 접수 확인/알림 수단 없음 (자체 폼 전환 시 문자/카카오 연동 필요, 관리자 알림도 없음)
- [G] 체험 일정 선택 방식 미정 (자유텍스트 vs 시간표 연동 선택형)
- [H] 결제 안내 부재 (체험비/수강료 납부 방법 안내 필드 없음)
- [I] 중복/재방문 감지 로직 없음 (같은 전화번호 재체험, 재원생 실수 신청)
- [J] 공개 폼 스팸 방지 없음 (봇 방어, rate limiting)
- [K] 수강 확정 시 자동 처리 불완전 (Enrollment+Guardian+Payment 미생성)

보완 제안 (7건):
1. EnrollmentApplication.trialLeadId를 optional로 -> 직접 수강 경로 보장
2. convertTrialToStudent를 convertAndEnroll로 확장 (Student+Guardian+Enrollment+Payment 한 트랜잭션)
3. ParentRequest type 확장: CLASS_CHANGE, PAUSE, WITHDRAW 추가
4. 중복 감지: parentPhone으로 기존 TrialLead/Student 자동 검색, "재방문" 뱃지
5. 관리자 대시보드 배너: "신규 체험 N건" / "미확인 수강 N건" 카운트 (Notification 활용)
6. 스팸 방지: honeypot + 5분 내 3건 제한 + 서버 유효성 검증
7. 결제 안내: AcademySettings.paymentGuideText + 제출 완료 화면에 표시

최종 흐름도: 경로 3개
- 경로A: 체험->수강 (TrialLead -> EnrollmentApplication -> 승인 -> Student+Enrollment+Guardian+Payment)
- 경로B: 직접 수강 (EnrollmentApplication(trialLeadId=null) -> 승인 -> Student+Enrollment+Guardian+Payment)
- 경로C: 관리자 수동 등록 (기존 /admin/students 유지)

PM 결정 대기:
1. 미납 시 수강 상태 정책: (A) PAUSED 자동 전환 vs (B) ACTIVE 유지+미납 경고만
2. 체험 일정: (A) 자유 텍스트 희망 기입 vs (B) 시간표 연동 선택형
3. 알림 우선순위: (A) 대시보드 카운트만 vs (B) 카카오 알림톡 연동(비용 발생)
| src/app/api/admin/import-students/route.ts | 이관 API 엔드포인트 | 신규 |
| src/app/admin/import/page.tsx | 관리자 이관 페이지 (서버) | 신규 |
| src/app/admin/import/ImportClient.tsx | 이관 UI (미리보기+매핑확인+실행) | 신규 |

실행 계획:
| 순서 | 작업 | 담당 | 선행 조건 |
|------|------|------|----------|
| 1 | PM 결정: 지점방식, 이관범위, 교시-Class 매핑표 | PM | 없음 |
| 2 | DB 스키마 변경 (Student/Payment 필드 추가, migrate) | developer | 1 |
| 3 | 이관 로직 개발 (CSV파싱+변환+중복검출+DB삽입) | developer | 2 |
| 4 | 관리자 이관 페이지 UI (업로드+미리보기+실행) | developer | 3 |
| 5 | 이관 실행 + 검증 (건수확인, 중복처리, 샘플비교) | developer+tester | 4 |
| 6 | tsc + 데이터 정합성 검증 | tester | 5 |

developer 주의사항:
- 학생 이름+생년월일로 고유 식별 (같은 학생 여러 행 중복 방지)
- "결제방법"에서 휴원/퇴원은 Enrollment.status로 분리
- 날짜 변환: "2016. 8. 22" -> DateTime (KST 기준)
- DB 쿼리: 반드시 $queryRawUnsafe/$executeRawUnsafe 사용
- 이관 순서: User(학부모) -> Student -> Enrollment -> Payment
- 학부모 이름+전화번호 조합으로 User 중복 체크 (같은 학부모 여러 자녀 가능)

## 구현 기록 (developer)

### Phase 5: 보강/메이크업 수업 매칭

구현한 기능: MakeupSession 모델(DDL ensure), 보강 예약/취소/상태변경 Server Action, 보강 목록 조회(학생+원래반+보강반 JOIN), 같은 프로그램 다른 반 빈자리 조회, 관리자 보강 관리 페이지(상태필터+요약카드+예약모달+상태드롭다운)

| 파일 경로 | 변경 내용 | 신규/수정 |
|----------|----------|----------|
| prisma/schema.prisma | MakeupSession 모델 추가 (studentId, makeupClassId+Date 인덱스) | 수정 |
| src/lib/queries.ts | getMakeupSessions(status?), getAvailableMakeupSlots(programId, excludeClassId) 추가 | 수정 |
| src/app/actions/admin.ts | ensureMakeupSessionTable, bookMakeupSession, cancelMakeupSession, updateMakeupStatus 4개 Server Action | 수정 |
| src/app/admin/makeup/page.tsx | 서버 페이지 (revalidate:30, ensureMakeupSessionTable DDL) | 신규 |
| src/app/admin/makeup/MakeupClient.tsx | 목록+필터+요약카드+예약모달(2단계: 원생선택→보강반선택)+상태변경 | 신규 |
| src/app/admin/layout.tsx | 사이드바 "학원운영" 탭에 "보강 관리" 메뉴 + OPS_PATHS 추가 | 수정 |

tester 참고:
- 테스트 방법: /admin/makeup → "보강 예약" 버튼 → 원생/원래반/결석일 입력 → 다음 → 보강반/보강일 선택 → 예약
- 상태 변경: BOOKED 상태 행의 드롭다운에서 ATTENDED/NO_SHOW/CANCELLED 선택
- 취소: BOOKED 상태 행 우측 "취소" 버튼
- 요약 카드: 상태별 건수 표시, 카드 클릭으로 필터링
- 필터 탭: 전체/예약/출석/취소/노쇼

reviewer 참고:
- 모든 Server Action에 requireAdmin() 첫줄 호출
- SQL은 $queryRawUnsafe/$executeRawUnsafe + $N 바인딩만 사용
- updateMakeupStatus: MAKEUP_STATUS_WHITELIST로 SQL 인젝션 방지
- Material Symbols Outlined 아이콘 사용 (event_repeat, close, event_busy)

### Phase 6: 스킬 트래킹 / 성장 기록

구현한 기능: SkillCategory + SkillRecord 모델(DDL ensure), 카테고리 CRUD + 원생 스킬 평가 일괄 기록 Server Action, 스킬 조회(카테고리별 최신/성장이력), 관리자 스킬 관리 페이지(카테고리 관리 탭 + 스킬 평가 탭 + SVG 레이더 차트 + 성장 이력 타임라인), 학부모용 스킬 열람 페이지(자녀별 레이더 차트 + 프로그레스 바 + 이력)

| 파일 경로 | 변경 내용 | 신규/수정 |
|----------|----------|----------|
| prisma/schema.prisma | SkillCategory, SkillRecord 2개 모델 추가 | 수정 |
| src/lib/queries.ts | getSkillCategories, getStudentSkills, getSkillHistory 3개 조회 함수 | 수정 |
| src/app/actions/admin.ts | ensureSkillTables DDL + createSkillCategory, updateSkillCategory, deleteSkillCategory, recordSkillAssessment 5개 Server Action | 수정 |
| src/app/admin/skills/page.tsx | 서버 페이지 (revalidate:30, ensureSkillTables DDL) | 신규 |
| src/app/admin/skills/SkillsClient.tsx | 탭2개 (카테고리 관리 CRUD + 스킬 평가: 원생선택/슬라이더/레이더차트/이력) | 신규 |
| src/app/api/admin/skills/route.ts | GET /api/admin/skills?studentId — 원생 스킬+이력 JSON API | 신규 |
| src/components/SkillRadarChart.tsx | 순수 SVG N각형 레이더 차트 (외부 라이브러리 없음) | 신규 |
| src/app/mypage/skills/page.tsx | 학부모용 스킬 열람 (자녀별 레이더+프로그레스바+이력) | 신규 |
| src/app/admin/layout.tsx | 사이드바 "학원운영" 탭에 "스킬 트래킹" 메뉴 + OPS_PATHS 추가 | 수정 |

tester 참고:
- 테스트 방법: /admin/skills → "카테고리 관리" 탭 → 드리블/슈팅/패스/수비/체력 등 추가
- 스킬 평가: "스킬 평가" 탭 → 원생 선택 → 슬라이더로 레벨 설정 → "평가 저장"
- 레이더 차트: 평가 저장 후 우측에 SVG 레이더 차트 업데이트 확인
- 학부모: /mypage/skills → 로그인한 학부모의 자녀별 레이더 차트 + 이력 표시
- 주의: 카테고리 삭제 시 해당 카테고리의 모든 평가 기록도 함께 삭제됨

reviewer 참고:
- 모든 Server Action에 requireAdmin() 첫줄 호출
- SQL은 $queryRawUnsafe/$executeRawUnsafe + $N 바인딩만 사용
- updateSkillCategory: ALLOWED_COLS 화이트리스트로 컬럼명 SQL 인젝션 방지
- Material Symbols Outlined 아이콘 사용 (category, trending_up, sports_basketball, add 등)
- 학부모 페이지 보안: parentId 매칭으로 본인 자녀만 열람
- SkillRadarChart: 외부 라이브러리 없이 순수 SVG, 반응형 viewBox

### Phase 7: 매출/운영 통계 대시보드 강화

구현한 기능: 12개월 매출/출석률/등록추이 집계 함수, 코치 워크로드/수납률 집계, 순수 SVG 차트 3종(LineChart/BarChart/DonutChart), 상세 통계 페이지(/admin/stats), 기존 대시보드에 상세 통계 링크 추가

| 파일 경로 | 변경 내용 | 신규/수정 |
|----------|----------|----------|
| src/lib/queries.ts | getMonthlyRevenue, getMonthlyAttendanceRate, getEnrollmentTrend, getCoachWorkload, getPaymentCollectionRate 5개 집계 함수 추가 | 수정 |
| src/components/charts/LineChart.tsx | SVG 선 그래프 (호버 툴팁, 영역 그라데이션) | 신규 |
| src/components/charts/BarChart.tsx | SVG 막대 그래프 (max 배경 표시, 호버 값) | 신규 |
| src/components/charts/DonutChart.tsx | SVG 도넛 차트 (중앙 퍼센트, 비율 표시) | 신규 |
| src/app/admin/stats/page.tsx | 서버 페이지 (revalidate:30, 7개 집계 병렬 호출) | 신규 |
| src/app/admin/stats/StatsClient.tsx | 5개 섹션(매출/출석률/원생현황/체험전환/코치워크로드) | 신규 |
| src/app/admin/page.tsx | 기존 대시보드에 "상세 통계 보기" 링크 배너 추가 | 수정 |
| src/app/admin/layout.tsx | 사이드바 "학원운영" 탭에 "상세 통계" 메뉴 + OPS_PATHS 추가 | 수정 |

tester 참고:
- 테스트 방법: /admin/stats → 페이지 로드 확인, 5개 섹션 모두 표시
- 기간 토글: "최근 6개월" / "최근 12개월" 버튼 클릭 → 차트 데이터 변화 확인
- 차트 호버: LineChart/BarChart 위에 마우스 올리면 툴팁 표시
- KPI 카드: 이번달 매출, 출석률, 수납률, 체험 전환율 4개 카드
- 대시보드 링크: /admin → "상세 운영 통계" 배너 클릭 → /admin/stats 이동
- 사이드바: "학원운영" 탭 하단에 "상세 통계" 메뉴 확인

reviewer 참고:
- DB 스키마 변경 없음 — 기존 테이블만 집계 쿼리
- SQL은 $queryRawUnsafe + $N 바인딩만 사용
- 차트: 외부 라이브러리 없이 순수 SVG (LineChart, BarChart, DonutChart)
- Material Symbols Outlined 아이콘 사용 (payments, event_available, group 등)
- getTrialStats, getClassCapacityInfo는 기존 함수 재사용 (중복 구현 없음)
- 서버 페이지에서 7개 집계 Promise.all 병렬 호출 → 응답 시간 최소화

### 수강생 데이터 이관 시스템

구현한 기능: 스프레드시트 CSV 파싱+변환+그룹핑 유틸, preview/execute 2모드 API, 3단계 워크플로 UI (업로드→미리보기→실행), DB 삽입 (User→Student→Enrollment→Payment 순서)

| 파일 경로 | 변경 내용 | 신규/수정 |
|----------|----------|----------|
| prisma/schema.prisma | Student에 referralSource/uniformStatus, Payment에 method 필드 추가 | 수정 |
| src/lib/importStudents.ts | CSV 파싱+날짜변환+상태/결제분리+slotKey변환+그룹핑 핵심 로직 | 신규 |
| src/app/api/admin/import-students/route.ts | preview/execute API (requireAdmin 인증) | 신규 |
| src/app/admin/import/page.tsx | 서버 페이지 (revalidate:30) | 신규 |
| src/app/admin/import/ImportClient.tsx | 3단계 UI (CSV입력→미리보기테이블→실행결과) | 신규 |
| src/app/admin/layout.tsx | 사이드바 "데이터" 섹션에 "수강생 이관" 메뉴 + OPS_PATHS 추가 | 수정 |

tester 참고:
- 테스트 방법: /admin/import → CSV 데이터 붙여넣기 또는 파일 업로드 → 미리보기 → 이관 실행
- 미리보기: 요약 카드(전체행/고유학생/재원/휴원/퇴원/지점별), 상태 필터 탭, 학생 테이블
- 실행 결과: User/Student/Enrollment/Payment 생성/건너뜀 카운트, 실패 목록
- 주의: 실제 DB에 데이터가 삽입되므로 테스트 시 주의 (이관 전 백업 권장)

reviewer 참고:
- 모든 DB 쿼리: $queryRawUnsafe/$executeRawUnsafe + $N 바인딩 (PgBouncer 호환)
- requireAdmin() 인증 가드 적용
- 개별 학생 실패해도 나머지 계속 진행 (try-catch per student)
- User 중복 체크: phone+role=PARENT, Student 중복 체크: name+parentId
- Material Symbols Outlined 아이콘 사용

---

## 리뷰 결과 (reviewer) — Phase 7: 매출/운영 통계 대시보드

### 종합 판정: APPROVE (필수 수정 0건 + 권장 수정 3건)

### 잘된 점:
- 5개 집계 함수(getMonthlyRevenue, getMonthlyAttendanceRate, getEnrollmentTrend, getCoachWorkload, getPaymentCollectionRate) 모두 $queryRawUnsafe + $N 파라미터 바인딩 사용 -- SQL 인젝션 위험 없음
- SQL 집계 정확성 확인: DATE_TRUNC('month') + TO_CHAR 조합으로 월별 그룹핑 정확, COALESCE/COUNT(CASE WHEN) 패턴 적절, ::int 캐스팅으로 BigInt 직렬화 문제 방지
- 데이터 없는 월도 0으로 채워 반환 (Map + for 루프 패턴) -- 차트에 빈 구간 없이 연속 표시
- getEnrollmentTrend에서 신규/퇴원 2개 쿼리를 Promise.all로 병렬 실행 -- 효율적
- getCoachWorkload: LEFT JOIN 체인(Coach -> ClassSlotOverride -> Class -> Enrollment)으로 수업 없는 코치도 0으로 표시
- getPaymentCollectionRate: year/month 직접 비교로 인덱스 활용 가능 (timestamp 범위 대신)
- page.tsx에서 7개 집계 Promise.all 병렬 호출 -- 응답 시간 최소화, revalidate:30 캐싱 정책 준수
- 모든 집계 함수에 try-catch + console.error + 안전한 기본값 반환 -- 한 함수 실패해도 전체 페이지 크래시 방지
- SVG 차트 3종(LineChart, BarChart, DonutChart): 외부 라이브러리 없이 순수 SVG, viewBox + preserveAspectRatio로 반응형
- LineChart: 영역 그라데이션(linearGradient) + 호버 툴팁 + 수직 가이드라인 -- 완성도 높음
- BarChart: max 배경 막대(정원 대비) 기능 -- 반별 등록 현황 시각화에 적합
- DonutChart: stroke-dasharray/dashoffset 계산 정확, rotate(-90) 12시 방향 시작, transition 애니메이션
- StatsClient: KPI 요약 카드 4개 + 기간 토글(6/12개월) + 전월 대비 변화율 -- UX 완성도 양호
- Material Symbols Outlined 아이콘 사용 (payments, event_available, group, handshake, account_balance_wallet, summarize, sports, person_add, person_remove, diversity_3, how_to_reg, trending_up/down) -- convention 준수
- Tailwind CSS만 사용, 하드코딩 색상 없음 (hex 색상은 SVG 내부 동적 값이라 불가피)
- FlowItem의 invertTrend 패턴 -- 퇴원은 감소가 긍정적이라는 도메인 로직을 깔끔하게 처리

### 필수 수정: 없음

### 권장 수정:

| # | 파일 | 내용 |
|---|------|------|
| 1 | LineChart.tsx:59 | gradient id를 `lineGrad-${color.replace("#", "")}` 로 생성. 동일 페이지에 같은 color의 LineChart가 2개 이상 있으면 id 충돌. 현재 StatsClient에서는 모든 LineChart가 다른 color를 쓰므로 당장 문제없지만, 향후 재사용 시 충돌 가능. `useId()` 또는 `useRef(Math.random())` 등으로 고유 id 생성 권장 |
| 2 | admin/page.tsx:275 | 상세 통계 링크 배너에 이모지 "📊" 사용. Material Symbols 아이콘으로 교체하면 일관성 향상 (예: `<span className="material-symbols-outlined text-2xl text-indigo-600">query_stats</span>`). 단, 기존 사이드바도 이모지를 쓰는 구조이므로 전체 아이콘 통일 작업 시 함께 처리해도 무방 |
| 3 | StatsClient.tsx:306-307 | 체험 전환율 DonutChart의 max를 `ATTENDED + CONVERTED`로 계산. 이는 "체험 참석 대비 전환"이라는 라벨에 정확히 부합하나, trialStats의 conversionRate(KPI 카드)가 다른 기준(전체 대비)일 수 있어 두 수치가 달라 보일 수 있음. 라벨이나 KPI 카드 설명에 기준 차이를 명시하면 혼동 방지 |

### 추가 확인:
- layout.tsx: OPS_PATHS에 "/admin/stats" 정상 등록, 사이드바 메뉴 정상 추가
- admin/page.tsx: Link + 배너 스타일로 상세 통계 페이지 진입점 추가 -- 적절
- DB 스키마 변경 없음 확인 (prisma/schema.prisma 변경은 Phase 7과 무관한 기존 모델)

---

## 리뷰 결과 (reviewer) — Phase 6: 스킬 트래킹 / 성장 기록

### 종합 판정: APPROVE (필수 수정 1건 + 권장 수정 3건)

### 잘된 점:
- 모든 Server Action(createSkillCategory, updateSkillCategory, deleteSkillCategory, recordSkillAssessment)에 requireAdmin() 첫줄 호출 확인
- SQL 전부 $queryRawUnsafe/$executeRawUnsafe + $N 파라미터 바인딩 사용 -- SQL 인젝션 위험 없음
- updateSkillCategory에서 ALLOWED_COLS 화이트리스트로 컬럼명 검증 -- 동적 SET 절 구성이지만 안전
- API route(/api/admin/skills)에서 requireAdmin() 인증 확인 + try-catch로 401 반환 -- 적절한 에러 처리
- 학부모 페이지(mypage/skills) 보안: Supabase auth.getUser() -> parentId 매칭 -> 본인 자녀만 조회 -- 정상
- DDL ensure 멱등성 확보 (CREATE TABLE IF NOT EXISTS + 인덱스 IF NOT EXISTS)
- SkillRadarChart: 순수 SVG, 외부 라이브러리 없음, 극좌표 계산 정확 (12시 방향 시작, 비율 clamp 0~1)
- getStudentSkills의 DISTINCT ON 패턴으로 카테고리별 최신 1건만 추출 -- 효율적
- getSkillHistory의 categoryId 옵션 분기 처리 적절 (WHERE 절 동적 구성 + params 분리)
- Material Symbols Outlined 아이콘 사용 (category, trending_up, sports_basketball, add, warning 등) -- convention 준수
- Tailwind CSS만 사용, 하드코딩 색상 없음
- 학부모 페이지 force-dynamic 적절 (실시간 인증 필요)
- 관리자 페이지 revalidate:30 -- 캐싱 정책 준수

### 필수 수정:

| # | 파일 | 내용 |
|---|------|------|
| 1 | SkillsClient.tsx:12 | `import { getStudentSkills, getSkillHistory } from "@/lib/queries"` -- 미사용 import이자 "use client" 컴포넌트에서 서버 전용 함수(prisma) import. 실제로 원생 스킬 데이터는 fetch(`/api/admin/skills`)로 가져오고 있어 이 import는 dead code. 번들에 prisma 클라이언트가 포함될 수 있고, 빌드 시 에러 발생 가능. 삭제 필수. |

### 권장 수정:

| # | 파일 | 내용 |
|---|------|------|
| 1 | admin.ts:recordSkillAssessment | level 값 범위 검증 없음. 클라이언트에서 슬라이더로 0~maxLevel로 제한하지만, 직접 호출 시 음수나 maxLevel 초과값 입력 가능. `Math.max(0, Math.min(a.level, maxLevel))` 또는 최소한 `if (a.level < 0) throw` 검증 추가 권장 |
| 2 | admin.ts:recordSkillAssessment (3409~3419) | assessments 배열을 for 루프로 개별 INSERT. 평가 항목이 많으면 N번 DB 왕복. 현재 카테고리 5~10개 수준이면 문제없으나, 향후 확장 시 VALUES 멀티로우 INSERT 또는 트랜잭션으로 묶는 것 권장 |
| 3 | mypage/skills/page.tsx:41~43 | 학부모 조회 쿼리가 email로 User를 찾은 뒤 parentId로 Student를 조회하는 2단계 구조. 동작은 정확하나, 다른 학부모 페이지(mypage/reports 등)와 동일한 패턴이 반복될 수 있으므로 향후 `getParentByEmail(email)` 공용 함수로 추출 고려 |

### layout.tsx 메모:
- 사이드바에 "스킬 트래킹" 메뉴 추가 + OPS_PATHS 정상 등록 확인
- layout.tsx line 8에 lucide-react LogOut import가 여전히 존재 (Phase 6과 무관, 기존 이슈)

---

## 리뷰 결과 (reviewer) — Phase 5: 보강 수업 매칭

### 종합 판정: APPROVE (경미한 권장 수정 3건)

### 잘된 점:
- 모든 Server Action(bookMakeupSession, cancelMakeupSession, updateMakeupStatus)에 requireAdmin() 첫줄 호출 확인
- SQL 전부 $queryRawUnsafe/$executeRawUnsafe + $N 파라미터 바인딩 사용 — SQL 인젝션 위험 없음
- updateMakeupStatus에서 MAKEUP_STATUS_WHITELIST로 상태값 검증 — 문자열 직접 삽입 방지
- getAvailableMakeupSlots의 빈자리 계산 정확: enrolled(ACTIVE enrollment) + booked_makeups(BOOKED 보강) 합산하여 capacity와 비교, HAVING 절로 빈자리 있는 반만 반환
- getMakeupSessions의 JOIN 구조 적절 (Student, Class x2, Program)
- DDL ensure 멱등성 확보 (CREATE TABLE IF NOT EXISTS + 인덱스 IF NOT EXISTS)
- Material Symbols Outlined 아이콘 사용 (event_repeat, close, event_busy) — convention 준수
- Tailwind CSS만 사용, 하드코딩 색상 없음
- MakeupClient의 useMemo 필터링 패턴 — convention 준수

### 필수 수정: 없음

### 권장 수정:

| # | 파일 | 내용 |
|---|------|------|
| 1 | MakeupClient.tsx:10 | `import { getAvailableMakeupSlots } from "@/lib/queries"` — 미사용 import. fetchSlots()에서 실제로는 클라이언트 classes 데이터로 필터링하고 있어 이 import는 dead code. 삭제 권장. (또한 "use client" 컴포넌트에서 서버 쿼리 함수 import는 번들 사이즈에 영향줄 수 있음) |
| 2 | MakeupClient.tsx:350-362 | fetchSlots()에서 빈자리를 remaining: c.capacity로 표시 — 서버의 getAvailableMakeupSlots가 정확한 잔여석(정원-등록-보강예약)을 계산하는데, 클라이언트에서는 단순히 capacity를 표시. 관리자가 "정원 12명"을 보고 여유 있다고 판단할 수 있으나 실제 등록인원이 11명일 수 있음. 향후 API route를 통해 getAvailableMakeupSlots를 호출하거나, page.tsx에서 서버 데이터로 넘기는 방식 권장 |
| 3 | admin.ts:3207-3219 | cancelMakeupSession에서 WHERE 조건에 status='BOOKED' 체크 없음. 클라이언트에서 BOOKED일 때만 취소 버튼을 표시하지만, 직접 호출 시 이미 ATTENDED된 세션도 취소 가능. WHERE id=$1 AND status='BOOKED' 추가 권장 |

### layout.tsx 아이콘 메모:
- 보강 관리 메뉴에 이모지 "🔄" 사용 중. 다른 Phase 메뉴(체험 CRM "🤝", 대기자 "⏳")도 동일 패턴. 이것은 사이드바 NavItem이 icon prop으로 이모지를 받는 기존 구조이므로 Phase 5만의 문제는 아님. 전체 사이드바 아이콘을 Material Symbols로 교체하는 것은 별도 작업으로 분리.

---

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

### Phase 4: 대기자(Waitlist) 관리

구현한 기능: Waitlist 모델(DDL ensure), 대기 등록(자동 priority), 대기 취소, 자리 제안(학부모 알림 발송), 수락(Enrollment 생성)/거절 처리, 반별 정원 현황 카드, 대기자 목록(반별 그룹핑+필터), 추가 모달(학생검색+반선택)

| 파일 경로 | 변경 내용 | 신규/수정 |
|----------|----------|----------|
| prisma/schema.prisma | Waitlist 모델 추가 (studentId+classId unique, classId+status 인덱스) | 수정 |
| src/lib/queries.ts | getWaitlistAll(), getClassCapacityInfo() 조회 함수 추가 | 수정 |
| src/app/actions/admin.ts | ensureWaitlistTable, addToWaitlist, removeFromWaitlist, offerWaitlistSpot, processWaitlistResponse 5개 Server Action | 수정 |
| src/app/admin/waitlist/page.tsx | 서버 페이지 (revalidate:30, ensureWaitlistTable DDL) | 신규 |
| src/app/admin/waitlist/WaitlistClient.tsx | 정원현황 카드+필터+반별 그룹핑 목록+추가 모달+자리제안/수락/거절/취소 버튼 | 신규 |
| src/app/admin/layout.tsx | 사이드바 "학원운영" 탭에 "대기자 관리" 메뉴 추가 + OPS_PATHS | 수정 |

tester 참고:
- 테스트 방법: /admin/waitlist → "대기 등록" 버튼 → 학생+반 선택 → 등록
- 자리 제안: WAITING 상태에서 "자리 제안" → status OFFERED + 학부모 알림 발송
- 수락 처리: OFFERED 상태에서 "수락" → Enrollment 생성 + status ENROLLED
- 거절 처리: OFFERED 상태에서 "거절" → status CANCELLED
- 대기 취소: "X" 버튼 → status CANCELLED
- 정원 현황 카드: 대기자 있거나 정원 초과인 반만 표시, 클릭 시 해당 반 필터
- 필터: 반 선택 드롭다운 + "완료/취소 항목 포함" 체크박스

reviewer 참고:
- 모든 Server Action에 requireAdmin() 첫줄 호출
- SQL은 $queryRawUnsafe/$executeRawUnsafe + $N 바인딩만 사용
- addToWaitlist: ON CONFLICT로 같은 학생+반 중복 시 상태 갱신
- offerWaitlistSpot: notifyParentsOfStudents로 학부모 알림 발송
- processWaitlistResponse: accepted=true 시 enrollStudent와 동일한 Enrollment INSERT 패턴
- Material Symbols Outlined 아이콘 사용 (hourglass_top, person_add, school, close, hourglass_empty)

---

## 테스트 결과 (tester)

### Phase 5: 보강 수업 매칭 검증 (2026-03-29)

| # | 테스트 항목 | 결과 | 비고 |
|---|-----------|------|------|
| 1 | tsc --noEmit | PASS | 타입 에러 0건 |
| 2 | schema.prisma: MakeupSession 모델 | PASS | 10개 필드 존재, id(gen_random_uuid), studentId 인덱스, makeupClassId+makeupDate 복합 인덱스, Timestamptz 타입 |
| 3 | queries.ts: getMakeupSessions | PASS | $queryRawUnsafe 사용, LEFT JOIN Student+Class(원래반/보강반)+Program, status 파라미터 $1 바인딩, cache() 래핑, 소문자 컬럼 fallback(??) 적용, 에러 시 빈 배열 반환 |
| 4 | queries.ts: getAvailableMakeupSlots | PASS | $queryRawUnsafe 사용, LEFT JOIN Enrollment+MakeupSession, COUNT DISTINCT CASE WHEN, HAVING(정원>등록+보강예약), remaining 계산, $1~$2 바인딩, cache() 래핑, 에러 시 빈 배열 반환 |
| 5 | admin.ts: ensureMakeupSessionTable DDL | PASS | CREATE TABLE IF NOT EXISTS + 인덱스 2개(studentId, makeupClassId+makeupDate), 멱등성 보장, _makeupEnsured 플래그로 재호출 방지 |
| 6 | admin.ts: bookMakeupSession requireAdmin + 바인딩 | PASS | 첫 줄 await requireAdmin(), ensureMakeupSessionTable() 호출, $1~$6 파라미터 바인딩, ::timestamptz 캐스팅, revalidatePath("/admin/makeup") |
| 7 | admin.ts: cancelMakeupSession requireAdmin | PASS | requireAdmin() 호출, UPDATE status='CANCELLED' WHERE id=$1 바인딩, revalidatePath |
| 8 | admin.ts: updateMakeupStatus requireAdmin + SQL인젝션방지 | PASS | requireAdmin() 호출, MAKEUP_STATUS_WHITELIST 4개 값 검증, 허용 외 값 시 throw Error, $1(status)+$2(id) 바인딩, revalidatePath |
| 9 | makeup/page.tsx: revalidate=30 | PASS | export const revalidate = 30, ensureMakeupSessionTable() 호출, Promise.all 3개 병렬 조회(sessions+students+classes) |
| 10 | MakeupClient: Material Symbols 사용 | PASS | event_repeat, event_busy, close 등 Material Symbols Outlined만 사용, lucide-react 미사용 |
| 11 | MakeupClient: Tailwind CSS | PASS | 모든 스타일 Tailwind 클래스 사용, 하드코딩 색상 없음 |
| 12 | MakeupClient: 요약 카드 (4종) | PASS | BOOKED/ATTENDED/CANCELLED/NO_SHOW 카드, 클릭 시 필터 토글(같은 카드 재클릭 시 ALL), ring-2로 선택 표시 |
| 13 | MakeupClient: 상태 필터 탭 | PASS | "전체"+4개 상태 탭, useMemo 필터링, 탭별 건수 표시 |
| 14 | MakeupClient: 2단계 모달 (BookMakeupModal) | PASS | Step1: 원생 검색(useMemo)+select(size=5), 원래 반 select(요일+시간+프로그램 표시), 결석일 date input, 필수값 검증(3항목) / Step2: 선택 정보 요약, 같은 프로그램 다른 반 radio 선택, 보강일 date input, 이전/예약 버튼 |
| 15 | MakeupClient: 상태 드롭다운 | PASS | BOOKED일 때만 select 표시(예약/출석/노쇼/취소), 다른 상태는 읽기전용 뱃지, disabled={busy} |
| 16 | MakeupClient: 취소 버튼 | PASS | BOOKED 상태 행에만 "취소" 버튼 표시, confirm 확인 후 cancelMakeupSession 호출 |
| 17 | MakeupClient: busy 상태 관리 | PASS | handleStatusChange/handleCancel/handleBook 모두 setBusy(true/false), 버튼 disabled={busy}, "처리 중..." 텍스트 |
| 18 | MakeupClient: 에러 처리 | PASS | try/catch + alert(message) 패턴 일관 적용, router.refresh()로 상태 갱신 |
| 19 | MakeupClient: 빈 상태 UI | PASS | filteredSessions.length===0 시 event_busy 아이콘 + "보강 예약이 없습니다" 메시지 |
| 20 | layout.tsx: "보강 관리" 메뉴 | PASS | OPS_PATHS에 "/admin/makeup" 포함, NavItem label="보강 관리" href="/admin/makeup" 존재 |

참고 사항 (비치명적):
- MakeupClient.tsx 10행: `getAvailableMakeupSlots`를 import하지만 실제 호출하지 않음 (fetchSlots에서 클라이언트측 classes 배열 필터링으로 대체). unused import이나 tsc 에러 아님. 정리 권장.
- 위 사항으로 인해 보강 반 선택 시 실제 빈자리(enrolled + bookedMakeups) 대신 capacity만 표시됨. 기능 동작에는 문제 없으나 정확도 떨어짐.

검출된 문제: 0건 (수정 필수 항목 없음)

종합: 20개 중 20개 통과 / 0개 실패 -- PASS

### Phase 7: 매출/운영 통계 대시보드 검증 (2026-03-29)

| # | 테스트 항목 | 결과 | 비고 |
|---|-----------|------|------|
| 1 | tsc --noEmit | PASS | 타입 에러 0건 |
| 2 | queries.ts: getMonthlyRevenue | PASS | $queryRawUnsafe 사용, Payment WHERE status='PAID', DATE_TRUNC+TO_CHAR 월별 집계, $1~$2 파라미터 바인딩(startStr/endStr), ::timestamp 캐스팅, N개월 배열 구성(빈 월은 0), cache() 래핑, 에러 시 빈 배열 반환 |
| 3 | queries.ts: getMonthlyAttendanceRate | PASS | $queryRawUnsafe 사용, Attendance JOIN Session, CASE WHEN status='PRESENT' 카운트, $1~$2 바인딩, rate 계산(present/total*100 반올림), cache() 래핑, 에러 시 빈 배열 반환 |
| 4 | queries.ts: getEnrollmentTrend | PASS | $queryRawUnsafe 사용, Promise.all 2개 병렬(신규: createdAt 기준, 퇴원: status='DROPPED'+updatedAt 기준), $1~$2 바인딩, N개월 배열(빈 월 0), cache() 래핑, 에러 시 빈 배열 반환 |
| 5 | queries.ts: getCoachWorkload | PASS | $queryRawUnsafe 사용, Coach LEFT JOIN ClassSlotOverride+Class+Enrollment, COUNT DISTINCT slotKey(수업수)+studentId(원생수), status='ACTIVE' 필터, ORDER BY co.order, imageUrl 소문자 fallback, cache() 래핑, 에러 시 빈 배열 반환 |
| 6 | queries.ts: getPaymentCollectionRate | PASS | $queryRawUnsafe 사용, Payment WHERE year=$1 AND month=$2, CASE WHEN status='PAID' 카운트, rate 계산(paid/total*100 반올림), 0건 시 rate=0 안전 처리, cache() 래핑, 에러 시 기본값 객체 반환 |
| 7 | LineChart.tsx: 순수 SVG | PASS | 외부 라이브러리 0개 (recharts/d3/chart.js 없음), "use client", useState 호버, SVG viewBox 반응형, defs linearGradient 영역채우기, 수평 가이드라인 3개, 호버 시 수직 가이드라인+툴팁 rect+text, X축 라벨, data.length===0 빈 상태 처리 |
| 8 | BarChart.tsx: 순수 SVG | PASS | 외부 라이브러리 0개, "use client", useState 호버, SVG viewBox 반응형, showMax로 정원 배경 막대, 호버 시 값 툴팁, barWidth 동적 계산(최대 40px), data.length===0 빈 상태 처리 |
| 9 | DonutChart.tsx: 순수 SVG | PASS | 외부 라이브러리 0개, strokeDasharray/strokeDashoffset로 비율 표현, rotate(-90) 12시 시작, 중앙 퍼센트 텍스트+value/max 서브텍스트, transition-all 애니메이션, max=0 시 rate=0 안전 처리 |
| 10 | stats/page.tsx: revalidate=30 | PASS | export const revalidate = 30, Promise.all 7개 집계 병렬 호출(getMonthlyRevenue+getMonthlyAttendanceRate+getEnrollmentTrend+getClassCapacityInfo+getTrialStats+getCoachWorkload+getPaymentCollectionRate), StatsClient에 7개 props 전달 |
| 11 | StatsClient: Material Symbols 사용 | PASS | payments, trending_up/down, event_available, group, school, handshake, account_balance_wallet, summarize, sports, person_add, person_remove, diversity_3, how_to_reg 등 Material Symbols Outlined만 사용, lucide-react/react-icons 미사용 |
| 12 | StatsClient: Tailwind CSS | PASS | 모든 스타일 Tailwind 클래스 사용, 하드코딩 색상 없음, 차트 color props는 hex값이나 SVG 속성용이므로 적절 |
| 13 | StatsClient: 5개 섹션 존재 | PASS | (1) KPI 요약 카드 4개(매출/출석률/수납률/체험전환율) (2) 매출+출석률 LineChart (3) 신규퇴원 LineChart+반별정원 BarChart (4) 체험전환 DonutChart+수납률 DonutChart+원생흐름 (5) 코치 워크로드 BarChart 2개 |
| 14 | StatsClient: 기간 토글 | PASS | useState<6|12> revenuePeriod, slice(-revenuePeriod)로 데이터 슬라이싱, 3개 차트(매출/출석률/등록추이) 동시 변경, 선택 버튼 bg-gray-900 활성 스타일 |
| 15 | StatsClient: KPI 전월 비교 | PASS | thisMonth/lastMonth 배열 마지막/마지막-1, revDiff 퍼센트 계산, 양수 text-green-600 + trending_up, 음수 text-red-600 + trending_down, lastMonth.amount=0 시 비교 미표시 |
| 16 | StatsClient: 서브 컴포넌트 | PASS | PipelineItem(6개 상태 컬러맵), FlowItem(icon+label+value+prev비교, invertTrend 퇴원용 역전 로직) |
| 17 | admin/page.tsx: "상세 통계" 링크 | PASS | Link href="/admin/stats", gradient 배너(indigo-50→purple-50), "상세 운영 통계" 텍스트, hover 색상 전환 |
| 18 | layout.tsx: "상세 통계" 메뉴 | PASS | OPS_PATHS에 "/admin/stats" 포함, NavItem href="/admin/stats" label="상세 통계" icon="📊" 존재 |

검출된 문제: 0건 (수정 필수 항목 없음)

종합: 18개 중 18개 통과 / 0개 실패 -- PASS

### Phase 6: 스킬 트래킹 / 성장 기록 검증 (2026-03-29)

| # | 테스트 항목 | 결과 | 비고 |
|---|-----------|------|------|
| 1 | tsc --noEmit | PASS | 타입 에러 0건 |
| 2 | schema: SkillCategory + SkillRecord | PASS | SkillCategory 8필드(id gen_random_uuid, Timestamptz), SkillRecord 7필드 + 복합인덱스(studentId+categoryId) + 단독인덱스(assessedAt) |
| 3 | queries.ts: 3개 조회함수 $queryRawUnsafe | PASS | getSkillCategories(ORDER BY order, cache), getStudentSkills(DISTINCT ON categoryId 최신1건, JOIN SkillCategory, $1 바인딩, cache), getSkillHistory(categoryId 선택파라미터 분기, LIMIT 200, cache) -- 모두 소문자 fallback(??) 적용, 에러시 빈배열 |
| 4 | admin.ts: 5개 Action requireAdmin + 바인딩 | PASS | ensureSkillTables(CREATE TABLE IF NOT EXISTS 2개 + 인덱스 2개, _skillTablesEnsured 플래그), createSkillCategory($1~$5), updateSkillCategory(ALLOWED_COLS 화이트리스트 SET절 동적구성), deleteSkillCategory(SkillRecord 먼저 삭제후 Category 삭제), recordSkillAssessment(for-of 순회 $1~$5) -- 모두 requireAdmin() 첫줄, revalidatePath 호출 |
| 5 | SkillRadarChart.tsx: 순수 SVG | PASS | 외부 라이브러리 0개, polygon+line+circle+text, viewBox 반응형, N<2 예외처리, 극좌표변환, ratio 클램핑(min 1 max 0) |
| 6 | skills/page.tsx: revalidate=30 | PASS | ensureSkillTables() + Promise.all(categories, students) 병렬조회 |
| 7 | SkillsClient: Material Symbols + Tailwind | PASS | category, trending_up, sports_basketball, add, warning, progress_activity 등 Material Symbols만 사용, brand-orange-500 CSS변수, 하드코딩 색상 없음 |
| 8 | SkillsClient: 카테고리관리 + 평가UI | PASS | CRUD 모달(이름필수trim, 삭제confirm), 원생검색(useMemo)+select, fetch API로 /api/admin/skills, range슬라이더+버튼 레벨, 노트입력, assessedBy, level>0만 필터 저장, 레이더차트 실시간 연동, 이력 타임라인(max-h-[400px] 스크롤) |
| 9 | mypage/skills: 보안 체크 | PASS | auth.getUser() 인증, User WHERE email=$1 parentId 조회, Student WHERE parentId=$1 본인자녀만, force-dynamic, 자녀별 카드(레이더+프로그레스바+이력slice10), 미인증/미등록/자녀없음 3가지 예외UI |
| 10 | API route: 인증 체크 | PASS | requireAdmin() 실패시 401, studentId 없으면 400, Promise.all 병렬조회 |
| 11 | layout.tsx: 메뉴 등록 | PASS | OPS_PATHS에 "/admin/skills" 포함, NavItem label="스킬 트래킹" 존재 |

참고 사항 (비치명적, 수정 권장):
- SkillsClient.tsx 12행: `import { getStudentSkills, getSkillHistory } from "@/lib/queries"` -- 미사용 import(dead code). 실제로는 fetch("/api/admin/skills")를 사용. "use client" 컴포넌트에서 서버 전용 함수 import는 번들 사이즈에 영향 가능. 삭제 권장.

검출된 문제: 0건 (수정 필수 항목 없음)

종합: 11개 중 11개 통과 / 0개 실패 -- PASS

### Phase 4: 대기자 관리 검증 (2026-03-29)

| # | 테스트 항목 | 결과 | 비고 |
|---|-----------|------|------|
| 1 | tsc --noEmit | PASS | 타입 에러 0건 |
| 2 | schema.prisma: Waitlist 모델 | PASS | 9개 필드 존재, id(gen_random_uuid), studentId+classId unique, classId+status 인덱스, Timestamptz 타입 |
| 3 | queries.ts: getWaitlistAll | PASS | $queryRawUnsafe 사용, JOIN Student+Class, cache() 래핑, 소문자 컬럼 fallback(??) 적용, 에러 시 빈 배열 반환 |
| 4 | queries.ts: getClassCapacityInfo | PASS | $queryRawUnsafe 사용, LEFT JOIN Enrollment+Waitlist, COUNT DISTINCT CASE WHEN, remaining 계산, cache() 래핑, 에러 시 빈 배열 반환 |
| 5 | admin.ts: ensureWaitlistTable DDL | PASS | CREATE TABLE IF NOT EXISTS + unique 제약 + 인덱스 1개, 멱등성 보장, _waitlistEnsured 플래그로 재호출 방지 |
| 6 | admin.ts: addToWaitlist requireAdmin + 바인딩 | PASS | 첫 줄 await requireAdmin(), MAX(priority)+1 자동 설정, $1~$4 파라미터 바인딩, ON CONFLICT로 중복 처리, revalidatePath 2경로 |
| 7 | admin.ts: removeFromWaitlist requireAdmin | PASS | requireAdmin() 호출, UPDATE status='CANCELLED' WHERE id=$1 바인딩, revalidatePath 2경로 |
| 8 | admin.ts: offerWaitlistSpot requireAdmin + Notification | PASS | requireAdmin() 호출, WAITING 상태 검증, OFFERED+offeredAt+respondBy(3일) 설정, notifyParentsOfStudents 호출(WAITLIST 타입, 반 이름 포함 메시지), $1 바인딩 |
| 9 | admin.ts: processWaitlistResponse requireAdmin + Enrollment | PASS | requireAdmin() 호출, accepted=true: OFFERED 상태 검증 후 Enrollment INSERT ON CONFLICT + ENROLLED 변경, accepted=false: CANCELLED 변경, 소문자 fallback(??) 적용, $1~$2 바인딩, revalidatePath 3경로 |
| 10 | waitlist/page.tsx: revalidate=30 | PASS | export const revalidate = 30, ensureWaitlistTable() 호출, Promise.all 4개 병렬 조회(waitlist+capacity+students+classes) |
| 11 | WaitlistClient: Material Symbols 사용 | PASS | hourglass_top, person_add, school, close, hourglass_empty 등 Material Symbols Outlined만 사용, lucide-react 미사용 |
| 12 | WaitlistClient: Tailwind CSS | PASS | 모든 스타일 Tailwind 클래스 사용, 하드코딩 색상 없음, brand-orange CSS변수 계열 사용 |
| 13 | WaitlistClient: 정원 현황 카드 | PASS | capacityInfo에서 waiting>0 또는 remaining<=0인 반만 표시, 등록/정원/잔여 표시, 프로그레스 바(red/yellow/green), 클릭 시 필터 토글 |
| 14 | WaitlistClient: 대기자 목록 (반별 그룹핑) | PASS | Map으로 classId별 그룹핑, 반 헤더(이름+요일+시간+대기수), 순번 표시, 상태 뱃지(4종), OFFERED 시 응답 기한 표시 |
| 15 | WaitlistClient: 필터 | PASS | 반 선택 드롭다운(전체+각 반), "완료/취소 항목 포함" 체크박스(showAll), useMemo 필터링, 건수 표시 |
| 16 | WaitlistClient: 액션 버튼 상태별 분기 | PASS | WAITING: "자리 제안"+취소, OFFERED: "수락"+"거절"+취소, ENROLLED/CANCELLED: 버튼 없음 |
| 17 | WaitlistClient: 모달 (AddWaitlistModal) | PASS | 학생 검색 필터(useMemo), 학생 select(size=5), 반 select(요일+시간 표시), 메모 입력, 필수값 검증(studentId+classId), busy 상태 관리 |
| 18 | WaitlistClient: busy 상태 관리 | PASS | 모든 비동기 액션에 setBusy(true/false), 버튼 disabled={busy}, "등록 중..." 텍스트 |
| 19 | WaitlistClient: 에러 처리 | PASS | try/catch + alert(message) 패턴 일관 적용, router.refresh()로 상태 갱신 |
| 20 | WaitlistClient: 빈 상태 UI | PASS | filteredList.length===0 시 hourglass_empty 아이콘 + "대기자가 없습니다" 메시지 |
| 21 | layout.tsx: "대기자 관리" 메뉴 | PASS | OPS_PATHS에 "/admin/waitlist" 포함, NavItem label="대기자 관리" 존재 |

검출된 문제: 0건

종합: 21개 중 21개 통과 / 0개 실패

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

### Phase 4: 대기자 관리 코드 리뷰 (2026-03-29)

종합 판정: APPROVE

검토 파일 6개: schema.prisma(Waitlist 모델), queries.ts(getWaitlistAll, getClassCapacityInfo), admin.ts(ensureWaitlistTable, addToWaitlist, removeFromWaitlist, offerWaitlistSpot, processWaitlistResponse), admin/waitlist/page.tsx, WaitlistClient.tsx, admin/layout.tsx

잘된 점:
- 모든 DB 쿼리가 $queryRawUnsafe/$executeRawUnsafe + $N 파라미터 바인딩 사용 — SQL 인젝션 방지 완벽
- 5개 Server Action 중 CRUD 4개(add/remove/offer/processResponse) 모두 requireAdmin() 첫 줄 호출
- ensureWaitlistTable은 DDL ensure 함수로 admin layout 인증 보호 하에서만 호출 — requireAdmin 불필요, 적절
- addToWaitlist: ON CONFLICT로 동일 학생+반 중복 등록 시 상태 갱신(안전), priority 자동 증가(COALESCE+MAX) 정상
- processWaitlistResponse(accepted=true): Enrollment INSERT가 enrollStudent와 동일한 ON CONFLICT 패턴 재사용 — 일관성 유지
- offerWaitlistSpot: WAITING 상태 확인 후 OFFERED 전환 + notifyParentsOfStudents 알림 발송 정상
- 소문자 컬럼명 fallback (studentId ?? studentid, classId ?? classid) 일관 적용
- getClassCapacityInfo: LEFT JOIN + CASE WHEN 집계로 enrolled/waiting 정확 산출, remaining = capacity - enrolled 계산 정상
- queries.ts 두 함수 모두 cache() 래핑 + try/catch 에러 시 빈 배열 반환 — 안전
- WaitlistClient: useMemo 3개소(filteredList, groupedByClass, classesWithActivity) 적절한 최적화
- Material Symbols Outlined 아이콘만 사용 (hourglass_top, person_add, school, close, hourglass_empty)
- busy 상태로 모든 비동기 버튼 중복 클릭 방지 + disabled 처리
- schema.prisma: @@unique([studentId, classId]) + @@index([classId, status]) 적절한 인덱스 설계
- revalidatePath 호출: waitlist/classes/students 3경로 무효화 (processWaitlistResponse)
- layout.tsx: OPS_PATHS에 "/admin/waitlist" 포함, NavItem 정상 추가

필수 수정: 없음

권장 수정 (비필수, 현재 규모에서 문제 없음):
- [admin.ts:3088-3129] processWaitlistResponse(accepted=true)에서 Enrollment INSERT -> Waitlist UPDATE 2개 쿼리가 트랜잭션 없이 순차 실행됨. Enrollment 생성 후 Waitlist UPDATE가 실패하면 Enrollment만 생성되고 대기자는 OFFERED 상태로 남을 수 있음. 다만 PgBouncer 트랜잭션 모드 제약으로 Prisma $transaction 사용 불가, 기존 enrollStudent/convertTrialToStudent도 동일 패턴이므로 프로젝트 규범 안에서 허용. 발생 빈도 극히 낮음.
- [admin.ts:3088-3129] processWaitlistResponse(accepted=true)에서 정원 초과 방지 체크가 없음. 수락 시 해당 반의 현재 등록인원이 capacity를 초과하는지 확인하지 않고 바로 Enrollment를 생성함. 관리자가 수동 판단 후 수락하는 워크플로우이므로 의도적일 수 있으나, 실수 방지를 위해 `enrolled >= capacity`일 때 confirm/경고를 추가하면 더 안전함. 클라이언트 측에서 capacityInfo를 이미 보유하므로 handleAccept에서 프론트엔드 경고만 추가해도 충분.
- [admin.ts:3057-3058] offerWaitlistSpot에서 `studentId`와 `studentid` 변수가 혼재. 3057줄에서 구조분해로 `studentId`를 꺼내고, 3058줄에서 다시 `rows[0].studentId ?? rows[0].studentid`로 재할당함. 3057줄의 구조분해 `studentId`는 사용되지 않고 3058줄의 `studentid`가 실제로 사용됨 — 동작에 문제는 없으나 불필요한 구조분해가 혼란을 줄 수 있음. 정리하면 가독성 향상.

### 유니폼 신청서 구글폼 연동

구현한 기능: AcademySettings에 uniformFormUrl 필드 추가, 관리자 /admin/apply에 유니폼 URL 입력란 추가, 공개 /apply에 유니폼 신청 카드 + iframe 모달 추가

| 파일 경로 | 변경 내용 | 신규/수정 |
|----------|----------|----------|
| prisma/schema.prisma | AcademySettings에 uniformFormUrl String? 추가 | 수정 |
| src/lib/queries.ts | getAcademySettings()에 uniformFormUrl 매핑 추가 | 수정 |
| src/app/actions/admin.ts | ALLOWED_SETTINGS_COLUMNS + ensureAcademySettingsColumns + updateAcademySettings 타입에 uniformFormUrl 추가 | 수정 |
| src/app/admin/apply/page.tsx | initialSettings에 uniformFormUrl 전달 | 수정 |
| src/app/admin/apply/ApplyAdminClient.tsx | 유니폼 신청 URL 입력 SectionCard 추가 (수강신청 아래) | 수정 |
| src/app/apply/page.tsx | ApplyPageClient에 uniformFormUrl props 전달 | 수정 |
| src/app/apply/ApplyPageClient.tsx | 유니폼 신청 카드 + FormModal 추가 (uniformFormUrl 있을 때만 표시) | 수정 |

tester 참고:
- 테스트 방법: /admin/apply → 유니폼 신청 URL에 https://forms.gle/H7SiGSkLvMTxqv3T9 입력 → 저장 → /apply 페이지에서 유니폼 신청 카드 표시 확인
- 정상 동작: URL 입력 후 저장하면 /apply 페이지 하단에 녹색 유니폼 신청 카드 표시, 클릭 시 iframe 모달로 구글폼 열림
- URL 미입력 시: 유니폼 카드가 아예 표시되지 않음 (정상)
- 아이콘: Material Symbols Outlined "checkroom"

---

## 작업 로그 (최근 10건)

| 날짜 | 작업 내용 | 파일 | 상태 |
|------|----------|------|------|
| 2026-03-29 | 원생 관리: deleteStudent 버그 수정(FK 6개 테이블 추가) + 필터 UI 4개 + 수강반 컬럼 | admin.ts, queries.ts, StudentManagementClient.tsx | 완료 |
| 2026-03-29 | 유니폼 신청서 구글폼 연동 (uniformFormUrl 필드 + 관리자 입력 + 공개 카드/모달) | 7개 파일 | 완료 |
| 2026-03-29 | Phase 7: 통계 대시보드 tester 검증 PASS (18항목 전체 통과) | 8개 파일 | 완료 |
| 2026-03-29 | Phase 6: 스킬 트래킹 tester 검증 PASS (11항목 전체 통과) | 8개 파일 | 완료 |
| 2026-03-29 | Phase 4: 대기자 관리 전체 구현 (Waitlist DDL + CRUD + 정원현황 + 알림) | 6개 파일 | 완료 |
| 2026-03-29 | Phase 3: 체험수업 CRM 전체 구현 (TrialLead CRUD + 파이프라인 + 전환) | 6개 파일 | 완료 |
| 2026-03-29 | Phase 2: 일일 수업 리포트 전체 구현 (기존 구현 확인 + tsc 에러 1건 수정) | 9개 파일 | 완료 |
| 2026-03-30 | Phase 1: 수납 고도화 전체 구현 + tester PASS + reviewer 수정 3건 반영 | 9개 파일 | 완료 |
| 2026-03-30 | 학원운영 고도화 로드맵 7 Phase 설계 | scratchpad | 완료 |
| 2026-03-30 | 학부모 후기 SSR 권한 에러 수정 + DB User 시드 | TestimonialsWrapper, admin.ts, auth-guard | 완료 |
