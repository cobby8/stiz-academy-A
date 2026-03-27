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

#### 수정 이력
| 회차 | 날짜 | 수정 내용 | 수정 파일 | 사유 |
|------|------|----------|----------|------|
| 1차 | 2026-03-26 | 투어 하이라이트 대상 축소 + popover 위치 수정 5건 | GuideTourTrigger.tsx | tester 요청: viewport보다 큰 요소 하이라이트 무의미 + side/block 모순 + scrollIntoView 누락 |

**developer 주의사항**:
- A1: `flex flex-wrap gap-2` -> `flex gap-2 overflow-x-auto scrollbar-hide` + 각 칩에 `shrink-0` 추가. py-4는 py-3으로 줄여도 됨.
- A2/A3: lucide-react import 제거 후, `<span className="material-symbols-outlined" style={{fontSize:N}}>icon_name</span>` 패턴 사용
- B2: gallery의 img -> Image 전환 시, Supabase Storage URL이므로 next.config.js images.remotePatterns 확인 필요

---

### 테스트 결과 (tester) -- 2026-03-26 PC/모바일 레이아웃이 투어에 미치는 영향 분석

#### 1. Phase 2: program-cards (programs/page.tsx 111줄)

**요소 구조**: `grid md:grid-cols-2 gap-6` -- PC: 2열 그리드, 모바일: 1열 스택
**PC 예상 크기**: max-w-6xl(1152px) 컨테이너 안의 2열 그리드. 프로그램 8개 가정 시 4행x2열, 높이 약 1600~2000px
**모바일 예상 크기**: 1열, 8개 카드 세로 나열 시 높이 약 3000~4000px
**driver.js 설정**: side:"bottom", scrollIntoView block:"start", 500ms 대기 후 drive

| 분석 항목 | 결과 | 심각도 | 설명 |
|-----------|------|--------|------|
| PC side:"bottom" | 주의 | 중 | 요소 높이가 viewport(~900px)보다 훨씬 크다. block:"start"로 스크롤 후 요소 상단이 화면 최상단에 오는데, popover side:"bottom"이면 요소 하단(=화면 밖 훨씬 아래)에 popover가 위치한다. driver.js는 popover가 viewport 밖이면 자동 재배치하지만, 큰 요소에서는 popover가 요소 중간에 떠서 카드를 가리는 문제가 생길 수 있다. |
| 모바일 side:"bottom" | 주의 | 중 | 모바일에서 1열 기준 3000px+ 높이. 같은 문제가 더 심화됨. popover가 화면 밖으로 나가거나, 요소 중간에 떠서 컨텐츠를 가릴 수 있다. |
| 하이라이트 영역 | 주의 | 높음 | driver.js SVG cutout이 전체 프로그램 카드 영역을 감싸야 한다. viewport보다 큰 요소를 cutout하면, 오버레이 어두운 영역이 거의 없어져서 "하이라이트" 효과가 사라지고 사용자가 어디를 봐야 하는지 혼란스럽다. |
| 스크롤 가이드 문구 | OK | - | "스크롤하여 다양한 프로그램을 둘러보세요" 안내가 있어서 사용자는 스크롤 가능 인지 |

**수정 방향**:
- (A) program-cards 전체 대신 **첫 번째 카드만** 하이라이트하는 방식으로 변경. selector를 `[data-tour-target="program-cards"] > div:first-child`로 바꾸면 적당한 크기의 카드 하나만 하이라이트됨
- (B) 또는 popover side를 "bottom"에서 **"over"**(요소 위에 겹침)로 바꾸는 대안도 있음
- (C) 최소한 side를 "top"으로 바꾸면 block:"start" 후 상단 popover가 보임

---

#### 2. Phase 3: schedule-grid (ScheduleClient.tsx 126줄)

**요소 구조**: `space-y-8` 안에 요일별 카드가 세로로 나열. 활성 요일이 5~7개면 각 카드 높이 ~300px
**PC 예상 크기**: 5요일 기준 약 1500~2000px 높이
**모바일 예상 크기**: 같은 구조이나 카드가 더 세로로 길어져서 2000~3000px
**driver.js 설정**: side:"top", scrollIntoView block:"start", 500ms 대기 후 drive
**필터 포함 여부**: schedule-grid는 필터 바 아래의 `<section>` 안 `<div>`에만 적용됨. 필터 바는 포함되지 않음.

| 분석 항목 | 결과 | 심각도 | 설명 |
|-----------|------|--------|------|
| side:"top" + block:"start" 조합 | 문제 | 높음 | block:"start"로 스크롤하면 요소 상단이 viewport 최상단에 온다. 그런데 side:"top"이면 popover가 요소 위에 나타나야 하는데, 위에 공간이 없다(0px). driver.js가 자동 재배치하겠지만, 재배치 후 side가 어디로 갈지 예측 불가능하다. |
| PC에서 popover 위치 | 주의 | 중 | sticky 필터 바(top:0, z-10)가 있다. block:"start" 후 요소 상단이 viewport 상단에 오면, sticky 필터가 그리드 위에 겹친다. popover가 "top"으로 뜨면 필터 바 아래에 가려질 수 있다. |
| 모바일에서 하이라이트 | 주의 | 높음 | program-cards와 같은 문제. viewport보다 큰 요소 전체를 cutout하면 하이라이트 효과 없음. |
| smoothScroll 미설정 | OK | - | smoothScroll 옵션이 빠져 있어 driver.js 기본 스크롤 동작에 위임됨 |

**수정 방향**:
- (A) schedule-grid 전체 대신 **첫 번째 요일 카드만** 하이라이트. selector: `[data-tour-target="schedule-grid"] > div:first-child`
- (B) side를 "top"에서 **"bottom"**으로 변경 + block:"start" 유지 (요소 상단 보이고 그 아래에 popover)
- (C) 또는 block을 "center"로 바꾸면 요소 중간이 화면 가운데 오고 top/bottom 어느 쪽이든 공간이 생김

---

#### 3. Phase 4: sim-step2-card (SimulatorClient.tsx 250줄)

**요소 구조**: `bg-white rounded-2xl p-6 md:p-8` 카드. 내부에 학년 표시 + 요일 버튼 7개 + 시간 버튼 4개 + 이전/검색 버튼
**PC 예상 크기**: max-w-2xl(672px) 컨테이너 안. 높이 약 450~550px. viewport(900px)보다 작음
**모바일 예상 크기**: 화면 폭 거의 전체(padding 제외), 높이 약 500~600px. viewport(667~844px)에 비해 약간 작거나 비슷
**driver.js 설정**: side:"top", scrollIntoView block:"center", 400ms 대기 후 drive

| 분석 항목 | 결과 | 심각도 | 설명 |
|-----------|------|--------|------|
| PC: 크기 적절 | OK | - | 카드가 viewport보다 작아서 하이라이트가 정상 동작함 |
| 모바일: 크기 경계선 | 주의 | 낮음 | 카드 높이(~550px)가 모바일 viewport(~667px)에 근접. block:"center"로 스크롤하면 카드가 화면 중앙에 오고 popover side:"top"이 위에 뜨는데, 위 공간이 ~60px 정도밖에 없을 수 있다. popover가 잘릴 가능성 있으나 driver.js 자동 재배치가 처리할 것으로 예상 |
| sim-search-btn 가시성 | 주의 | 중 | sim-search-btn은 step2 카드 하단 버튼. step2 카드를 block:"center"로 스크롤하면 카드 전체가 보이므로 버튼도 보여야 한다. 그러나 모바일에서 카드 높이가 viewport에 가까우면 하단 버튼이 잘릴 수 있다. runSubStep4_4에서 별도로 searchBtn.scrollIntoView(block:"center")를 하므로 이 문제는 해결됨 |

**수정 방향**:
- 현재 상태로 대부분 정상 동작 예상. 모바일에서 popover가 잘리면 side를 "bottom"으로 변경하는 것이 안전

---

#### 4. Phase 4: sim-results (SimulatorClient.tsx 334줄)

**요소 구조**: `<div data-tour-target="sim-results">` 안에 검색조건 요약 카드 + 결과 카드 리스트(space-y-3) + CTA 카드 + 조건변경 버튼
**PC 예상 크기**: 결과가 5개면 각 ~120px + 요약 ~100px + CTA ~150px = 약 950px. 결과가 많으면 viewport 초과
**모바일 예상 크기**: 동일 구조이나 카드가 더 높아질 수 있음. 10개 결과면 1500px+
**driver.js 설정**: side:"top", scrollIntoView block:"start"

| 분석 항목 | 결과 | 심각도 | 설명 |
|-----------|------|--------|------|
| 결과 적을 때 (1~3개) | OK | - | 요소가 viewport보다 작아서 정상 |
| 결과 많을 때 (5개+) | 주의 | 중 | program-cards/schedule-grid와 같은 "큰 요소" 문제. 전체를 cutout하면 하이라이트 효과 없음 |
| side:"top" + block:"start" | 문제 | 중 | Phase 3과 동일. block:"start"로 상단 맞추면 top에 popover 공간 없음. driver.js 자동 재배치에 의존 |
| 스크롤 가이드 문구 | OK | - | "스크롤하여 검색 결과를 확인해보세요" 안내 있음 |

**수정 방향**:
- (A) sim-results 전체 대신 **검색 조건 요약 카드만** 하이라이트. 결과 개수가 표시되는 부분만 보여주면 충분
- (B) side를 "bottom"으로 변경하여 block:"start" 후 바로 아래에 popover 표시

---

#### 5. Phase 5: trial-apply-btn (ApplyPageClient.tsx 197줄)

**요소 구조**: `<Button>` 컴포넌트. 체험수업 카드 내부 하단에 위치
**PC 예상 크기**: 버튼 하나. 약 200x44px 정도. 매우 작은 요소
**모바일 예상 크기**: 비슷하거나 모바일에서는 full-width일 수 있음
**driver.js 설정**: side:"top", waitForElement 3초

| 분석 항목 | 결과 | 심각도 | 설명 |
|-----------|------|--------|------|
| 버튼 위치 접근성 | 주의 | 중 | 이 버튼은 /apply 페이지의 체험수업 카드 안에 있다. 페이지 로드 시 히어로 영역 아래에 카드가 있으므로, 버튼까지 스크롤이 필요할 수 있다. 그런데 Phase 5 코드에는 **scrollIntoView가 없다**. waitForElement로 버튼을 찾기만 하고 스크롤을 안 한다. driver.js가 자체적으로 스크롤을 시도하겠지만, smoothScroll 옵션이 없어서 갑작스러운 점프가 발생할 수 있다. |
| PC에서 위치 | OK | - | 2열 그리드(md:grid-cols-2)의 왼쪽 카드 안. 히어로 높이가 줄었으므로 스크롤이 적거나 없을 수 있음 |
| 모바일에서 위치 | 주의 | 중 | 1열이라 체험수업 카드가 위에 오고 버튼은 카드 하단. 히어로 + 카드 헤더 + 내용 + 버튼까지 스크롤 필요. 화면 밖일 가능성 높음 |
| trialFormUrl 미설정 시 | 주의 | 높음 | trialFormUrl이 없으면 `data-tour-target="trial-apply-btn"`이 DOM에 없다 (disabled 버튼에는 data-tour-target이 없음, 202줄). waitForElement가 3초 후 null 반환 -> finishTour() 호출. 투어가 조용히 끝나버려서 사용자는 "왜 갑자기 끝났지?" 혼란 |

**수정 방향**:
- (A) Phase 5에 `btn.scrollIntoView({ behavior: "smooth", block: "center" })` 추가 (다른 Phase에는 있는데 여기만 누락)
- (B) trialFormUrl 미설정 시에도 disabled 버튼에 data-tour-target 추가하거나, Phase 5에서 대체 popover 표시
- (C) side:"top"은 적절. 버튼이 작은 요소이므로 block:"center"로 중앙 배치하면 위아래 공간 충분

---

#### 종합 분석: driver.js 설정 일관성 검토

| Phase | 대상 요소 | side | scrollIntoView | 요소 크기 vs viewport | 핵심 문제 |
|-------|----------|------|----------------|----------------------|----------|
| 2 | program-cards | bottom | block:"start" | 훨씬 큼 (2x~4x) | 큰 요소 하이라이트 무의미, popover 위치 불안정 |
| 3 | schedule-grid | top | block:"start" | 훨씬 큼 (2x~3x) | side:"top" + block:"start" 모순, sticky 필터 겹침 |
| 4-3 | sim-step2-card | top | block:"center" | 비슷하거나 약간 작음 | 경미. 모바일에서 약간 빠듯 |
| 4-4 | sim-search-btn | top | block:"center" | 매우 작음 | OK |
| 4-5 | sim-results | top | block:"start" | 결과 수에 따라 다름 | 결과 많으면 Phase 2/3과 같은 문제 |
| 5 | trial-apply-btn | top | 없음! | 매우 작음 | scrollIntoView 누락 + trialFormUrl 미설정 시 투어 중단 |

### 심각도별 정리

**높음 (수정 권장)**:
1. Phase 2/3/4-5: viewport보다 큰 요소 전체를 하이라이트하면 cutout이 화면 전체를 덮어서 하이라이트 효과 없음 -> 첫 번째 자식 요소만 하이라이트하는 것으로 변경
2. Phase 5: scrollIntoView 누락 -> 추가 필요
3. Phase 5: trialFormUrl 미설정 시 투어가 조용히 종료 -> 대체 UI 필요

**중간 (개선 권장)**:
4. Phase 3: side:"top" + block:"start" 조합 모순 -> side:"bottom" 또는 block:"center"로 변경
5. Phase 3: sticky 필터 바가 그리드 위에 겹침 가능 -> 스크롤 offset 고려
6. Phase 4-5: 결과 많을 때 큰 요소 문제 -> 검색 조건 요약 카드만 하이라이트

**낮음 (참고)**:
7. Phase 4-3: 모바일에서 popover 잘릴 수 있으나 driver.js 자동 재배치로 대응 예상

### 수정 요청

| 요청자 | 파일명 | 문제 설명 | 상태 |
|--------|--------|----------|------|
| tester | GuideTourTrigger.tsx | [높음] Phase 2: program-cards 전체 대신 첫번째 카드만 하이라이트 (selector 변경) | 완료 |
| tester | GuideTourTrigger.tsx | [높음] Phase 3: schedule-grid 전체 대신 첫번째 요일 카드만 하이라이트 (selector 변경) | 완료 |
| tester | GuideTourTrigger.tsx | [높음] Phase 3: side:"top" -> side:"bottom" 변경 (block:"start"와 호환) | 완료 |
| tester | GuideTourTrigger.tsx | [높음] Phase 5: btn.scrollIntoView 추가 (다른 Phase에는 있는데 여기만 누락) | 완료 |
| tester | GuideTourTrigger.tsx / ApplyPageClient.tsx | [높음] Phase 5: trialFormUrl 미설정 시 투어가 무음 종료되는 문제 대응 | 대기 |
| tester | GuideTourTrigger.tsx | [중] Phase 4-5: sim-results 전체 대신 검색조건 요약 부분만 하이라이트 고려 | 완료 |

---

## 작업 로그 (최근 10건)

| 날짜 | 작업 내용 | 파일 | 상태 |
|------|----------|------|------|
| 2026-03-26 | 공개 페이지 히어로 영역 높이 75% 축소 (9개 파일 패딩 변경) | LandingPageClient + about/programs/schedule/gallery/notices/annual/simulator | 완료 |
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
