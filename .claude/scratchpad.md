# 작업 스크래치패드

## 현재 작업
- **요청**: SMS 문자 템플릿 관리 시스템 구현
- **상태**: 구현 완료 (7단계 전부)
- **현재 담당**: developer 완료 -> tester
- **마지막 세션**: 2026-03-29

## 기획설계 (planner-architect)

### SMS 템플릿 관리 시스템 설계 (2026-03-29)

목표: 관리자가 상황별 SMS 문자 내용을 직접 수정/ON-OFF할 수 있는 템플릿 시스템

#### 현재 인프라 분석 결과

이미 완성된 SMS 인프라:
- **솔라피 연동**: lib/sms.ts — sendSms(), sendSmsBulk() (HMAC-SHA256 인증)
- **알림 통합**: lib/notification.ts — notifyAdmins()에서 ADMIN+Coach에게 SMS 발송 중
- **수동 발송 UI**: /admin/sms — SmsClient.tsx (코치/직접입력 대상 수동 발송)
- **현재 문제**: 메시지 내용이 코드에 하드코딩됨 (예: `[STIZ] 새 체험수업 신청\n${childName}...`)

#### DB 모델 설계: SmsTemplate

```prisma
model SmsTemplate {
  id           String   @id @default(dbgenerated("(gen_random_uuid())::text"))
  trigger      String   @unique  // 트리거 코드 (아래 목록)
  name         String            // 관리자에게 보여줄 이름 (예: "체험 신청 접수 — 관리자용")
  target       String            // 수신 대상: ADMIN, COACH, PARENT
  body         String            // 메시지 본문 (변수 포함: {{childName}} 등)
  isActive     Boolean  @default(true)   // ON/OFF 토글
  description  String?           // 이 알림이 언제 발송되는지 설명
  variables    String?           // 사용 가능한 변수 목록 (JSON: ["childName","parentName",...])
  createdAt    DateTime @default(now()) @db.Timestamptz(6)
  updatedAt    DateTime @default(now()) @updatedAt @db.Timestamptz(6)
}
```

#### 트리거 목록 + 변수 + 기본 템플릿

| trigger 코드 | 이름 | target | 사용 가능 변수 | 기본 메시지 | 발동 위치 |
|---|---|---|---|---|---|
| TRIAL_NEW_ADMIN | 체험 신청 접수 (관리자) | ADMIN | childName, childGrade, parentName, parentPhone | [STIZ] 새 체험수업 신청\n{{childName}} ({{childGrade}}) - {{parentName}} | public.ts:submitTrialApplication |
| TRIAL_NEW_COACH | 체험 신청 접수 (코치) | COACH | childName, childGrade, parentName | [STIZ] 새 체험수업 신청\n{{childName}} ({{childGrade}}) | public.ts:submitTrialApplication |
| ENROLL_NEW_ADMIN | 수강 신청 접수 (관리자) | ADMIN | childName, childGrade, parentName, parentPhone | [STIZ] 새 수강 신청\n{{childName}} ({{childGrade}}) - {{parentName}} | public.ts:submitEnrollApplication |
| ENROLL_NEW_COACH | 수강 신청 접수 (코치) | COACH | childName, childGrade, parentName | [STIZ] 새 수강 신청\n{{childName}} ({{childGrade}}) | public.ts:submitEnrollApplication |
| TRIAL_CONFIRM_PARENT | 체험 신청 확인 (학부모) | PARENT | childName, parentName, academyPhone | [STIZ] {{childName}} 체험수업 신청이 접수되었습니다. 일정 확정 시 다시 안내드리겠습니다. 문의: {{academyPhone}} | public.ts:submitTrialApplication |
| TRIAL_SCHEDULED_PARENT | 체험 일정 확정 (학부모) | PARENT | childName, scheduledDate, className, academyPhone | [STIZ] {{childName}} 체험수업 일정이 확정되었습니다.\n일시: {{scheduledDate}}\n반: {{className}}\n문의: {{academyPhone}} | admin.ts:updateTrialLead (status->SCHEDULED) |
| ENROLL_CONFIRM_PARENT | 수강 신청 확인 (학부모) | PARENT | childName, parentName, academyPhone | [STIZ] {{childName}} 수강 신청이 접수되었습니다. 승인 후 안내드리겠습니다. 문의: {{academyPhone}} | public.ts:submitEnrollApplication |
| ENROLL_APPROVED_PARENT | 수강 확정 (학부모) | PARENT | childName, className, academyPhone | [STIZ] {{childName}} 수강이 확정되었습니다.\n배정 반: {{className}}\n상세 안내는 별도 연락드리겠습니다. | admin.ts:approveEnrollApplication |
| INVOICE_PARENT | 수납 안내 (학부모) | PARENT | childName, month, amount, dueDate | [STIZ] {{month}}월 수강료 안내\n{{childName}}: {{amount}}원\n납부기한: {{dueDate}} | admin.ts:generateMonthlyInvoices |
| UNPAID_PARENT | 미납 알림 (학부모) | PARENT | childName, unpaidCount, totalAmount | [STIZ] 미납 수납 안내\n{{childName}}: {{unpaidCount}}건 ({{totalAmount}}원)\n확인 부탁드립니다. | admin.ts:sendUnpaidReminders |

#### 핵심 유틸 함수: renderSmsTemplate()

```
lib/smsTemplate.ts (신규)

// DB에서 템플릿 조회 -> 변수 치환 -> 활성이면 메시지 반환, 비활성이면 null
async function renderSmsTemplate(
  trigger: string,
  variables: Record<string, string>
): Promise<string | null>

// 초기 seed 데이터 삽입 (템플릿이 없으면 기본값으로 생성)
async function ensureSmsTemplates(): Promise<void>
```

#### 발송 로직 변경 포인트

현재 notification.ts의 notifyAdmins()에서 SMS 메시지를 하드코딩:
```ts
sendSms(admin.phone, `[STIZ] ${title}\n${message}`)
```

변경 후: renderSmsTemplate()로 대체
```ts
// notifyAdmins 내부에서
const adminMsg = await renderSmsTemplate("TRIAL_NEW_ADMIN", { childName, childGrade, parentName });
if (adminMsg) sendSms(admin.phone, adminMsg);

const coachMsg = await renderSmsTemplate("TRIAL_NEW_COACH", { childName, childGrade, parentName });
if (coachMsg) { /* 코치에게 발송 */ }
```

학부모 SMS는 현재 미구현 -> 새로 추가:
- submitTrialApplication: TRIAL_CONFIRM_PARENT 발송 (parentPhone으로)
- updateTrialLead (SCHEDULED): TRIAL_SCHEDULED_PARENT 발송
- submitEnrollApplication: ENROLL_CONFIRM_PARENT 발송
- approveEnrollApplication: ENROLL_APPROVED_PARENT 발송
- generateMonthlyInvoices: INVOICE_PARENT 발송
- sendUnpaidReminders: UNPAID_PARENT 발송

#### 페이지/컴포넌트 설계

```
/admin/sms/templates (신규 페이지)
  - SmsTemplateClient.tsx (신규 클라이언트 컴포넌트)
    - 트리거별 카드 레이아웃 (10개 카드)
    - 각 카드:
      - 상단: 이름 + ON/OFF 토글 + 수신대상 배지
      - 중앙: textarea (메시지 본문 편집)
      - 변수 삽입 버튼 (클릭하면 {{변수}} 커서 위치에 삽입)
      - 하단: 미리보기 버튼 (샘플 데이터로 치환한 결과 표시)
      - 저장 버튼
```

기존 /admin/sms 페이지에 "템플릿 관리" 링크 추가.

#### Server Action 설계

```
admin.ts에 추가:
  - getSmsTemplates(): SmsTemplate[] 전체 조회
  - updateSmsTemplate(id, { body, isActive }): 본문/활성 수정
  - resetSmsTemplate(id): 기본 템플릿으로 초기화
  - previewSmsTemplate(trigger, variables): 미리보기용 치환 결과 반환
```

#### 만들 위치와 구조

| 파일 경로 | 역할 | 신규/수정 |
|----------|------|----------|
| prisma/schema.prisma | SmsTemplate 모델 추가 | 수정 |
| src/lib/smsTemplate.ts | renderSmsTemplate + ensureSmsTemplates + 변수치환 로직 | 신규 |
| src/app/admin/sms/templates/page.tsx | 템플릿 관리 서버 컴포넌트 | 신규 |
| src/app/admin/sms/templates/SmsTemplateClient.tsx | 템플릿 편집 UI (카드+토글+미리보기) | 신규 |
| src/app/actions/admin.ts | getSmsTemplates, updateSmsTemplate, resetSmsTemplate, previewSmsTemplate | 수정 |
| src/lib/notification.ts | notifyAdmins SMS를 템플릿 기반으로 변경 | 수정 |
| src/app/actions/public.ts | 학부모용 SMS 발송 추가 (TRIAL_CONFIRM, ENROLL_CONFIRM) | 수정 |
| src/app/admin/sms/page.tsx | "템플릿 관리" 링크 추가 | 수정 |

#### 기존 코드 연결

- lib/sms.ts의 sendSms() -> 기존 그대로 사용 (발송 엔진)
- lib/smsTemplate.ts -> sendSms()를 호출하기 전에 템플릿 조회+치환 담당
- notification.ts -> smsTemplate.ts 임포트하여 하드코딩 메시지 대체
- public.ts -> 학부모 SMS 발송 시 smsTemplate.ts 사용
- admin.ts -> updateTrialLead, approveEnrollApplication, generateMonthlyInvoices, sendUnpaidReminders에 학부모 SMS 추가

#### 실행 계획

| 순서 | 작업 | 담당 | 선행 조건 |
|------|------|------|----------|
| 1 | schema.prisma에 SmsTemplate 모델 추가 + migrate | developer | 없음 |
| 2 | lib/smsTemplate.ts 생성 (renderSmsTemplate + ensureSmsTemplates + seed 데이터) | developer | 1 |
| 3 | admin.ts에 CRUD Server Action 4개 추가 | developer | 2 |
| 4 | /admin/sms/templates 페이지 + SmsTemplateClient.tsx | developer | 3 |
| 5 | notification.ts 수정 (하드코딩 -> 템플릿 기반) + public.ts/admin.ts에 학부모 SMS 추가 | developer | 2 |
| 6 | tsc --noEmit + 기능 테스트 | tester | 4,5 |

#### developer 주의사항

- ensureSmsTemplates()는 앱 시작 시 or 첫 조회 시 호출 (DDL 패턴). 템플릿이 0개면 기본값 10개 INSERT.
- renderSmsTemplate()에서 DB 조회 결과를 캐싱할 필요 없음 (호출 빈도 낮음, 관리자 수정 즉시 반영 필요)
- 학부모 SMS: parentPhone이 필수. 신청 폼에서 이미 수집하고 있으므로 별도 처리 불필요.
- 변수 치환: body.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] || '') 패턴
- 미리보기용 샘플 데이터: { childName: "홍길동", parentName: "홍부모", childGrade: "초3", ... }
- $queryRawUnsafe 필수 (PgBouncer 호환)
- 4단계와 5단계는 병렬 가능 (독립적)

#### PM 결정 필요 사항

1. **학부모 SMS 즉시 추가?** 현재 학부모에게 SMS를 보내는 코드가 없음. 이번에 8개 트리거 중 학부모용 6개를 모두 구현할지, 관리자/코치용 4개만 먼저 할지?
2. **academyPhone 변수**: AcademySettings.contactPhone을 사용할 것인지? (현재 DB에 있음)
3. **수납 안내 SMS**: generateMonthlyInvoices는 학생별로 돌면서 생성하는데, SMS도 학생별로 보낼지 학부모별로 합쳐서 보낼지?

## 구현 기록 (developer)

### SMS 템플릿 관리 시스템 구현 (2026-03-29)

구현한 기능: 상황별 SMS 자동 발송 메시지를 관리자가 편집/ON-OFF할 수 있는 템플릿 시스템

| 파일 경로 | 변경 내용 | 신규/수정 |
|----------|----------|----------|
| prisma/schema.prisma | SmsTemplate 모델 추가 | 수정 |
| src/lib/smsTemplate.ts | DDL ensure + 10개 seed + renderTemplate + autoConvertKeywords + SAMPLE_VARIABLES | 신규 |
| src/lib/queries.ts | getSmsTemplates(), getSmsTemplate(trigger) 추가 | 수정 |
| src/app/actions/admin.ts | updateSmsTemplate, previewSmsTemplate, autoConvertSmsKeywords, resetSmsTemplate + 학부모 SMS 연동 (updateTrialLead/approveEnroll/invoices/unpaid) | 수정 |
| src/app/admin/sms/templates/page.tsx | 템플릿 관리 서버 컴포넌트 | 신규 |
| src/app/admin/sms/templates/SmsTemplateClient.tsx | 탭(관리자-코치/학부모) + 카드 편집 + 변수 삽입 바 + 자동 변환 + 미리보기 + ON/OFF 토글 | 신규 |
| src/lib/notification.ts | notifyAdmins에 smsOptions 추가 (adminTrigger/coachTrigger) + sendParentSms 신규 | 수정 |
| src/app/actions/public.ts | submitTrialApplication/submitEnrollApplication 템플릿 기반 SMS + 학부모 SMS | 수정 |
| src/app/admin/layout.tsx | 사이드바에 "템플릿 관리" 메뉴 추가 | 수정 |

tester 참고:
- 테스트 방법: /admin/sms/templates 접속 -> 탭 전환, 카드 편집, 변수 삽입, 자동 변환, 미리보기, ON/OFF 토글, 저장 확인
- DB migrate 필요: `npx prisma migrate dev --name sms-template` (SmsTemplate 테이블 생성). DDL ensure가 있어 migrate 없이도 동작하지만 권장.
- 정상 동작: 10개 카드 표시, 편집/저장 성공, 미리보기에 샘플 데이터 치환 결과 표시
- SMS 실제 발송: 솔라피 환경변수 설정 필요 (미설정 시 콘솔 로그 fallback)

reviewer 참고:
- notifyAdmins에 smsOptions 추가 시 기존 호출과 하위 호환 유지 (5번째 인자 optional)
- sendParentSms는 fire-and-forget 패턴 (실패해도 메인 로직 중단 안 함)
- public.ts의 sendParentSmsWithAcademyPhone은 모듈 내부 함수 (export 안 함)

### 미해결 리뷰 수정 사항 (이월)

| 번호 | 파일 | 심각도 | 내용 | 상태 |
|------|------|--------|------|------|
| R-1 | api/admin/trial-count/route.ts | 필수 | 인증 가드 추가 | 미처리 |
| R-2 | actions/public.ts | 권장 | source/referralSource 서버 화이트리스트 검증 | 미처리 |
| R-3 | actions/public.ts:353 | 권장 | shuttleNeeded: `||` -> `??` 변경 | 미처리 |

### 전체 로드맵 진행 현황

| Phase | 기능 | 상태 |
|-------|------|------|
| 1-7 | 수납~통계 대시보드 | 완료 |
| - | 체험/수강 신청 자체화 + 유니폼 + 데이터 이관 | 완료 |
| - | 신청 알림 시스템 + 솔라피 SMS | 완료 |
| - | SMS 템플릿 관리 시스템 | 설계 완료 |

---

## 작업 로그 (최근 10건)

| 날짜 | 작업 내용 | 상태 |
|------|----------|------|
| 2026-03-29 | SMS 템플릿 관리 시스템 구현 7단계 (DB+유틸+CRUD+UI+발송연동+사이드바) | 구현 완료 |
| 2026-03-29 | SMS 템플릿 관리 시스템 기획설계 (10개 트리거+DB모델+페이지+실행계획) | 설계 완료 |
| 2026-03-29 | 솔라피 SMS 연동 + Coach phone 필드 + /admin/sms 문자 발송 페이지 | 완료 |
| 2026-03-29 | 시간표 관리 카드+플로팅 모달 UI 리디자인 (컴팩트 카드 + 편집 모달) | 완료 |
| 2026-03-29 | 시간표 요일별 표 뷰 추가 (ScheduleTableView + 카드/표 토글) | 완료 |
| 2026-03-29 | 신청 알림 시스템 구현 (notification.ts + sms.ts + 벨 드롭다운 + API) | 완료 |
| 2026-03-29 | Phase C: 수강 신청 관리 (승인/반려 + 원생 자동 전환) | 완료 |
| 2026-03-29 | Phase B: 수강 신청 자체화 (EnrollmentApplication + 4단계 폼) | 완료 |
| 2026-03-29 | Phase A: 체험수업 신청 자체화 (TrialLead 확장 + 3단계 폼) | 완료 |
| 2026-03-29 | 유니폼 신청서 구글폼 연동 (uniformFormUrl + 카드/모달) | 완료 |
| 2026-03-29 | 보안 단기 조치 5건 (헤더, CRON, 업로드, 에러, XSS) | 완료 |
