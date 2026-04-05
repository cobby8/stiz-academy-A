# 작업 스크래치패드

## 현재 작업
- **요청**: 스태프 초대 링크 시스템
- **상태**: 구현 완료
- **현재 담당**: developer 완료 -> tester
- **마지막 세션**: 2026-03-29

## 기획설계 (planner-architect)

(이전 SMS 템플릿 설계: 구현 완료로 정리됨)

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

### 권한 체계 5단계 구현 (2026-03-29)

구현한 기능: VICE_ADMIN(부원장) 역할 추가 + 스태프 관리 페이지 + Coach-User 연결

| 파일 경로 | 변경 내용 | 신규/수정 |
|----------|----------|----------|
| prisma/schema.prisma | Role enum에 VICE_ADMIN 추가, Coach에 userId(unique) + User relation 추가 | 수정 |
| src/lib/auth-guard.ts | requireAdmin: ADMIN+VICE_ADMIN 허용, requireOwner: ADMIN만 허용 신규 추가 | 수정 |
| src/lib/notification.ts | notifyAdmins에서 ADMIN+VICE_ADMIN 모두 조회 | 수정 |
| src/lib/queries.ts | getStaffUsers() + getAllCoaches() 조회 함수 추가 | 수정 |
| src/app/actions/admin.ts | ensureStaffColumns DDL + createStaffUser + updateUserRole + linkCoachToUser (모두 requireOwner) | 수정 |
| src/app/admin/staff/page.tsx | 스태프 관리 서버 컴포넌트 (revalidate:30) | 신규 |
| src/app/admin/staff/StaffClient.tsx | 스태프 목록 테이블 + 역할 드롭다운 + Coach 연결 + 추가 모달 + 권한 안내 카드 | 신규 |
| src/app/admin/layout.tsx | 사이드바 시스템 섹션에 "스태프 관리" 메뉴 + OPS_PATHS 추가 | 수정 |

tester 참고:
- 테스트 방법: /admin/staff 접속 -> 스태프 목록 확인, 역할 변경, 코치 연결, 신규 추가
- DB migrate 필요: `npx prisma migrate dev --name staff-role` (VICE_ADMIN enum + Coach.userId). DDL ensure가 있어 migrate 없이도 동작.
- 정상 동작: ADMIN/VICE_ADMIN/INSTRUCTOR 유저 목록 표시, 역할 변경 시 confirm 후 반영
- requireOwner: ADMIN이 아닌 사용자가 스태프 관리 시도하면 "원장 권한이 필요합니다" 에러
- 자기 자신 역할 변경 시도하면 "자기 자신의 역할은 변경할 수 없습니다" 에러

reviewer 참고:
- DDL ensure: ALTER TYPE ADD VALUE는 IF NOT EXISTS로 중복 실행 안전, ALTER TABLE ADD COLUMN IF NOT EXISTS도 안전
- requireAdmin은 하위 호환 유지: 기존에 ADMIN만 통과하던 곳이 VICE_ADMIN도 통과하게 됨
- Coach.userId는 UNIQUE로 1:1 관계 보장

### 슬롯 담당 코치 SMS 타겟팅 구현 (2026-03-29)

구현한 기능: 체험/수강 신청 시 해당 슬롯의 담당 코치에게만 SMS 발송 (기존: 전체 코치)

| 파일 경로 | 변경 내용 | 신규/수정 |
|----------|----------|----------|
| src/lib/notification.ts | getCoachPhonesBySlotKeys() 추가 + notifyAdmins에 slotKeys 옵션 추가 + 코치 SMS 분기 로직 | 수정 |
| src/app/actions/public.ts | submitTrialApplication: preferredSlotKey -> slotKeys 전달, submitEnrollApplication: preferredSlotKeys 파싱 -> slotKeys 전달 | 수정 |
| src/app/actions/admin.ts | notifyAdmins 임포트 추가, updateTrialLead(SCHEDULED): Class.slotKey 조회 -> 코치 알림, approveEnrollApplication: classIds -> slotKey 조회 -> 코치 알림 | 수정 |

tester 참고:
- 테스트 방법: 체험 신청 시 희망 슬롯 선택 -> 해당 슬롯 담당 코치에게만 SMS 발송 확인
- 정상 동작: slotKey에 coachId가 설정된 경우 해당 코치에게만, 미설정 시 전체 코치에게 발송
- 슬롯 없이 신청 시: 기존과 동일하게 전체 코치에게 발송

reviewer 참고:
- getCoachPhonesBySlotKeys: ClassSlotOverride(기본 슬롯) + CustomClassSlot(custom- 접두사) 양쪽 확인
- notifyAdmins의 하위 호환 유지: slotKeys 미전달 시 기존 동작과 동일

### 스태프 초대 링크 시스템 구현 (2026-03-29)

구현한 기능: 원장이 초대 링크를 생성하면 스태프가 직접 가입하는 시스템

| 파일 경로 | 변경 내용 | 신규/수정 |
|----------|----------|----------|
| prisma/schema.prisma | StaffInvitation 모델 (이미 존재) | 기존 |
| src/lib/queries.ts | getStaffInvitations(), getInvitationByToken() (이미 존재) | 기존 |
| src/app/actions/admin.ts | ensureStaffInvitationTable DDL + inviteStaff + cancelInvitation + resendInvitation (requireOwner) | 수정 |
| src/app/actions/invite.ts | 공개 액션: getInvitation, sendInviteVerification, verifyInviteCode, acceptInvitation | 신규 |
| src/app/admin/staff/page.tsx | invitations 전달 추가 + ensureStaffInvitationTable DDL | 수정 |
| src/app/admin/staff/StaffClient.tsx | 초대 모달(이름+폰+역할) + 대기 초대 목록(재발송/취소) + 초대 이력 | 수정 |
| src/app/invite/[token]/page.tsx | 초대 수락 서버 페이지 (상태별 분기: PENDING/ACCEPTED/CANCELLED/EXPIRED) | 신규 |
| src/app/invite/[token]/InviteAcceptForm.tsx | 3단계: 정보확인->폰인증->비밀번호설정->완료 | 신규 |

tester 참고:
- 테스트 방법: /admin/staff → "초대 링크 발송" 버튼 → 이름+폰+역할 입력 → 초대 생성 확인
- /invite/{token} 접속 → 정보확인 → 인증번호 입력 → 비밀번호 설정 → 가입 완료
- DB migrate 필요: `npx prisma migrate dev --name staff-invitation` (DDL ensure로 migrate 없이도 동작)
- 정상 동작: 초대 생성 시 SMS 발송, 대기 초대 목록에 표시, 재발송/취소 동작
- acceptInvitation: Supabase Auth admin API로 계정 생성 (email={phone}@staff.stiz.kr)
- 만료/취소/수락 완료 상태에서는 각각 적절한 에러 페이지 표시

reviewer 참고:
- Supabase Admin API (createUser + email_confirm:true)로 이메일 확인 건너뛰기
- 인증번호는 메모리 Map (inviteVerifyMap) — 서버리스 인스턴스 간 공유 안 됨 (즉시 인증이므로 OK)
- inviteStaff에서 revalidatePath를 return 전에 호출 (기존 패턴과 다름 — try 블록 안에서)

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
| 2026-03-29 | 수강신청 3필드 추가 (basketballExp, shuttleTime, shuttleDropoff) — 스키마+DDL+폼+관리자 | 구현 완료 |
| 2026-03-29 | 신청폼 UI 정리 5건 (유니폼/결제수단 삭제, 가입경로 9개, 사이드바 탭 이동, 관리자 표시 정리) | 구현 완료 |
| 2026-03-29 | 전화번호 자동포맷 + date min/max + 스태프 초대링크 + 폰인증 | 구현 완료 |
| 2026-03-29 | 권한 5단계 + 코치 SMS 타겟팅 + SMS 템플릿 시스템 | 구현 완료 |
| 2026-03-29 | 솔라피 SMS + 시간표 UI 리디자인 + 알림 시스템 | 완료 |
| 2026-03-29 | 체험/수강 신청 자체화 (Phase A+B+C) + 유니폼 구글폼 연동 | 완료 |
| 2026-03-29 | 보안 단기 조치 5건 (헤더, CRON, 업로드, 에러, XSS) | 완료 |
