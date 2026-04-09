# 작업 스크래치패드

## 현재 작업
- **요청**: 체험수업/수강신청 폼을 구글폼 외부 링크 방식으로 전환 (복귀 가능하게)
- **상태**: 기획설계 완료 -> developer 대기
- **현재 담당**: planner-architect 완료
- **마지막 세션**: 2026-04-06

## 기획설계 (planner-architect)

### 구글폼 전환 ON/OFF 설계

**목표**: 체험수업 신청과 수강신청을 자체 폼에서 구글폼 외부 링크로 전환하되, 나중에 다시 자체 폼으로 1분 만에 복귀할 수 있게 만든다.

**전환 방식: AcademySettings에 `useBuiltInForm` 플래그 추가**

DB의 AcademySettings 테이블에 `useBuiltInTrialForm` (boolean, 기본값 true)과 `useBuiltInEnrollForm` (boolean, 기본값 true) 컬럼 2개를 추가한다. 이 값이 false이면 구글폼 URL(이미 저장되어 있는 trialFormUrl/enrollFormUrl)로 외부 이동하고, true이면 현재처럼 자체 폼(/apply/trial, /apply/enroll)으로 이동한다.

비유: 건물 입구에 "자체 접수 창구"와 "외부 접수 창구" 두 개가 있는데, 스위치 하나로 어느 쪽 문을 열지 결정하는 것.

왜 환경변수가 아닌 DB 설정인가:
- 관리자가 코드 배포 없이 /admin/apply 설정 탭에서 ON/OFF 가능
- 체험/수강을 독립적으로 전환 가능 (체험만 구글폼, 수강은 자체 폼 등)
- 이미 AcademySettings 패턴이 확립되어 있어 추가 비용 최소

**영향 범위 분석**

구글폼 전환 시 비활성화되는 기능:
1. SMS 알림 (체험/수강 신청 시 관리자+코치+학부모 자동 SMS) -- 구글폼에는 훅이 없음
2. 관리자 대시보드 신규 신청 건수 배지 -- TrialLead에 NEW 상태가 안 들어옴
3. 체험 CRM 자동 연동 -- 구글폼 데이터는 구글 시트에 쌓임, DB에 안 들어옴
4. 수강 신청 목록 관리 (/admin/apply) -- EnrollmentApplication에 데이터 안 쌓임
5. 스팸 방지 (honeypot) -- 구글폼 자체 스팸 방지 사용
6. 슬롯 담당 코치 SMS 타겟팅 -- 구글폼에서는 불가

유지되는 기능:
1. /apply 페이지 자체 (카드 UI, FAQ, 안내 내용)
2. 유니폼 구글폼 (이미 구글폼)
3. 관리자 수동 체험 등록 (/admin/trial에서 직접 추가)
4. 시뮬레이터 (/simulator) -- 링크만 변경
5. 챗봇 안내 -- 링크 대상만 변경

**📍 만들 위치와 구조**

| 파일 경로 | 역할 | 신규/수정 |
|----------|------|----------|
| prisma/schema.prisma | AcademySettings에 useBuiltInTrialForm, useBuiltInEnrollForm 추가 | 수정 |
| src/app/actions/admin.ts | ensureAcademySettingsColumns DDL에 2개 컬럼 추가 + SETTINGS_KEYS에 추가 | 수정 |
| src/lib/queries.ts | getAcademySettings에서 새 필드 반환 | 수정 |
| src/app/apply/page.tsx | settings에서 useBuiltIn* 읽어서 ApplyPageClient에 전달 | 수정 |
| src/app/apply/ApplyPageClient.tsx | useBuiltIn*에 따라 Link 대상 분기 (/apply/trial vs 구글폼 URL) | 수정 |
| src/app/simulator/SimulatorClient.tsx | useBuiltIn*에 따라 CTA 링크 분기 | 수정 |
| src/app/simulator/page.tsx | useBuiltIn* 전달 | 수정 |
| src/app/admin/apply/ApplyAdminClient.tsx | 설정 탭에 ON/OFF 토글 2개 추가 | 수정 |
| src/app/admin/apply/page.tsx | useBuiltIn* 전달 | 수정 |
| src/app/api/chat/route.ts | 챗봇 ACTION 링크도 분기 | 수정 |

**기존 코드 연결**:
- ApplyPageClient.tsx에는 이미 FormModal(구글폼 iframe)이 남아있어 재활용 가능
- AcademySettings에 이미 trialFormUrl/enrollFormUrl 필드가 저장되어 있음
- /apply/trial, /apply/enroll 자체 폼 파일은 그대로 보존 (코드 삭제 없음)

**📋 실행 계획**

| 순서 | 작업 | 담당 | 선행 조건 |
|------|------|------|----------|
| 1 | schema.prisma + DDL ensure에 useBuiltInTrialForm/useBuiltInEnrollForm 추가 | developer | 없음 |
| 2 | queries.ts + admin.ts SETTINGS_KEYS에 새 필드 추가 | developer | 1 |
| 3 | /apply 페이지: ApplyPageClient에서 useBuiltIn* false일 때 구글폼 URL로 외부 이동 (새 탭) | developer | 2 |
| 4 | /admin/apply 설정 탭에 ON/OFF 토글 UI 추가 | developer | 2 |
| 5 | 시뮬레이터 + 챗봇 링크 분기 처리 | developer | 2 |
| 6 | tsc --noEmit + 수동 테스트 | tester | 3,4,5 |

**developer 주의사항**:
- 자체 폼 파일 (/apply/trial/*, /apply/enroll/*, actions/public.ts의 submit* 함수) 절대 삭제/수정하지 말 것
- useBuiltIn*가 false이고 구글폼 URL이 비어있으면 "구글폼 URL이 설정되지 않았습니다" 안내 표시
- 구글폼 링크는 새 탭(target="_blank")으로 열기 (사이트를 벗어나지 않게)
- DDL ensure 패턴 따를 것: ALTER TABLE ADD COLUMN IF NOT EXISTS
- 현재 기본값은 false로 설정 (= 구글폼 모드로 시작) -- PM 확인 필요

**복귀 방법** (나중에 다시 자체 폼으로 돌아올 때):
1. /admin/apply -> 설정 탭 -> "자체 폼 사용" 토글을 ON으로 변경
2. 저장 클릭
3. 끝. 코드 변경이나 배포 없이 즉시 전환됨.

## 구현 기록 (developer)

### 구글폼 전환 ON/OFF 구현 (2026-04-06)

구현한 기능: AcademySettings의 useBuiltInTrialForm/useBuiltInEnrollForm 플래그에 따라 체험수업/수강신청 버튼이 자체 폼 또는 구글폼 외부 링크로 분기되는 시스템

| 파일 경로 | 변경 내용 | 신규/수정 |
|----------|----------|----------|
| prisma/schema.prisma | AcademySettings에 useBuiltInTrialForm, useBuiltInEnrollForm Boolean 추가 | 수정 |
| src/app/actions/admin.ts | DDL ensure에 2개 컬럼 + ALLOWED_SETTINGS_COLUMNS + updateAcademySettings 타입 추가 | 수정 |
| src/lib/queries.ts | getAcademySettings 반환 객체에 useBuiltIn* 필드 추가 | 수정 |
| src/app/apply/page.tsx | ApplyPageClient에 useBuiltIn* prop 전달 | 수정 |
| src/app/apply/ApplyPageClient.tsx | 체험/수강 버튼을 useBuiltIn*에 따라 3분기 (자체폼/구글폼/URL미설정) | 수정 |
| src/app/admin/apply/page.tsx | initialSettings에 useBuiltIn* 전달 | 수정 |
| src/app/admin/apply/ApplyAdminClient.tsx | 타입 추가 + SettingsTab에 토글 UI 2개 + handleSave에 저장 로직 | 수정 |
| src/app/simulator/page.tsx | SimulatorClient에 useBuiltIn* 전달 | 수정 |
| src/app/simulator/SimulatorClient.tsx | CTA 버튼을 useBuiltIn*에 따라 3분기 (자체폼/구글폼/폴백) | 수정 |
| src/app/api/chat/route.ts | SELECT + 반환객체에 useBuiltIn* 추가 + ACTION URL 분기 | 수정 |

tester 참고:
- 테스트 방법: /admin/apply > 설정 탭에서 "폼 전환" 섹션의 토글을 ON/OFF 후 저장, /apply 페이지에서 버튼 동작 확인
- 정상 동작 (기본값 OFF): 체험/수강 버튼 클릭 시 구글폼 URL이 있으면 새 탭으로 열림, 없으면 "구글폼 URL이 설정되지 않았습니다" 안내
- 정상 동작 (토글 ON): 체험/수강 버튼 클릭 시 /apply/trial, /apply/enroll 자체 폼으로 이동
- /simulator 페이지 CTA 버튼도 동일하게 분기 확인
- 챗봇에서 체험/수강 안내 시 ACTION 버튼 URL이 토글 상태에 따라 바뀌는지 확인
- tsc --noEmit 통과 확인 (기존 ThemeProvider 에러만 존재)

reviewer 참고:
- 자체 폼 파일들(/apply/trial/*, /apply/enroll/*, actions/public.ts) 일절 수정하지 않음
- DDL은 ALTER TABLE ADD COLUMN IF NOT EXISTS 패턴 준수
- 기본값 false = 구글폼 모드로 시작 (PM 지시 반영)

### /apply/trial, /apply/enroll 구글폼 모드 리다이렉트 추가 (2026-04-06)

구현한 기능: 구글폼 모드(useBuiltIn*Form = false)일 때 /apply/trial, /apply/enroll 직접 접근 시 구글폼 URL 또는 /apply로 서버 리다이렉트

| 파일 경로 | 변경 내용 | 신규/수정 |
|----------|----------|----------|
| src/app/apply/trial/page.tsx | useBuiltInTrialForm false일 때 redirect 추가 + next/navigation import | 수정 |
| src/app/apply/enroll/page.tsx | useBuiltInEnrollForm false일 때 redirect 추가 + next/navigation import | 수정 |

tester 참고:
- 테스트 방법: DB에서 useBuiltInTrialForm/useBuiltInEnrollForm이 false 상태에서 /apply/trial, /apply/enroll에 직접 접속
- 정상 동작: 구글폼 URL이 설정되어 있으면 해당 URL로 리다이렉트, 없으면 /apply로 리다이렉트
- 토글 ON(자체 폼 모드)일 때는 기존과 동일하게 자체 폼 표시
- tsc --noEmit: 기존 ThemeProvider 에러만 존재 (이번 수정과 무관)

### 다크모드 검정 글씨 + 로고 배경 수정 (2026-04-06)

구현한 기능: 다크모드에서 input 필드 테두리/글씨색이 안 보이는 문제 + 로고 배경색 + hover 시 검정 글씨 문제 수정

| 파일 경로 | 변경 내용 | 신규/수정 |
|----------|----------|----------|
| src/app/admin/layout.tsx | 로고 배경 dark:bg-gray-800 -> dark:bg-white | 수정 |
| src/app/admin/annual/AnnualAdminClient.tsx | 취소 버튼에 dark:hover:text-white 추가 | 수정 |
| src/app/admin/classes/ClassManagementClient.tsx | 취소 버튼에 dark:hover:text-white 추가 | 수정 |
| src/app/admin/students/StudentManagementClient.tsx | 취소 버튼 2곳에 dark:hover:text-white 추가 | 수정 |
| src/app/admin/apply/ApplyAdminClient.tsx | INPUT 상수에 dark:border-gray-600 + dark:text-white 추가 | 수정 |
| src/app/admin/coaches/CoachesAdminClient.tsx | INPUT 상수에 dark:border-gray-600 + dark:text-white 추가 | 수정 |
| src/app/admin/programs/ProgramsAdminClient.tsx | INPUT 상수에 dark:border-gray-600 + dark:text-white 추가 | 수정 |
| src/app/admin/schedule/ScheduleAdminClient.tsx | INPUT + TIME_INPUT 상수에 dark:border-gray-600 + dark:text-white 추가 | 수정 |
| src/app/admin/sms/SmsClient.tsx | INPUT 상수에 dark:border-gray-600 + dark:text-white 추가 | 수정 |
| src/app/admin/makeup/MakeupClient.tsx | 개별 input/select 6곳에 dark:border-gray-600 + dark:text-white + dark:bg-gray-800 추가 | 수정 |
| src/app/admin/skills/SkillsClient.tsx | 개별 input/select/textarea 8곳에 dark:border-gray-600 + dark:text-white + dark:bg-gray-800 추가 | 수정 |
| src/app/admin/finance/FinanceClient.tsx | 개별 input/select 7곳에 dark:border-gray-600 + dark:text-white 추가 | 수정 |
| src/app/admin/staff/StaffClient.tsx | 개별 input/select 8곳에 dark:border-gray-600 + dark:text-white + dark:bg-gray-800 추가 | 수정 |

tester 참고:
- 테스트 방법: 브라우저 다크모드 또는 시스템 다크모드에서 관리자 페이지 전체 순회
- 정상 동작: 모든 input/select/textarea의 테두리가 보이고 글씨가 흰색으로 표시됨
- 로고 배경이 항상 흰색으로 유지됨
- 취소 버튼 hover 시 글씨가 검정으로 바뀌지 않고 흰색 유지
- tsc --noEmit: 기존 ThemeProvider 에러만 존재 (이번 수정과 무관)

### 다크모드 focus:bg-white 포커스 배경 수정 (2026-04-06)

구현한 기능: 다크모드에서 input/textarea 포커스 시 배경이 흰색으로 바뀌어 글씨가 안 보이는 문제 수정 (dark:focus:bg-gray-700 추가)

| 파일 경로 | 변경 내용 | 신규/수정 |
|----------|----------|----------|
| src/app/admin/annual/AnnualAdminClient.tsx | 인라인 input에 dark:focus:bg-gray-700 추가 | 수정 |
| src/app/admin/coaches/CoachesAdminClient.tsx | INPUT 상수에 dark:focus:bg-gray-700 추가 | 수정 |
| src/app/admin/apply/ApplyAdminClient.tsx | INPUT 상수에 dark:focus:bg-gray-700 추가 | 수정 |
| src/app/admin/programs/ProgramsAdminClient.tsx | INPUT 상수 + 인라인 input 총 2곳에 dark:focus:bg-gray-700 추가 | 수정 |
| src/app/admin/schedule/ScheduleAdminClient.tsx | INPUT + TIME_INPUT 상수 + 인라인 input 총 3곳에 dark:focus:bg-gray-700 추가 | 수정 |
| src/app/admin/settings/AdminSettingsClient.tsx | 인라인 input 6곳에 dark:focus:bg-gray-700 추가 | 수정 |
| src/app/admin/sms/SmsClient.tsx | INPUT 상수에 dark:focus:bg-gray-700 추가 | 수정 |
| src/app/admin/terms/TermsAdminClient.tsx | 인라인 textarea에 dark:focus:bg-gray-700 추가 | 수정 |

tester 참고:
- 테스트 방법: 다크모드에서 관리자 페이지의 input/textarea를 클릭(포커스)하여 배경색 확인
- 정상 동작: 포커스 시 라이트모드는 흰색 배경, 다크모드는 gray-700 배경으로 글씨가 잘 보임
- tsc --noEmit: 기존 ThemeProvider 에러만 존재 (이번 수정과 무관)

## 테스트 결과 (tester)

### 구글폼 전환 ON/OFF 기능 검증 (2026-04-06)

| 테스트 항목 | 결과 | 비고 |
|-----------|------|------|
| tsc --noEmit | 통과 | 기존 ThemeProvider 에러만 존재 (알려진 문제) |
| schema.prisma: useBuiltInTrialForm/EnrollForm 필드 | 통과 | Boolean @default(false) 올바름 |
| admin.ts: DDL ensure 패턴 | 통과 | ALTER TABLE ADD COLUMN IF NOT EXISTS + BOOLEAN DEFAULT false |
| admin.ts: ALLOWED_SETTINGS_COLUMNS | 통과 | useBuiltInTrialForm, useBuiltInEnrollForm 모두 포함 |
| admin.ts: updateAcademySettings 타입 | 통과 | boolean 타입으로 선언됨 |
| queries.ts: getAcademySettings 반환 | 통과 | SELECT * + camelCase/lowercase fallback + 기본값 false |
| ApplyPageClient.tsx: 3분기 로직 | 통과 | true=자체폼(Link), false+URL=구글폼(a target=_blank), false+noURL=안내문구 |
| ApplyAdminClient.tsx: 토글 UI + 저장 | 통과 | role=switch, aria-checked, handleSave에 전달 |
| SimulatorClient.tsx: CTA 3분기 | 통과 | 체험/수강 모두 true=Link, false+URL=a target=_blank, false+noURL=/apply#anchor |
| chat/route.ts: SELECT + ACTION URL 분기 | 통과 | SELECT에 명시적 포함, true=/apply/trial, false=/apply#trial |
| apply/page.tsx prop 전달 | 통과 | ?? false 기본값 |
| admin/apply/page.tsx prop 전달 | 통과 | ?? false 기본값 |
| simulator/page.tsx prop 전달 | 통과 | ?? false 기본값 |
| 자체 폼 파일 미수정 확인 | 통과 | trial/*, enroll/*, actions/public.ts 변경 없음 |

종합: 14개 중 14개 통과 / 0개 실패

## 미해결 리뷰 수정 사항 (이월)

| 번호 | 파일 | 심각도 | 내용 | 상태 |
|------|------|--------|------|------|
| R-1 | api/admin/trial-count/route.ts | 필수 | 인증 가드 추가 | 미처리 |
| R-2 | actions/public.ts | 권장 | source/referralSource 서버 화이트리스트 검증 | 미처리 |
| R-3 | actions/public.ts:353 | 권장 | shuttleNeeded: `||` -> `??` 변경 | 미처리 |

---

## 작업 로그 (최근 10건)

| 날짜 | 작업 내용 | 상태 |
|------|----------|------|
| 2026-04-06 | 다크모드 focus:bg-white 포커스 배경 수정 — 8파일 16곳 dark:focus:bg-gray-700 추가 | 완료 |
| 2026-04-06 | 구글폼 전환 ON/OFF 기능 검증 — 14항목 전체 통과 | 테스트 완료 |
| 2026-04-06 | 체험/수강신청 구글폼 전환 ON/OFF 설계 — AcademySettings 플래그 방식 | 설계 완료 |
| 2026-03-29 | 수강신청 3필드 추가 (basketballExp, shuttleTime, shuttleDropoff) | 완료 |
| 2026-03-29 | 신청폼 UI 정리 5건 (유니폼/결제수단 삭제, 가입경로 9개 등) | 완료 |
| 2026-03-29 | 전화번호 자동포맷 + date min/max + 스태프 초대링크 + 폰인증 | 완료 |
| 2026-03-29 | 권한 5단계 + 코치 SMS 타겟팅 + SMS 템플릿 시스템 | 완료 |
| 2026-03-29 | 솔라피 SMS + 시간표 UI 리디자인 + 알림 시스템 | 완료 |
| 2026-03-29 | 체험/수강 신청 자체화 (Phase A+B+C) + 유니폼 구글폼 연동 | 완료 |
| 2026-03-29 | 보안 단기 조치 5건 (헤더, CRON, 업로드, 에러, XSS) | 완료 |
