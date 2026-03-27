# 작업 스크래치패드

## 현재 작업
- **요청**: 네비게이션 메뉴 카테고리 그룹핑 구현
- **상태**: developer 구현 완료 -> tester 검증 대기
- **현재 담당**: developer (완료)
- **마지막 세션**: 2026-03-26

---

### 기획설계 (planner-architect) -- 2026-03-26 네비게이션 카테고리 그룹핑

> 안1(2카테고리+독립) 채택. 상세 분석은 작업 로그 참조.
> PC: group/group-hover CSS 드롭다운, 모바일: 카테고리 라벨+구분선
> 후속: GuideTourTrigger 투어 드롭다운 연동 필요

---

### 구현 기록 (developer) -- 2026-03-26

구현한 기능: 네비게이션 카테고리 드롭다운 + FAQ 앵커 + CTA 변경

| 파일 경로 | 변경 내용 | 신규/수정 |
|----------|----------|----------|
| src/components/PublicHeader.tsx | NAV_ITEMS -> NAV_GROUPS+NAV_STANDALONE 구조, PC group-hover 드롭다운, 모바일 카테고리라벨+구분선, CTA "신청하기"로 변경, FAQ/이용약관 메뉴 추가 | 수정 |
| src/components/ui/SectionLayout.tsx | id prop 추가 (section 태그에 전달) | 수정 |
| src/app/apply/ApplyPageClient.tsx | FAQ SectionLayout에 id="faq" 추가 | 수정 |

구현 세부사항:
- PC 드롭다운: Tailwind group/group-hover로 순수 CSS 구현 (JS 상태 불필요)
- 모바일 사이드바: 아코디언 대신 카테고리 라벨(회색 소문자)+구분선으로 경량 그룹핑
- data-tour-target: 기존 패턴 유지 (nav-about, nav-programs 등). 해시 링크는 #을 -로 변환
- 수업 안내 드롭다운에 FAQ(/apply#faq), 이용약관(/programs#terms) 추가
- CTA 버튼: "체험 신청" -> "신청하기", 모바일 하단 CTA도 동일 변경

tester 참고:
- PC: 학원 안내/수업 안내에 마우스 hover 시 드롭다운 펼쳐지는지 확인
- 모바일: 햄버거 -> 카테고리 라벨이 회색 소문자로 보이고, 하위 링크 클릭 시 사이드바 닫히는지
- /apply 페이지에서 URL에 #faq 붙이면 FAQ 섹션으로 스크롤 되는지
- CTA 버튼 텍스트가 "신청하기"인지

reviewer 참고:
- group-hover 방식은 터치스크린에서 첫 탭에 hover가 발생하지 않을 수 있음. 현재는 모바일에서 md 미만이므로 드롭다운 자체가 hidden -> 영향 없음

---

### [이전 기획/구현/테스트 기록은 작업 로그로 요약 정리됨 -- 2026-03-26 자동정리]

---

## 작업 로그 (최근 10건)

| 날짜 | 작업 내용 | 파일 | 상태 |
|------|----------|------|------|
| 2026-03-26 | 네비게이션 카테고리 드롭다운 구현 (group-hover, FAQ/약관 메뉴 추가, CTA 변경) | PublicHeader.tsx, SectionLayout.tsx, ApplyPageClient.tsx | 구현완료 |
| 2026-03-26 | 네비게이션 카테고리 그룹핑 재설계 (안1: 2카테고리+독립 채택) | PublicHeader.tsx | 기획완료 |
| 2026-03-26 | 공개 페이지 히어로 영역 높이 75% 축소 (9개 파일 패딩 변경) | LandingPageClient + about/programs/schedule/gallery/notices/annual/simulator | 완료 |
| 2026-03-26 | 시간표 필터 UI + 공개 페이지 전체 점검 (8페이지 분석, 개선 6건 도출) | ScheduleClient + gallery + notices 등 | 기획완료 |
| 2026-03-26 | 투어 UX 개선 5건 구현 (B-1 스크롤충돌, B-2 Link충돌, 진행률, 완료토스트, 중단재개) | GuideTourTrigger.tsx, tourStyles.css | 완료 |
| 2026-03-26 | 투어 UX 개선 계획 + 위치 버그 3건 특정 | GuideTourTrigger.tsx, PublicHeader.tsx | 완료 |
| 2026-03-26 | 입학 가이드 투어 v2 구현 (driver.js, 4phase, 16파일) | guide-tour/ + 각 페이지 | 완료 |
| 2026-03-26 | 입학 가이드 투어 v2 재기획 (driver.js 채택) | guide-tour/ | 완료 |
| 2026-03-26 | admin 속도 최적화 전체 완료 | page.tsx, queries.ts, schedule/page.tsx | 완료 |
| 2026-03-22 | 최적화 3건 (폰트/MergedSlot/middleware) | layout.tsx, fonts.ts, mergeSlots.ts, middleware.ts | 완료 |
| 2026-03-22 | 앱 최적화 4건 (OG/sitemap/robots/error/API인증) | layout.tsx, sitemap.ts, robots.ts, error.tsx | 완료 |

---

## 프로젝트 현황 요약
- **완료된 Phase**: 초기 ~ Phase 10
- **개발서버**: localhost:4000
- **프로덕션 배포**: stiz-dasan.kr (Vercel)

### 대기 중인 작업
1. **네비게이션 카테고리 그룹핑**: 구현 완료. tester 검증 대기. 후속: GuideTourTrigger 투어 연동.
2. **시간표 필터 UI + 공개 페이지 UI 개선**: P1 3건 구현 완료, tester 검증 대기.
3. **입학 가이드 투어 v2**: 재기획 완료. developer 실행 대기.
4. **엑셀 업로드 일괄 등록**: planner 계획 수립 완료. 사용자 결정 대기.
