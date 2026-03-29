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
| 4 | 개인정보 처리방침 페이지 (/privacy) | ⬜ 대기 |
| 5 | 개인정보 동의 체크박스 | ⬜ 대기 |

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
