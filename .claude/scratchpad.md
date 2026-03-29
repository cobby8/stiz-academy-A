# 작업 스크래치패드

## 현재 작업
- **요청**: 보안 단기 조치 5건 (보안헤더, CRON필수화, 업로드제한, 에러일반화, XSS새니타이징)
- **상태**: 진행 중
- **현재 담당**: developer

### 진행 현황
| # | 작업 | 상태 |
|---|------|------|
| 1 | 보안 헤더 설정 (next.config.ts) | ✅ |
| 2 | CRON_SECRET 필수화 | ✅ |
| 3 | 파일 업로드 타입 제한 | ✅ |
| 4 | API 에러 메시지 일반화 | ✅ |
| 5 | HTML 새니타이징 (DOMPurify) | ✅ |
- **마지막 세션**: 2026-03-29

---

## 기획설계 (planner-architect)
(아직 없음)

## 구현 기록 (developer)

### 보안 단기 조치 5건 — 보안 등급 A 달성

| 파일 경로 | 변경 내용 | 신규/수정 |
|----------|----------|----------|
| next.config.ts | 보안 헤더 4종 추가 (X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy) | 수정 |
| src/app/api/cron/backup/route.ts | CRON_SECRET 필수화 (개발환경 예외) + 에러 메시지 일반화 | 수정 |
| src/app/api/cron/sync-schedule/route.ts | CRON_SECRET 필수화 (개발환경 예외) | 수정 |
| src/app/api/upload/route.ts | 파일 타입 화이트리스트 (JPEG/PNG/WebP/GIF) + 5MB 크기 제한 + 에러 일반화 | 수정 |
| src/app/api/admin/backup/route.ts | 에러 메시지 일반화 | 수정 |
| src/app/api/admin/backup-now/route.ts | 에러 메시지 일반화 | 수정 |
| src/app/api/admin/cloud-backups/route.ts | 에러 메시지 일반화 (GET/POST/DELETE 5곳) + console.error 추가 | 수정 |
| src/app/api/admin/export-seed/route.ts | 에러 메시지 일반화 | 수정 |
| src/lib/sanitize.ts | DOMPurify 새니타이징 유틸 함수 | 신규 |
| src/app/about/page.tsx | renderHtml에 sanitizeHtml 적용 (3곳) | 수정 |
| src/app/apply/ApplyPageClient.tsx | dangerouslySetInnerHTML에 sanitizeHtml 적용 | 수정 |
| src/app/LandingPageClient.tsx | dangerouslySetInnerHTML에 sanitizeHtml 적용 | 수정 |

**tester 참고:**
- 테스트 방법: 개발서버에서 각 페이지 정상 렌더링 확인 + curl로 응답 헤더 확인
- 보안 헤더 확인: `curl -I http://localhost:4000` → X-Frame-Options: DENY 등 4개 확인
- 업로드 제한 확인: .txt 파일 업로드 시도 → 400 에러 / 5MB 초과 이미지 → 400 에러
- XSS 확인: about, apply, 랜딩 페이지에서 HTML 콘텐츠 정상 표시되는지 확인
- CRON 확인: 프로덕션에서 CRON_SECRET 없이 /api/cron/backup 호출 → 401

**reviewer 참고:**
- diagnostics/route.ts의 safeRaw 내부 에러는 의도적으로 유지 (관리자 전용 진단 목적)
- isomorphic-dompurify는 SSR/CSR 양쪽 지원

---

### 관리자 사이드바 "사이트" / "학원운영" 탭 추가

| 파일 경로 | 변경 내용 | 신규/수정 |
|----------|----------|----------|
| src/app/admin/layout.tsx | 사이드바 상단에 탭 UI 추가, 메뉴를 두 카테고리로 분리 | 수정 |

**구현 내용:**
- 로고+Admin 아래에 "사이트" / "학원운영" 두 탭 버튼 배치 (가로 나란히)
- 활성 탭: bg-white/15 + 흰색 텍스트, 비활성 탭: 반투명 텍스트
- "사이트" 탭: 학원 소개, 수업 안내, 소식/안내, 신청 관리 (홈페이지 콘텐츠)
- "학원운영" 탭: 대시보드, 원생, 출결, 수납, 학부모 요청, 피드백, 셔틀 + 시스템(백업)
- URL 기반 자동 탭 선택: OPS_PATHS 배열 + /admin 정확 일치 → "학원운영", 나머지 → "사이트"
- URL 변경 시 useEffect로 탭 자동 전환

**tester 참고:**
- 테스트 방법: /admin 접속 → "학원운영" 탭 활성 확인, /admin/settings 접속 → "사이트" 탭 활성 확인
- 탭 클릭 시 해당 카테고리 메뉴만 표시되는지 확인
- 정상 동작: 탭 전환이 부드럽고, 현재 페이지에 맞는 탭이 자동 선택됨

## 테스트 결과 (tester)

### 보안 단기 조치 5건 검증 (2026-03-29)

| 테스트 항목 | 결과 | 비고 |
|-----------|------|------|
| tsc --noEmit 타입 체크 | PASS | 에러 0건 |
| 보안 헤더 — headers() 함수 존재 | PASS | next.config.ts 14~26행 |
| 보안 헤더 — X-Frame-Options: DENY | PASS | 19행 |
| 보안 헤더 — X-Content-Type-Options: nosniff | PASS | 20행 |
| 보안 헤더 — Referrer-Policy: strict-origin-when-cross-origin | PASS | 21행 |
| 보안 헤더 — Permissions-Policy: camera=(), microphone=(), geolocation=() | PASS | 22행 |
| 보안 헤더 — 기존 설정(serverExternalPackages, images) 보존 | PASS | 4~11행 변경 없음 |
| CRON — backup/route.ts CRON_SECRET 필수화 | PASS | 36~41행, 없으면 401 |
| CRON — sync-schedule/route.ts CRON_SECRET 필수화 | PASS | 18~24행, 없으면 401 |
| CRON — 개발환경(NODE_ENV=development) 예외 | PASS | 양쪽 모두 37행/20행 |
| 업로드 — ALLOWED_TYPES 화이트리스트 | PASS | JPEG/PNG/WebP/GIF 4종 |
| 업로드 — 5MB 크기 제한 | PASS | MAX_FILE_SIZE = 5*1024*1024, 59~64행 |
| 업로드 — 허용되지 않은 타입 시 400 | PASS | 51~55행 |
| 업로드 — 크기 초과 시 400 | PASS | 59~63행 |
| 에러 일반화 — cron/backup catch | PASS | "서버 오류가 발생했습니다." + console.error |
| 에러 일반화 — admin/backup GET/POST catch | PASS | 77~78행 일반 메시지 |
| 에러 일반화 — admin/backup-now catch | PASS | 116~117행 |
| 에러 일반화 — admin/cloud-backups GET/POST/DELETE catch | PASS | 3곳 모두 일반 메시지 |
| 에러 일반화 — admin/export-seed catch | PASS | 136행 일반 메시지 |
| 에러 일반화 — upload catch | PASS | 86행 일반 메시지 |
| XSS — sanitize.ts 존재 + DOMPurify 사용 | PASS | isomorphic-dompurify import |
| XSS — about/page.tsx renderHtml에 sanitizeHtml 적용 | PASS | 3경로 모두 sanitizeHtml 거침 (17~19행) |
| XSS — ApplyPageClient.tsx sanitizeHtml 적용 | PASS | 85행 |
| XSS — LandingPageClient.tsx sanitizeHtml 적용 | PASS | 88행 |
| XSS — sanitize 없는 dangerouslySetInnerHTML 잔존 여부 | PASS | grep 결과 모든 곳 sanitizeHtml 적용 확인 |
| diagnostics/route.ts 의도적 예외 확인 | PASS | 관리자 전용 진단 API, e.message 유지 (정상) |

결과: 26개 중 26개 통과 / 0개 실패

**경미한 발견사항 (이번 수정 범위 밖, 향후 개선 권장):**
1. cloud-backups/route.ts 103행: AcademySettings 복원 실패 시 `(e as Error).message`가 results 객체를 통해 클라이언트로 전달됨. 관리자 전용 API이므로 위험도 낮으나, 일관성을 위해 일반화 권장.
2. sync-schedule/route.ts: syncSheetSlots() 내부에서 `(e as Error).message`를 error 필드로 반환하고, route에서 그대로 클라이언트 응답에 포함. Cron 인증 보호 하에 있으므로 위험도 낮음.
3. export-seed/route.ts 136행: catch 블록에 console.error가 없음 (다른 API들은 모두 있음). 디버깅 편의를 위해 추가 권장.

---

### 관리자 사이드바 탭 UI 검증 (2026-03-29)

| 테스트 항목 | 결과 | 비고 |
|-----------|------|------|
| tsc --noEmit 타입 체크 | PASS | 에러 0건 |
| "사이트"/"학원운영" 탭 버튼 존재 | PASS | 80~101행, 로고 아래 가로 배치 |
| 탭 상태 관리 (useState + useMemo) | PASS | useState<"site"\|"ops">, useMemo로 URL기반 자동계산 |
| URL 기반 자동 탭 선택 로직 | PASS | /admin->ops, OPS_PATHS->ops, 나머지->site |
| URL 변경 시 탭 자동 전환 (useEffect) | PASS | autoTab 변경 시 setActiveTab 호출 |
| 탭 클릭 시 해당 카테고리만 표시 | PASS | 조건부 렌더링 {activeTab === "site/ops" && ...} |
| 활성/비활성 탭 스타일 구분 | PASS | 활성: bg-white/15+text-white, 비활성: text-white/50 |
| 하드코딩 색상 없음 | PASS | Tailwind 유틸리티 + CSS변수(brand-*)만 사용 |
| 메뉴 항목 누락 없음 | PASS | 이전 버전 18개 항목 전부 두 탭에 배치 확인 (diff 비교) |
| 기존 기능(백업/로그아웃) 영향 없음 | PASS | BackupButtons, 로그아웃, 사용자 정보 변경 없음 |

결과: 10개 중 10개 통과 / 0개 실패

**참고사항 (이번 변경 범위 밖):**
- LogOut 아이콘이 lucide-react에서 import됨 -- 디자인 규칙(Material Symbols Outlined 전용)과 불일치하나, 기존 코드이므로 이번 수정 요청 대상 아님

## 리뷰 결과 (reviewer)
(아직 없음)

---

## 작업 로그 (최근 10건)

| 날짜 | 작업 내용 | 파일 | 상태 |
|------|----------|------|------|
| 2026-03-29 | 보안 Phase A — 미들웨어+Server Action 53개 인증+role 고정 | middleware.ts, auth-guard.ts, admin.ts, schedule.ts, auth.ts, login/page | ✅ 완료 |
| 2026-03-29 | 보안 Phase B — 개인정보 처리방침 /privacy + 동의 체크박스 | privacy/page, PublicFooter, login/page, StudentManagementClient | ✅ 완료 |
| 2026-03-29 | 보안 분석 보고서 작성 (등급 C, 즉시조치 5건) | .claude/security-report.md | ✅ 완료 |
| 2026-03-28 | 구글 캘린더 양방향 동기화 + private_key 호환 수정 | googleCalendarWrite.ts, admin.ts, schema.prisma | ✅ 완료 |
| 2026-03-28 | 이용약관+FAQ 독립 페이지 + 메뉴 4카테고리 + FAQ DB통합 | terms, faq, Header, Footer, about | ✅ 완료 |
| 2026-03-28 | 이용약관 접근성 개선 (푸터 링크+신청 안내+항상 펼침) | PublicFooter, ApplyPageClient, ProgramAccordionTerms | ✅ 완료 |
| 2026-03-27 | 히어로 리디자인 + 입학가이드 UI 수정 | LandingPageClient + 9개 페이지, GuideTourTrigger | ✅ 완료 |

---

## 대기 중인 작업
1. **보안 단기 조치 6건** (RBAC, 보안헤더, CRON필수화, XSS새니타이징, 업로드제한, 에러일반화)
2. **학부모 후기 동적화**: 고민 중 (하이브리드 방식 추천)
3. **수업 등록 시뮬레이터 리디자인**: 디자인 시안 대기
4. **엑셀 업로드 일괄 등록**: 사용자 결정 대기

## 참고
- 보안 상세 보고서: `.claude/security-report.md`
- reviewer 권장사항: createParentRequest/markNotificationRead 등은 학부모 마이페이지 구현 시 requireAuth()로 변경 필요
