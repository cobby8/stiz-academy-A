# 작업 스크래치패드

## 현재 작업
- **요청**: 없음 (대기 중)
- **상태**: 대기
- **현재 담당**: pm
- **마지막 세션**: 2026-03-29

---

## 기획설계 (planner-architect)
(아직 없음)

## 구현 기록 (developer)

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
