# 작업 스크래치패드

## 현재 작업
- **요청**: 알림 시스템 구현 (체험/수강 신청 시 관리자 알림)
- **상태**: 구현 완료, tsc PASS
- **현재 담당**: tester (검증 필요)
- **마지막 세션**: 2026-03-29

## 기획설계 (planner-architect)

### 신청 알림 시스템 설계 (2026-03-29)

목표: 체험/수강/유니폼 신청 시 관리자+담당선생님에게 즉시 알림

#### 현재 인프라 분석 결과

이미 완성된 알림 시스템이 존재:
- **DB 알림**: Notification 모델 + createNotificationRecord() 헬퍼 (admin.ts:1080)
- **웹 Push**: PushSubscription 모델 + sendPushToUser() 유틸 (pushNotification.ts)
- **VAPID 키**: .env에 설정 완료
- **학부모 UI**: /mypage에서 알림 목록 + 읽음처리 + 푸시 ON/OFF 토글 완성
- **기존 패턴**: createParentRequest()에서 ADMIN에게 알림 보내는 코드가 이미 구현됨 (admin.ts:1188)

#### 알림 채널별 비교

| 채널 | 비용 | 구현 난이도 | 인프라 | 추천 |
|------|------|-----------|--------|------|
| A. 대시보드 알림 | 0원 | 매우 낮음 (5줄) | Notification 모델 완성 | 1순위 |
| B. 웹 Push | 0원 | 매우 낮음 (0줄 추가) | sendPushToUser 완성 | 1순위 |
| C. 카카오 알림톡 | 건당 8~15원 | 높음 (API 연동) | 없음 | 나중에 |
| D. SMS | 건당 12~20원 | 중간 | 없음 | 나중에 |
| E. 이메일 | 무료~저렴 | 중간 | 없음 | 선택 |

추천: A+B 먼저 (비용 0원, 인프라 이미 완성)

#### 핵심 문제: Coach와 User가 연결되지 않음

Coach 모델에 userId 필드가 없음. Coach는 프로필 데이터(이름/역할/사진)만 저장.
User.role=INSTRUCTOR가 로그인 가능한 선생님 계정이지만 Coach와 매핑 없음.
=> "담당 선생님에게 알림" 현재 불가

추천: 일단 ADMIN에게만 알림 (체험/수강 신청은 관리자가 처리하는 업무). 선생님 알림은 Coach-User 연결 후 Phase 2로.

#### 알림 트리거 3곳

| 트리거 | 파일 | 함수 | 알림 내용 |
|--------|------|------|----------|
| 체험수업 신청 | public.ts:165 | submitTrialApplication | "새 체험수업 신청: [이름] ([학년])" -> /admin/trial |
| 수강 신청 | public.ts:364 | submitEnrollApplication | "새 수강 신청: [이름] ([학년])" -> /admin/apply |
| 유니폼 신청 | - | - | 구글폼이라 트리거 불가 (자체화 필요) |

#### 구현 설계

현재 createNotificationRecord는 admin.ts 내부 함수(export 안 됨).
=> lib/notification.ts 신규 생성하여 공용 알림 유틸로 분리

```
lib/notification.ts (신규)
  - createNotificationRecord(userId, type, title, message, linkUrl)
  - notifyAdmins(type, title, message, linkUrl)  // 모든 ADMIN에게
```

public.ts의 submitTrialApplication, submitEnrollApplication 끝에 notifyAdmins() 호출 추가.
admin.ts의 기존 createNotificationRecord를 lib/notification.ts import로 교체.

#### 실행 계획

| 순서 | 작업 | 담당 | 선행 조건 |
|------|------|------|----------|
| 1 | PM 결정 4건 (아래 참조) | PM | 없음 |
| 2 | lib/notification.ts 생성 (createNotificationRecord + notifyAdmins 이동) | developer | 1 |
| 3 | admin.ts에서 notification.ts import로 교체 | developer | 2 |
| 4 | public.ts submitTrialApplication에 notifyAdmins 추가 | developer | 2 |
| 5 | public.ts submitEnrollApplication에 notifyAdmins 추가 | developer | 2 |
| 6 | tsc --noEmit + 기존 알림 기능 회귀 테스트 | tester | 3,4,5 |

#### PM 결정 필요 사항

1. **담당 선생님 알림**: 이번에 ADMIN만? 아니면 Coach-User 연결도?
2. **유니폼 신청 자체화**: 이번 작업에 포함? (포함해야 알림 트리거 가능)
3. **알림 타입명**: Notification.type에 "TRIAL_APPLICATION", "ENROLL_APPLICATION" 추가 -- OK?
4. **알림 링크**: 체험 -> /admin/trial, 수강 -> /admin/apply 로 연결 -- OK?

#### developer 주의사항
- createNotificationRecord 내부에서 sendPushToUser를 .catch(()=>{})로 호출 (Push 실패해도 무시)
- public.ts는 비로그인 공개 함수이므로 notifyAdmins는 fire-and-forget (await 하지 않음, 신청 응답 지연 방지)
- admin.ts의 기존 notifyParentsOfStudents, notifyAllParents도 notification.ts로 이동 고려 (선택)

### 구현 기록 (developer) — 신청 알림 시스템 (2026-03-29)

구현한 기능: 체험/수강 신청 시 관리자(ADMIN)에게 인앱 알림 + 웹 Push + SMS 발송. 헤더에 알림 벨 드롭다운.

| 파일 경로 | 변경 내용 | 신규/수정 |
|----------|----------|----------|
| src/lib/notification.ts | 공용 알림 유틸 (createNotificationRecord, notifyAdmins, notifyParentsOfStudents, notifyAllParents) | 신규 |
| src/lib/sms.ts | NHN Cloud SMS 발송 유틸 (환경변수 없으면 console.log fallback) | 신규 |
| src/app/actions/public.ts | submitTrialApplication, submitEnrollApplication에 notifyAdmins 호출 추가 | 수정 |
| src/app/actions/admin.ts | 내부 알림 함수 3개를 lib/notification.ts import로 교체 | 수정 |
| src/app/api/admin/notifications/route.ts | 관리자 알림 목록 API (GET: 조회, POST: 읽음처리) | 신규 |
| src/app/admin/layout.tsx | 헤더에 NotificationBell 컴포넌트 (벨 아이콘 + 배지 + 드롭다운) | 수정 |

tester 참고:
- 테스트: 체험/수강 신청 폼 제출 후 관리자 로그인하여 헤더 벨 아이콘 확인
- 정상 동작: 벨 아이콘에 빨간 배지 숫자 표시, 클릭 시 드롭다운에 알림 목록
- 알림 클릭 시 해당 관리 페이지(/admin/trial 또는 /admin/apply)로 이동
- "모두 읽음" 클릭 시 배지 사라짐
- SMS: NHN_SMS_APP_KEY 환경변수 없으면 콘솔 로그만 출력 (에러 없음)

reviewer 참고:
- admin.ts에서 알림 함수 3개를 lib/notification.ts로 이동 — 기존 호출처 모두 import로 교체
- public.ts의 notifyAdmins는 fire-and-forget (await 없음, .catch(() => {}))
- 알림 API에 인증 가드 있음 (getAdminUser)

### 미해결 리뷰 수정 사항 (이월)

| 번호 | 파일 | 심각도 | 내용 | 상태 |
|------|------|--------|------|------|
| R-1 | api/admin/trial-count/route.ts | 필수 | 인증 가드 추가 | 미처리 |
| R-2 | actions/public.ts | 권장 | source/referralSource 서버 화이트리스트 검증 | 미처리 |
| R-3 | actions/public.ts:353 | 권장 | shuttleNeeded: `||` -> `??` 변경 | 미처리 |

### 전체 로드맵 진행 현황

| Phase | 기능 | 상태 |
|-------|------|------|
| 1 | 수납 고도화 | 완료 |
| 2 | 일일 수업 리포트 | 완료 |
| 3 | 체험수업 CRM | 완료 |
| 4 | 대기자 관리 | 완료 |
| 5 | 보강 수업 매칭 | 완료 |
| 6 | 스킬 트래킹 | 완료 |
| 7 | 통계 대시보드 | 완료 |
| - | 체험/수강 신청 자체화 (A+B+C) | 완료 |
| - | 유니폼 구글폼 연동 | 완료 |
| - | 수강생 데이터 이관 | 완료 |
| - | 신청 알림 시스템 | 구현 완료 |

---

## 작업 로그 (최근 10건)

| 날짜 | 작업 내용 | 상태 |
|------|----------|------|
| 2026-03-29 | 신청 알림 시스템 구현 (notification.ts + sms.ts + 벨 드롭다운 + API) | 완료 |
| 2026-03-29 | 신청 알림 시스템 기획설계 (채널분석+인프라확인+실행계획) | 완료 |
| 2026-03-29 | Phase C: 수강 신청 관리 (승인/반려 + 원생 자동 전환) | 완료 |
| 2026-03-29 | Phase B: 수강 신청 자체화 (EnrollmentApplication + 4단계 폼) | 완료 |
| 2026-03-29 | Phase A: 체험수업 신청 자체화 (TrialLead 확장 + 3단계 폼) | 완료 |
| 2026-03-29 | 유니폼 신청서 구글폼 연동 (uniformFormUrl + 카드/모달) | 완료 |
| 2026-03-29 | 원생 관리 테이블 UI 정비 + deleteStudent FK 버그 수정 | 완료 |
| 2026-03-29 | 수강생 데이터 이관 + 4월 CSV Enrollment 재설정 | 완료 |
| 2026-03-29 | Phase 5-7 tester+reviewer 전체 검증 PASS | 완료 |
| 2026-03-29 | Phase 2-4 tester+reviewer 전체 검증 PASS | 완료 |
| 2026-03-29 | 보안 단기 조치 5건 (헤더, CRON, 업로드, 에러, XSS) | 완료 |
