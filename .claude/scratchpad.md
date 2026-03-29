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
(아직 없음)

## 테스트 결과 (tester)
(아직 없음)

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
