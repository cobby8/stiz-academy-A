# 작업 스크래치패드

## 현재 작업
- **요청**: 학원 운영 고도화 Phase 1 — 수납 고도화 (자동 청구서 + 미납 알림)
- **상태**: developer 구현 대기
- **현재 담당**: pm → developer
- **마지막 세션**: 2026-03-30

### 전체 로드맵 진행 현황
| Phase | 기능 | 상태 |
|-------|------|------|
| 1 | 💳 수납 고도화 | 🔄 진행 중 |
| 2 | 📝 일일 수업 리포트 | ⏳ 대기 |
| 3 | 🎯 체험수업 CRM | ⏳ 대기 |
| 4 | ⏳ 대기자 관리 | ⏳ 대기 |
| 5 | 🔄 보강 수업 매칭 | ⏳ 대기 |
| 6 | 📊 스킬 트래킹 | ⏳ 대기 |
| 7 | 📈 통계 대시보드 | ⏳ 대기 |

### Phase 1 세부 진행
| # | 작업 | 상태 |
|---|------|------|
| 1-1 | DB 스키마: Payment 필드 추가 + BillingTemplate 모델 | 완료 |
| 1-2 | queries.ts: 조회 함수 추가 | 완료 |
| 1-3 | admin.ts: Server Action 7개 | 완료 |
| 1-4 | 청구 템플릿 관리 페이지 | 완료 |
| 1-5 | FinanceClient 고도화 | 완료 |
| 1-6 | Cron API: 매월 자동 청구서 | 완료 |
| 1-7 | 사이드바 메뉴 추가 | 완료 |
| 1-8 | tester + reviewer | tester 완료 (PASS) |

---

## 기획설계 (planner-architect)
(Phase 1 로드맵에서 설계 완료)

## 구현 기록 (developer)

### Phase 1: 수납 고도화 (자동 청구서 + 미납 알림)

구현한 기능: 청구 템플릿 CRUD, 월별 자동 청구서 생성, 미납 알림 발송, 일괄 수납 처리, Cron 자동 청구

| 파일 경로 | 변경 내용 | 신규/수정 |
|----------|----------|----------|
| prisma/schema.prisma | Payment 6필드 추가 + BillingTemplate 모델 | 수정 |
| src/lib/queries.ts | getBillingTemplates, getActiveBillingTemplates, getPaymentSummary, getUnpaidPayments 추가 + getPayments 확장 | 수정 |
| src/app/actions/admin.ts | ensurePaymentColumns, ensureBillingTemplateTable, createBillingTemplate, updateBillingTemplate, deleteBillingTemplate, generateMonthlyInvoices, sendUnpaidReminders, bulkUpdatePaymentStatus 추가 | 수정 |
| src/app/admin/finance/billing/page.tsx | 청구 템플릿 관리 서버 페이지 (revalidate:30) | 신규 |
| src/app/admin/finance/billing/BillingTemplateClient.tsx | 청구 템플릿 CRUD UI (생성/수정/삭제/활성토글) | 신규 |
| src/app/admin/finance/page.tsx | getPaymentSummary 추가 조회 | 수정 |
| src/app/admin/finance/FinanceClient.tsx | 요약카드4개 + 청구서생성/미납알림 버튼 + 일괄체크+납부처리 + type/description 표시 | 수정 |
| src/app/api/cron/billing/route.ts | 매월 1일 자동 청구서 생성 Cron (CRON_SECRET 검증) | 신규 |
| src/app/admin/layout.tsx | 사이드바 "청구 설정" 메뉴 추가 | 수정 |

tester 참고:
- 테스트 방법: /admin/finance/billing 에서 템플릿 생성 후 /admin/finance에서 "이달 청구서 생성" 클릭
- 정상 동작: 활성 수강생 x 활성 템플릿 수만큼 청구서 생성, 중복 클릭 시 스킵
- 주의할 입력: dueDay 29 이상은 28로 제한됨, 템플릿 없으면 "활성 청구 템플릿이 없습니다" 메시지

reviewer 참고:
- DDL 자동 생성(ensurePaymentColumns, ensureBillingTemplateTable)으로 마이그레이션 없이 동작
- 중복 방지 로직: studentId + year + month + type 조합으로 검사

#### 수정 이력
| 회차 | 날짜 | 수정 내용 | 수정 파일 | 사유 |
|------|------|----------|----------|------|
| 1차 | 2026-03-29 | finance API에 ADMIN role 체크 추가 | api/admin/finance/route.ts | reviewer 필수수정 #1: 인가 누락 |
| 1차 | 2026-03-29 | createPayment에 type/description 파라미터 추가 + handleCreate에서 전달 | actions/admin.ts, FinanceClient.tsx | reviewer 권장수정 #2: 수동생성 시 유형/설명 누락 |
| 1차 | 2026-03-29 | loadMonth catch 블록에 console.error + alert 추가 | FinanceClient.tsx | reviewer 권장수정 #3: 빈 catch 블록 |

## 테스트 결과 (tester)

### 테스트 결과 (2026-03-29)

| 테스트 항목 | 결과 | 비고 |
|-----------|------|------|
| tsc --noEmit | 통과 | 에러 0건 |
| DB 스키마: Payment 6필드 + BillingTemplate 모델 | 통과 | @@index 포함 확인 |
| queries.ts: 5개 함수 $queryRawUnsafe + cache() | 통과 | JOIN, 파라미터 바인딩 정상 |
| admin.ts: requireAdmin() 호출 | 통과 | 6개 함수 모두 확인 |
| admin.ts: $executeRawUnsafe + SQL 파라미터 바인딩 | 통과 | SQL 인젝션 방지 |
| admin.ts: generateMonthlyInvoices 중복 방지 | 통과 | studentId+year+month+type 검사 |
| admin.ts: sendUnpaidReminders 알림+notifiedAt | 통과 | notifyParentsOfStudents 사용 |
| admin.ts: revalidatePath 호출 | 통과 | 모든 CUD 함수에서 호출 |
| billing/page.tsx: revalidate=30 + 서버 조회 | 통과 | |
| BillingTemplateClient.tsx: use client + CRUD UI | 통과 | 하드코딩 색상 없음 |
| FinanceClient.tsx: 요약카드+버튼+일괄처리 | 통과 | Material Symbols 아이콘 사용 |
| Cron route.ts: CRON_SECRET 검증 + GET | 통과 | 에러 처리 포함 |
| layout.tsx: 청구 설정 메뉴 | 통과 | /admin/finance/billing 경로 |

종합: 13개 중 13개 통과 / 0개 실패 -- PASS
수정 필요: 없음

## 리뷰 결과 (reviewer)

### 코드 리뷰 결과
- **규칙 준수**: 통과
- **코드 품질**: 양호
- **보안**: 주의 (필수 수정 1건)
- **비즈니스 로직**: 양호
- **UX**: 양호
- **종합**: REQUEST_CHANGES (필수 1건 수정 후 APPROVE)

잘된 점:
1. $queryRawUnsafe/$executeRawUnsafe 철저 사용, Prisma ORM 메서드 미사용
2. SQL 파라미터 바인딩($1,$2...) 전 함수 적용 — SQL 인젝션 방지 양호
3. requireAdmin() 모든 Server Action 첫 줄 호출 확인
4. Material Symbols Outlined 아이콘만 사용 (lucide-react 없음)
5. Tailwind만 사용, 하드코딩 색상 없음
6. 중복방지: studentId+year+month+type 4중 키 검사 견고
7. DDL ensure 함수에 in-memory 플래그로 중복 실행 방지
8. Cron CRON_SECRET 검증 + 개발환경 예외 올바름
9. 에러 처리: 모든 함수 try/catch + 사용자 친화적 메시지

필수 수정:

| # | 파일:위치 | 심각도 | 문제 | 수정 방법 |
|---|----------|--------|------|----------|
| 1 | api/admin/finance/route.ts:9 | 필수 | 인가 누락 — 로그인 사용자면 누구나(학부모 포함) 수납 데이터 조회 가능. role=ADMIN 체크 없음. FinanceClient loadMonth()가 이 API 호출. | supabase user.id로 DB User.role 조회 후 ADMIN인지 확인 추가 |

권장 수정:

| # | 파일:위치 | 심각도 | 문제 | 수정 방법 |
|---|----------|--------|------|----------|
| 2 | FinanceClient.tsx:148-155 | 권장 | handleCreate에서 paymentType, description을 createPayment에 전달 안 함. 폼에 필드는 있으나 호출 시 누락 → 수동 생성 시 항상 기본값 저장 | createPayment 호출 시 type: paymentType, description 추가 |
| 3 | FinanceClient.tsx:127 | 권장 | loadMonth catch 블록이 빈 블록 — 조회 실패 시 사용자 피드백 없음 | catch에 alert 또는 토스트 추가 |
| 4 | admin.ts:2498-2504 | 권장 | sendUnpaidReminders condition 문자열이 SQL에 직접 삽입. boolean 분기라 안전하지만 패턴이 취약 | 파라미터 바인딩 분기로 변경 권장 |

선택 개선:
- cron/billing/route.ts와 admin.ts에 DDL 코드 중복 → 나중에 통합 가능
- layout.tsx:139 수납/결제 메뉴 active 조건이 exact match(===) → billing 하위 진입 시 비활성화됨 → startsWith 변경 권장

---

## 작업 로그 (최근 10건)

| 날짜 | 작업 내용 | 파일 | 상태 |
|------|----------|------|------|
| 2026-03-30 | 학원운영 고도화 로드맵 7 Phase 설계 | scratchpad | 완료 |
| 2026-03-30 | 학부모 후기 SSR 권한 에러 수정 + DB User 시드 | TestimonialsWrapper, admin.ts, auth-guard | 완료 |
| 2026-03-29 | 학부모 후기 동적화 (DB CRUD + 네이버 링크) | 9개 파일 | 완료 |
| 2026-03-29 | 관리자 사이드바 "사이트"/"학원운영" 탭 UI | admin/layout.tsx | 완료 |
| 2026-03-29 | 보안 단기 조치 5건 | next.config 등 12파일 | 완료 |
| 2026-03-29 | 보안 Phase A — 미들웨어+Server Action 인증 | middleware.ts 등 | 완료 |
| 2026-03-29 | 보안 Phase B — 개인정보 처리방침 + 동의 | privacy/page 등 | 완료 |
| 2026-03-28 | 구글 캘린더 양방향 동기화 | googleCalendarWrite.ts 등 | 완료 |
| 2026-03-28 | 이용약관+FAQ 독립 페이지 + 메뉴 4카테고리 | terms, faq 등 | 완료 |
| 2026-03-27 | 히어로 리디자인 + 입학가이드 UI 수정 | LandingPageClient 등 | 완료 |
