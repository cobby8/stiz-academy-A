# 작업 스크래치패드

## 현재 작업
- **요청**: 시간표 필터 UI 개선 계획 + 공개 페이지 전체 UI 점검
- **상태**: P1 3건 구현 완료 (tester 검증 대기)
- **현재 담당**: developer -> tester
- **마지막 세션**: 2026-03-26

---

### 기획설계 (planner-architect) -- 2026-03-26 시간표 필터 + 공개 페이지 UI 점검

#### 1. 시간표 필터 UI 개선 (핵심 작업)

**현재 문제**: ScheduleClient.tsx 68~97줄. 프로그램 8개가 `flex-wrap`으로 4줄에 걸쳐 나열됨. sticky top-0이라 스크롤 시 화면 상단 약 120px을 항상 차지.

**추천안: 수평 스크롤 칩 (안 2)**
- 이유: (1) 한 줄로 줄어듦 (높이 ~48px), (2) 모바일에서 가장 자연스러운 패턴(앱스토어/배민 스타일), (3) 기존 pill 디자인 유지 가능, (4) 구현 난이도 가장 낮음
- 방법: `flex-wrap` 제거 -> `overflow-x-auto` + `scrollbar-hide` + `whitespace-nowrap`
- 보조: 좌우 그라디언트 페이드로 스크롤 가능 힌트 표시
- 긴 프로그램명("목요 성인반(평내호평점 스포라운드)")은 `shrink-0`으로 줄바꿈 방지

**대안 비교표**:
| 안 | 방식 | 높이 | 모바일 | 난이도 | 비고 |
|----|------|------|--------|--------|------|
| 1 | 드롭다운 | ~48px | 좋음 | 하 | 한눈에 옵션 파악 불가, 터치 2회 필요 |
| **2** | **수평 스크롤 칩** | **~48px** | **최적** | **하** | **추천. 기존 디자인 유지** |
| 3 | 접힌 필터 | ~48px | 보통 | 중 | 평소엔 숨김, 클릭해야 보임 |
| 4 | 작은 칩 | ~80px | 보통 | 하 | 여전히 2줄 이상. 근본 해결 안됨 |
| 5 | 세그먼트 컨트롤 | ~48px | 보통 | 중 | 8개엔 과도함 |

---

#### 2. 공개 페이지 전체 UI 점검 결과

**[A] 즉시 개선 권장 (P1)**

| # | 페이지 | 문제 | 개선안 |
|---|--------|------|--------|
| A1 | /schedule | 필터 4줄 차지 (이 작업의 핵심) | 수평 스크롤 칩 |
| A2 | /gallery | lucide-react 아이콘 사용 중 (X, ChevronLeft, ChevronRight, Image, Play, Calendar) | Material Symbols Outlined로 교체 필요 (conventions 위반) |
| A3 | /notices | lucide-react 아이콘 사용 중 (Pin, Paperclip) | Material Symbols Outlined로 교체 필요 |

**[B] 개선하면 좋은 것 (P2)**

| # | 페이지 | 문제 | 개선안 |
|---|--------|------|--------|
| B1 | /about | 교육 이념 코드 중복 (philosophyText 유무에 따라 동일 카드 2번 작성, 137~175줄) | 삼항 연산자를 상위로 올려 카드 부분은 한 번만 작성 |
| B2 | /gallery | `<img>` 태그 직접 사용 (67, 209줄) | Next.js `<Image>` 컴포넌트로 교체 (성능 최적화) |
| B3 | /annual | 연도 버튼 영역이 넓을 때 줄바꿈 발생 | 수평 스크롤로 통일 (A1과 같은 패턴) |

**[C] 양호 -- 수정 불필요**

| 페이지 | 판정 | 비고 |
|--------|------|------|
| /programs | 양호 | 카드 구조 깔끔, 반응형 잘 동작 |
| /simulator | 양호 | 위저드 3단계 UX 명확, 모바일 최적화됨 |
| /apply | 양호 | 2열 카드 + FAQ 아코디언 깔끔 |
| / (랜딩) | 양호 | 히어로+CTA+섹션 구성 적절 |

---

#### 실행 계획

| 순서 | 작업 | 파일 | 담당 | 선행 |
|------|------|------|------|------|
| 1 | 시간표 필터 수평 스크롤 칩 전환 | ScheduleClient.tsx (68~96줄) | developer | 없음 |
| 2 | gallery lucide -> Material Symbols 교체 | GalleryPublicClient.tsx | developer | 없음 |
| 3 | notices lucide -> Material Symbols 교체 | notices/page.tsx | developer | 없음 |
| 4 | tester (1~3 통합 검증) | - | tester | 1,2,3 |
| 5 | (선택) about 코드 중복 제거 + gallery img->Image | about/page.tsx, GalleryPublicClient.tsx | developer | 4 |

1~3 병렬 가능. 4는 순차. 5는 별도 배치.

---

### 구현 기록 (developer) -- 2026-03-26 P1 UI 개선 3건

| 파일 경로 | 변경 내용 | 신규/수정 |
|----------|----------|----------|
| src/app/globals.css | scrollbar-hide 유틸리티 클래스 추가 (@layer utilities) | 수정 |
| src/app/schedule/ScheduleClient.tsx | 필터: flex-wrap -> overflow-x-auto scrollbar-hide + 각 칩 shrink-0 whitespace-nowrap | 수정 |
| src/app/gallery/GalleryPublicClient.tsx | lucide-react 6종(X,ChevronLeft,ChevronRight,ImageIcon,Play,Calendar) -> Material Symbols | 수정 |
| src/app/notices/page.tsx | lucide-react 2종(Pin,Paperclip) -> Material Symbols(push_pin,attach_file) | 수정 |

tester 참고:
- /schedule: 프로그램 필터가 1줄 수평 스크롤로 표시되는지, 스크롤바가 숨겨지는지 확인
- /gallery: 빈 갤러리 아이콘, 동영상 재생 아이콘, 날짜 달력 아이콘, 라이트박스 닫기/좌우 네비 아이콘 정상 표시 확인
- /notices: 중요 공지 핀 아이콘, 첨부파일 클립 아이콘 정상 표시 확인
- tsc --noEmit 통과 완료

**developer 주의사항**:
- A1: `flex flex-wrap gap-2` -> `flex gap-2 overflow-x-auto scrollbar-hide` + 각 칩에 `shrink-0` 추가. py-4는 py-3으로 줄여도 됨.
- A2/A3: lucide-react import 제거 후, `<span className="material-symbols-outlined" style={{fontSize:N}}>icon_name</span>` 패턴 사용
- B2: gallery의 img -> Image 전환 시, Supabase Storage URL이므로 next.config.js images.remotePatterns 확인 필요

---

## 작업 로그 (최근 10건)

| 날짜 | 작업 내용 | 파일 | 상태 |
|------|----------|------|------|
| 2026-03-26 | 시간표 필터 UI + 공개 페이지 전체 점검 (8페이지 분석, 개선 6건 도출) | ScheduleClient + gallery + notices 등 | 기획완료 |
| 2026-03-26 | 투어 UX 개선 5건 구현 (B-1 스크롤충돌, B-2 Link충돌, 진행률, 완료토스트, 중단재개) | GuideTourTrigger.tsx, tourStyles.css | 완료 |
| 2026-03-26 | 투어 UX 개선 계획 + 위치 버그 3건 특정 | GuideTourTrigger.tsx, PublicHeader.tsx | 완료 |
| 2026-03-26 | 입학 가이드 투어 v2 구현 (driver.js, 4phase, 16파일) | guide-tour/ + 각 페이지 | 완료 |
| 2026-03-26 | 입학 가이드 투어 v2 재기획 (driver.js 채택) | guide-tour/ | 완료 |
| 2026-03-26 | admin 속도 최적화 전체 완료 | page.tsx, queries.ts, schedule/page.tsx | 완료 |
| 2026-03-22 | 최적화 3건 (폰트/MergedSlot/middleware) | layout.tsx, fonts.ts, mergeSlots.ts, middleware.ts | 완료 |
| 2026-03-22 | 앱 최적화 4건 (OG/sitemap/robots/error/API인증) | layout.tsx, sitemap.ts, robots.ts, error.tsx | 완료 |
| 2026-03-22 | 시뮬레이터 + 관리자 최적화 | simulator/ + admin/ | 완료 |
| 2026-03-22 | 챗봇 종합 개선 (분류/프롬프트/데이터소스/UI) | route.ts + ChatMessage/Panel.tsx | 완료 |

---

## 프로젝트 현황 요약
- **완료된 Phase**: 초기 ~ Phase 10
- **개발서버**: localhost:4000
- **프로덕션 배포**: stiz-dasan.kr (Vercel)

### 대기 중인 작업
1. **시간표 필터 UI + 공개 페이지 UI 개선**: 기획 완료. developer 실행 대기.
2. **입학 가이드 투어 v2**: 재기획 완료. developer 실행 대기.
3. **엑셀 업로드 일괄 등록**: planner 계획 수립 완료. 사용자 결정 대기.
