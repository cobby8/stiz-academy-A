# 작업 스크래치패드

## 현재 작업
- **요청**: 보안 즉시 조치 5건 (Phase A: 코드 보안 → Phase B: 법적 준수)
- **상태**: Phase A 진행 중
- **현재 담당**: developer
- **마지막 세션**: 2026-03-29

### 진행 현황
| # | 작업 | 상태 |
|---|------|------|
| 1 | src/middleware.ts 생성 | ✅ 완료 |
| 2 | Server Action 인증 체크 추가 (53개 함수) | ✅ 완료 |
| 3 | 회원가입 role 서버 측 고정 | ✅ 완료 |
| 4 | 개인정보 처리방침 페이지 (/privacy) | ✅ 완료 |
| 5 | 개인정보 동의 체크박스 | ✅ 완료 |

---

## 기획설계 (planner-architect)
**보안 분석 완료** → 상세 보고서: `.claude/security-report.md`

---

## 구현 기록 (developer)

### Phase A 보안 조치 (작업 1~3) - 2026-03-29

| 파일 경로 | 변경 내용 | 신규/수정 |
|----------|----------|----------|
| src/middleware.ts | Next.js 미들웨어 생성 (updateSession 호출, matcher 설정) | 신규 |
| src/lib/auth-guard.ts | requireAuth(), requireAdmin() 함수 (DB role 확인) | 신규 |
| src/app/actions/admin.ts | import requireAdmin 추가 + 48개 함수에 await requireAdmin() 삽입 | 수정 |
| src/app/actions/schedule.ts | import requireAdmin 추가 + 5개 함수에 await requireAdmin() 삽입 | 수정 |
| src/app/actions/auth.ts | signup 함수 role을 "PARENT" 하드코딩 (formData.get("role") 제거) | 수정 |
| src/app/login/page.tsx | hidden input name="role" value="ADMIN" 제거 | 수정 |

tester 참고:
- 테스트 방법: /admin 페이지에 미로그인 접근 시 /login 리다이렉트 확인
- Server Action 보호: 브라우저 콘솔에서 직접 fetch로 admin action 호출 시 "관리자 권한이 필요합니다" 에러 확인
- 회원가입: 새 회원가입 시 DB User 테이블에서 role이 PARENT인지 확인
- 정상 동작: 관리자 로그인 후 모든 관리 기능 정상 사용 가능
- 주의: ensureAcademySettingsColumns()는 DDL 헬퍼이므로 인증 가드 미적용 (다른 함수에서 내부 호출)

### Phase B 개인정보보호법 준수 (작업 4~5) - 2026-03-29

| 파일 경로 | 변경 내용 | 신규/수정 |
|----------|----------|----------|
| src/app/privacy/page.tsx | 개인정보 처리방침 페이지 (10개 조항, ISR 300초) | 신규 |
| src/components/PublicFooter.tsx | "개인정보 처리방침" 링크 추가 (이용약관 옆에 배치) | 수정 |
| src/app/login/page.tsx | 회원가입 시 개인정보 동의 + 이용약관 동의 체크박스 추가 | 수정 |
| src/app/admin/students/StudentManagementClient.tsx | 신규 원생 등록 시 "보호자 동의 확인" 체크박스 추가 | 수정 |

tester 참고:
- /privacy 페이지 접속: 10개 조항이 카드 형태로 표시되는지 확인
- 푸터: "이용약관 | 개인정보 처리방침" 두 링크가 나란히 표시되는지 확인
- 회원가입: 두 체크박스 미체크 시 "회원가입" 버튼 비활성화(disabled) 확인, 체크 후 활성화 확인
- 원생 등록: "보호자 동의 확인" 미체크 시 "등록" 버튼 비활성화 확인, 수정 모드에서는 체크박스 미표시 확인
- 주의: 로그인 모드에서는 동의 체크박스가 표시되지 않아야 함

---

## 테스트 결과 (tester)

### Phase A 보안 조치 검증 - 2026-03-29

| 테스트 항목 | 결과 | 비고 |
|-----------|------|------|
| tsc --noEmit 타입 체크 | ✅ 통과 | 에러 0건 |
| src/middleware.ts 존재 및 구조 | ✅ 통과 | updateSession import/호출, matcher: /admin/:path*, /login, /mypage/:path* |
| updateSession 시그니처 호환 | ✅ 통과 | NextRequest 받아서 Response 반환, /admin 미인증시 /login 리다이렉트 |
| auth-guard.ts requireAuth() | ✅ 통과 | supabase.auth.getUser() 사용, 미인증시 에러 throw |
| auth-guard.ts requireAdmin() | ✅ 통과 | $queryRawUnsafe로 DB role 조회, ADMIN 아니면 에러 throw |
| admin.ts 인증 적용 (48/48) | ✅ 통과 | exported 49개 중 DDL 헬퍼 1개 제외, 48개 모두 requireAdmin 적용 |
| schedule.ts 인증 적용 (5/5) | ✅ 통과 | 5개 exported 함수 모두 requireAdmin 적용 |
| auth.ts signup role 고정 | ✅ 통과 | role = "PARENT" 하드코딩, formData.get("role") 미사용 |
| login/page.tsx hidden input 제거 | ✅ 통과 | hidden input name="role" 없음 확인 |
| Prisma ORM 메서드 미사용 | ✅ 통과 | auth-guard.ts에서 $queryRawUnsafe 사용 (PgBouncer 호환) |
| 기존 기능 영향 없음 | ✅ 통과 | 인증 가드 추가 외 비즈니스 로직 변경 없음 |

📊 종합: 11개 중 11개 통과 / 0개 실패

### Phase B 개인정보보호법 준수 검증 - 2026-03-29

| 테스트 항목 | 결과 | 비고 |
|-----------|------|------|
| tsc --noEmit 타입 체크 | ✅ 통과 | 에러 0건 |
| /privacy 페이지 파일 존재 | ✅ 통과 | src/app/privacy/page.tsx, Next.js App Router /privacy 경로 접근 가능 |
| 필수 항목: 수집 목적 (제1조) | ✅ 통과 | 수강관리, 수납관리, 학부모소통, 서비스제공 4가지 명시 |
| 필수 항목: 수집 항목 (제2조) | ✅ 통과 | 학부모/학생/보호자별 필수/선택 항목 구분 |
| 필수 항목: 보관 기간 (제3조) | ✅ 통과 | 탈퇴시 즉시, 수강종료 1년, 법령 보존기간 명시 |
| 필수 항목: 제3자 제공 (제4조) | ✅ 통과 | 원칙적 미제공 + 3가지 예외사항 |
| 필수 항목: 파기 절차 (제5조) | ✅ 통과 | 전자파일 삭제 + 종이문서 분쇄/소각 |
| 필수 항목: 정보주체 권리 (제6조) | ✅ 통과 | 열람/정정/삭제/처리정지 4가지 권리 |
| 필수 항목: 미성년자 보호 (제7조) | ✅ 통과 | 법정대리인 동의 절차 명시 |
| 필수 항목: 보호책임자 (제9조) | ✅ 통과 | 담당/연락처/이메일 안내 |
| terms 페이지와 스타일 일관성 | ✅ 통과 | 동일한 히어로 구조, PublicPageLayout, ISR 300초 |
| 푸터 링크 추가 | ✅ 통과 | "이용약관 | 개인정보 처리방침" 나란히 배치, href="/privacy" |
| 회원가입 개인정보 동의 체크박스 | ✅ 통과 | agreePrivacy 상태, /privacy 링크, (필수) 표기 |
| 회원가입 이용약관 동의 체크박스 | ✅ 통과 | agreeTerms 상태, /terms 링크, (필수) 표기 |
| 미체크 시 회원가입 버튼 disabled | ✅ 통과 | disabled={loading or (signup and (!privacy or !terms))} |
| 로그인 모드 체크박스 미표시 | ✅ 통과 | mode==="signup" 조건으로만 렌더링 |
| 모드 전환 시 체크박스 초기화 | ✅ 통과 | 탭 클릭 시 agreePrivacy/agreeTerms false로 리셋 |
| 원생 등록 보호자 동의 체크박스 | ✅ 통과 | guardianConsent 상태, 법정대리인 동의 안내 문구 |
| 원생 등록 미체크 시 버튼 disabled | ✅ 통과 | disabled 조건 + handleSubmit 이중 검증(alert) |
| 수정 모드 체크박스 미표시 | ✅ 통과 | !editingId 조건으로만 렌더링, 수정 시 disabled 미적용 |
| 기존 로그인 기능 영향 없음 | ✅ 통과 | 로그인 모드에서 체크박스/disabled 조건 미적용 |
| 기존 학생 수정 기능 영향 없음 | ✅ 통과 | editingId 설정 시 체크박스 미표시, disabled 미적용 |

📊 종합: 22개 중 22개 통과 / 0개 실패

---

## 리뷰 결과 (reviewer)

### Phase A 보안 조치 코드 리뷰 - 2026-03-29

총평: **조건부 통과** (필수 수정 1건, 권장 수정 2건)

---

잘된 점:
1. auth-guard.ts 설계가 견고함 — DB에서 role을 직접 조회하여 토큰 metadata 조작 방어. getUser()로 서버 측 토큰 검증 수행.
2. SQL 인젝션 방어 완벽 — $queryRawUnsafe에서 $1 파라미터 바인딩을 올바르게 사용. 문자열 연결 방식 SQL 전혀 없음.
3. 에러 메시지가 안전함 — 내부 구현 정보 미노출.
4. middleware.ts 간결하고 정확함 — matcher 패턴 적절, updateSession 로직 정상.
5. signup role 고정 + hidden input 제거 — 권한 상승 공격 경로 완전 차단.
6. 48개 admin + 5개 schedule 함수 모두 requireAdmin() 적용, 빠진 함수 없음.

---

필수 수정 (1건):

| # | 파일:위치 | 문제 | 수정 방법 |
|---|----------|------|----------|
| 1 | auth-guard.ts:1 | "use server" 지시자로 인해 requireAuth/requireAdmin이 Server Action으로 외부 호출 가능. 직접적 보안 위험은 없으나(user 객체 반환 또는 에러 throw) 불필요한 진입점 노출. 인증 가드는 내부 유틸리티이므로 Server Action일 필요 없음. | "use server" 지시자 제거. 호출하는 쪽(admin.ts, schedule.ts)이 이미 "use server" 파일이므로 서버에서 정상 실행됨. |

권장 수정 (2건):

| # | 파일:위치 | 개선점 | 우선순위 |
|---|----------|-------|---------|
| 1 | admin.ts:1140 createParentRequest() | "학부모가 요청 접수" 함수인데 requireAdmin()이 적용됨. 학부모 마이페이지 구현 시 requireAuth()로 변경 필요. | 낮음 |
| 2 | admin.ts:1109,1123 markNotificationRead/markAllNotificationsRead | 알림 읽음 처리는 학부모도 사용할 기능인데 requireAdmin() 적용됨. 위와 동일 이유. | 낮음 |

구조적 관찰 (참고):
- 새 함수 추가 시 requireAdmin() 누락 방지는 코드 리뷰로만 잡을 수 있는 한계. ensureAcademySettingsColumns()만 미적용(DDL 헬퍼, 적절함).
- INSTRUCTOR 등 역할 추가 시 auth-guard.ts에 requireRole() 추가하면 되므로 확장성 충분.
- Server Action throw 방식: 상위 try-catch에 잡히므로 클라이언트 에러 처리 정상 동작.

---

## 작업 로그 (최근 10건)

| 날짜 | 작업 내용 | 파일 | 상태 |
|------|----------|------|------|
| 2026-03-29 | 보안 분석 보고서 작성 (등급 C, 즉시조치 5건) | .claude/security-report.md | 완료 |
| 2026-03-28 | 구글 캘린더 양방향 동기화 + private_key 호환 수정 | googleCalendarWrite.ts, admin.ts, schema.prisma | 완료 |
| 2026-03-28 | 이용약관+FAQ 독립 페이지 + 메뉴 4카테고리 + FAQ DB통합 | terms, faq, Header, Footer, about | 완료 |
| 2026-03-28 | 이용약관 접근성 개선 (푸터 링크+신청 안내+항상 펼침) | PublicFooter, ApplyPageClient, ProgramAccordionTerms | 완료 |
| 2026-03-27 | 히어로 리디자인 + 입학가이드 UI 수정 | LandingPageClient + 9개 페이지, GuideTourTrigger | 완료 |

---

## 대기 중인 작업
1. **학부모 후기 동적화**: 고민 중 (하이브리드 방식 추천)
2. **수업 등록 시뮬레이터 리디자인**: 디자인 시안 대기
3. **엑셀 업로드 일괄 등록**: 사용자 결정 대기
