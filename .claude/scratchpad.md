# 작업 스크래치패드

## 현재 작업
- **요청**: 입학 가이드 투어 UX 개선 계획 + 랜딩페이지 위치 버그 분석
- **상태**: 분석 완료. UX 개선 우선순위 정리됨.
- **현재 담당**: planner-architect
- **마지막 세션**: 2026-03-26

---

### 기획설계 (planner-architect) -- 2026-03-26 v3 (UX 개선 + 버그 분석)

#### 랜딩페이지 위치 버그 -- 원인 3건 특정

**버그 B-1: sticky 헤더 + driver.js 스크롤 충돌 (영향도: 높음)**
- PublicHeader가 `sticky top-0`이라 스크롤해도 항상 화면 최상단에 고정
- driver.js는 하이라이트 대상의 getBoundingClientRect()로 위치를 잡고 scrollIntoView를 시도
- sticky 요소는 스크롤 위치와 무관하게 동일 좌표 -> driver.js의 스크롤 로직이 불필요하게 작동
- 증상: popover가 헤더와 겹치거나, 페이지가 불필요하게 스크롤됨
- 해결: driver.js의 `disableActiveInteraction: false` + `scrollIntoView: false` 옵션 적용 (nav 링크 스텝만)

**버그 B-2: e.preventDefault() + Next.js Link 이벤트 충돌 (영향도: 중간)**
- GuideTourTrigger에서 DOM addEventListener로 click 리스너를 붙이고 e.preventDefault() 호출
- Next.js Link는 React 합성 이벤트로 자체 click 핸들러를 가짐
- DOM 이벤트와 React 합성 이벤트의 실행 순서가 보장되지 않음
- 증상: 간헐적으로 두 번 네비게이션 발생, 또는 투어 파라미터 누락
- 해결: addEventListener 대신 대상 <a>의 href를 직접 교체하는 방식, 또는 data-tour-href 활용

**버그 B-3: 모바일 사이드바 z-index vs driver.js 오버레이 (영향도: 낮음)**
- 사이드바 z-index: 70, driver.js 오버레이 기본 z-index: 10000
- driver.js가 사이드바 위에 올라가므로 문제 없어 보이나, 사이드바 열림 애니메이션(400ms) 중에 driver.js가 시작되면 요소 위치 계산이 틀릴 수 있음
- 해결: setTimeout 400ms 이후 drive() 호출 (현재 이미 적용됨 -- 확인만 필요)

---

#### UX 개선 항목 10건 분석 + 우선순위

| # | 항목 | 현재 상태 | 영향도 | 난이도 | 우선순위 |
|---|------|----------|--------|--------|---------|
| 1 | 투어 시작 경험 (첫방문 토스트) | 3초 후 자동 표시, 디자인 양호 | 중 | 하 | P2 |
| 2 | 진행률 표시 (N/M 단계) | 없음. showProgress:false 설정 | 높 | 하 | **P1** |
| 3 | 말풍선 디자인 | tourStyles.css 하드코딩 색상. 디자인시스템 불일치 | 중 | 하 | P2 |
| 4 | 페이지 이동 전환 애니메이션 | 없음. router.push 후 300ms 대기만 | 중 | 중 | P3 |
| 5 | 투어 중단/재개 | 닫으면 끝. 재개 불가 | 높 | 중 | **P1** |
| 6 | 투어 완료 후 안내 | markCompleted()만 호출. 축하 메시지 없음 | 높 | 하 | **P1** |
| 7 | 접근성 (키보드/스크린리더) | driver.js 기본만 의존. 별도 처리 없음 | 낮 | 높 | P4 |
| 8 | 에러 처리 (요소 못 찾을 때) | 없음. 요소 없으면 driver.js가 조용히 실패 | 중 | 하 | P2 |
| 9 | 버튼 텍스트 한국어화 | doneBtnText/nextBtnText는 설정됨. closeBtnText 미설정 (X 아이콘이라 OK) | 낮 | 하 | P4 |
| 10 | 투어 리셋 (다시 보기) | 플로팅 버튼으로 언제든 시작 가능. 단, 완료 후에도 버튼이 보이는지? | 중 | 하 | P2 |

---

#### 우선순위별 실행 계획

**P1 -- 바로 실행 (영향도 높음, 난이도 낮~중)**

| 순서 | 작업 | 상세 | 담당 | 선행 |
|------|------|------|------|------|
| 1 | 위치 버그 B-1 수정 | nav 링크 스텝에 scrollIntoView:false 추가 | developer | 없음 |
| 2 | 위치 버그 B-2 수정 | addEventListener -> href 직접 교체 방식으로 변경 | developer | 없음 |
| 3 | 진행률 표시 추가 | popover description에 "(1/6)" 등 표시, 또는 driver.js showProgress 활용 | developer | 없음 |
| 4 | 투어 완료 축하 메시지 | Phase 4 onDestroyed에서 완료 토스트/모달 표시 | developer | 없음 |
| 5 | 투어 중단/재개 UX | 중간 닫기 시 "나중에 이어볼까요?" 확인 + localStorage에 현재 phase 저장 | developer | 없음 |
| 6 | tester + reviewer (병렬) | 브라우저 테스트 + 코드 리뷰 | tester + reviewer | 1~5 |

1~5단계 병렬 가능 (독립 영역). 6단계만 순차.

**P2 -- 다음 배치 (중간 우선순위)**
- 첫방문 토스트 문구/디자인 개선
- tourStyles.css에서 CSS 변수(var(--color-*)) 사용으로 전환
- 요소 못 찾을 때 fallback 처리 (다음 스텝으로 자동 스킵)
- 투어 리셋: 완료 후에도 플로팅 버튼 유지 확인

**P3 -- 나중에 (nice-to-have)**
- 페이지 이동 시 로딩 인디케이터
- 접근성 강화

---

#### developer 주의사항

위치 버그 수정 시:
- driver.js의 `popoverOffset` 옵션을 사용하면 popover 위치를 미세 조정할 수 있음
- `scrollIntoView` 옵션은 스텝별로 개별 설정 가능 (steps 배열 각 항목에)
- Next.js Link의 이벤트 충돌 해결 시, `e.stopImmediatePropagation()`은 사용하지 말 것 (다른 핸들러도 차단됨)
- href 직접 교체 방식: `element.setAttribute('href', '/programs?tour=2')` 후 클릭 허용 -> onDeselected에서 원복

진행률 표시 시:
- driver.js의 showProgress는 "3 of 6" 영어 형식이므로, progressText 옵션으로 한국어화 필요
- 또는 description에 직접 "(1/6 단계)" 텍스트 추가가 더 간단

---

### 기획설계 (planner-architect) -- 2026-03-26 v2 (완전 재기획)

#### 입학 가이드 투어 v2 -- "게임 튜토리얼" 방식 재설계

**목표**: 작은 버튼/메뉴만 하이라이트하고, 사용자가 직접 클릭하여 페이지를 이동하는 게임 튜토리얼 스타일 가이드

---

**0. 이전 실패 원인 분석 (5회 구현 실패)**

| 실패 원인 | 설명 | v2 해결책 |
|-----------|------|----------|
| 하이라이트 대상이 너무 크다 | 히어로 섹션, TrustBadges 등 전체 섹션을 하이라이트 -> 화면 전체가 밝아짐 | 버튼/메뉴 등 **작은 요소만** 하이라이트 |
| "다음" 버튼 수동 이동 | 슬라이드쇼처럼 말풍선 내 버튼만 누르는 방식 | 하이라이트된 요소를 **직접 클릭**하면 다음 단계 |
| box-shadow 스포트라이트 실패 | 부모 stacking context, 큰 요소 크기 등 CSS 충돌 | **driver.js 라이브러리** 사용 (검증된 SVG cutout) |
| z-index 조작 실패 | 대상 DOM에 z-index 직접 부여 -> 부모 stacking context에 갇힘 | driver.js가 내부적으로 처리 (cloneNode/절대좌표) |
| 4-div 오버레이 방식 실패 | 대상이 뷰포트보다 크면 구멍이 전체를 차지 | 작은 요소만 타겟 -> 이 문제 자체가 발생하지 않음 |

---

**1. 핵심 설계 변경: driver.js 라이브러리 채택**

이전 기획에서 "직접 구현"을 선택했지만, 5회 연속 하이라이트 구현 실패.
이번에는 검증된 라이브러리를 사용하되, 페이지 간 이동만 자체 로직으로 처리.

driver.js를 선택한 이유:
- 번들 크기 ~5KB gzipped (가장 가벼움)
- vanilla JS -> React 래핑 불필요 (useEffect에서 직접 호출)
- SVG cutout 방식으로 **작은 요소도 정확히 하이라이트** (CSS hack 불필요)
- onNextClick 콜백으로 "다음" 버튼 동작을 완전히 제어 가능
- onHighlightStarted에서 대상 요소에 클릭 이벤트 리스너 부착 가능
- pointer-events 자동 처리 -> 하이라이트된 요소 클릭 가능
- AGPL이 아닌 MIT 라이센스

페이지 간 이동 전략:
- driver.js는 단일 페이지 투어 라이브러리 -> 페이지 이동 시 투어 인스턴스가 파괴됨
- 해결: 각 페이지에서 "해당 페이지 스텝만" 실행하는 독립 투어 인스턴스 생성
- 페이지 간 상태 연결: URL 파라미터 `?tour=phase` (phase1=메인, phase2=프로그램, ...)
- 페이지 도착 시 ?tour 감지 -> 해당 페이지 투어 자동 시작

---

**2. 하이라이트할 "작은 요소" 목록 (CSS 셀렉터)**

코드 분석 결과, 각 페이지에서 하이라이트할 구체적 요소:

| # | 페이지 | 요소 | 현재 셀렉터 | data-tour 추가 | 크기 |
|---|--------|------|-------------|---------------|------|
| 1 | `/` | 헤더 "프로그램안내" 메뉴 링크 | `nav a[href="/programs"]` | `data-tour="nav-programs"` | 약 80x30px |
| 2 | `/programs` | 첫 번째 프로그램 카드의 가격표(table) | 프로그램 카드 내 table | `data-tour="price-table"` | 약 400x200px |
| 3 | `/programs` | 헤더 "수업시간표" 메뉴 링크 | `nav a[href="/schedule"]` | `data-tour="nav-schedule"` | 약 80x30px |
| 4 | `/schedule` | 시간표 그리드의 첫 번째 요일 칼럼 | ScheduleClient 내 요일 카드 | `data-tour="schedule-day"` | 약 300x400px |
| 5 | `/schedule` | 헤더 "우리 아이 수업 찾기" 메뉴 링크 | `nav a[href="/simulator"]` | `data-tour="nav-simulator"` | 약 120x30px |
| 6 | `/simulator` | 학년 선택 드롭다운 | select 요소 | `data-tour="grade-select"` | 약 300x45px |
| 7 | `/simulator` | (학년 선택 후) "다음 단계" 버튼 | button | `data-tour="sim-next"` | 약 300x45px |
| 8 | `/apply` | 체험수업 신청 카드/버튼 | 체험수업 CTA | `data-tour="trial-card"` | 약 400x200px |

핵심 원칙: **모든 하이라이트 대상의 최대 크기가 약 400x400px 이하**. 히어로 섹션(1920x600px)같은 거대 요소는 절대 하이라이트하지 않음.

---

**3. 투어 흐름 재설계 (게임 튜토리얼 방식)**

투어 컨셉: "직접 클릭하며 학원 둘러보기"

**Phase 1: 메인 페이지 (/)** -- ?tour=1
```
스텝 1-1: [환영 팝업] 화면 중앙 모달 (하이라이트 없음)
  "안녕하세요! 스티즈 농구교실을 처음 방문하셨군요."
  "학원을 직접 둘러보면서 알아볼까요?"
  [시작하기] [건너뛰기]

스텝 1-2: 헤더의 "프로그램안내" 메뉴 하이라이트
  말풍선: "먼저 프로그램을 확인해 볼까요? 여기를 눌러보세요!"
  -> 사용자가 "프로그램안내" 링크를 직접 클릭
  -> /programs?tour=2 로 이동 (Next.js Link의 자연스러운 이동)
```

**Phase 2: 프로그램 페이지 (/programs)** -- ?tour=2
```
스텝 2-1: 첫 번째 프로그램 카드의 가격표 하이라이트
  말풍선: "우리 아이 나이에 맞는 프로그램과 수강료를 확인하세요!"
  -> "확인" 클릭 (정보 읽기용, 클릭 불가 요소)

스텝 2-2: 헤더의 "수업시간표" 메뉴 하이라이트
  말풍선: "수업 시간도 확인해 볼까요? 여기를 눌러보세요!"
  -> 사용자가 "수업시간표" 링크를 직접 클릭
  -> /schedule?tour=3 으로 이동
```

**Phase 3: 시간표 페이지 (/schedule)** -- ?tour=3
```
스텝 3-1: 시간표의 첫 번째 요일 칼럼 하이라이트
  말풍선: "요일별로 수업 시간과 잔여 인원을 확인할 수 있어요."
  -> "확인" 클릭

스텝 3-2: 헤더의 "우리 아이 수업 찾기" 메뉴 하이라이트
  말풍선: "우리 아이에게 딱 맞는 수업을 찾아볼까요? 여기를 눌러보세요!"
  -> 사용자가 직접 클릭 -> /simulator?tour=4 이동
```

**Phase 4: 수업 찾기 페이지 (/simulator)** -- ?tour=4
```
스텝 4-1: 학년 선택 드롭다운 하이라이트
  말풍선: "먼저 아이의 학년을 선택하세요."
  -> 사용자가 드롭다운을 직접 조작 (투어 일시정지, 선택 완료 감지)

스텝 4-2: [투어 종료 팝업] 화면 중앙 모달
  "이제 직접 수업을 찾아보세요! 마음에 드는 수업을 찾으면 체험 수업을 신청할 수 있어요."
  [체험 신청하기] [닫기]
  -> 투어 종료. 사용자가 시뮬레이터를 자유롭게 사용.
```

핵심 차별점 (이전 기획 대비):
- 8스텝에서 **6스텝**으로 축소 (체험신청 페이지 별도 안내 불필요 -- 시뮬레이터에서 직접 연결)
- "다음" 버튼 대신 **실제 메뉴 클릭으로 이동** (3회)
- "정보 읽기" 스텝은 **확인 버튼**으로 진행 (3회)
- /about 페이지 생략 (프로그램/시간표가 더 중요)
- /apply 페이지 생략 (시뮬레이터 결과에서 바로 체험 신청 가능)

---

**4. 기술 설계**

**4-1. 하이라이트 방식: driver.js SVG cutout**

driver.js 내부 동작 원리:
1. 전체 화면을 덮는 SVG를 생성
2. SVG 내에 clipPath로 대상 요소 위치에 "구멍"을 뚫음
3. 구멍 안의 원래 DOM 요소가 보이고 클릭 가능
4. 구멍 밖은 반투명 오버레이

이 방식이 이전 CSS hack(box-shadow, 4-div, z-index)보다 확실한 이유:
- 브라우저의 SVG 렌더링 엔진이 처리 -> stacking context 영향 없음
- 작은 요소든 큰 요소든 동일하게 동작
- pointer-events를 SVG 레벨에서 제어 -> 구멍 안 요소는 자동 클릭 가능

**4-2. "직접 클릭" 구현 방식**

스텝 유형 2가지:
(A) 클릭 이동 스텝 (메뉴 링크):
  - driver.js의 onNextClick을 오버라이드하여 "다음" 버튼 숨김
  - 말풍선에 "여기를 눌러보세요!" 텍스트만 표시
  - onHighlightStarted에서 대상 <a> 요소에 클릭 이벤트 리스너 부착
  - 클릭 시: driver.destroy() -> router.push(href + '?tour=nextPhase')
  - 또는: 대상이 <a>이므로 기본 클릭 동작(페이지 이동)이 자연 발생하도록 허용

(B) 정보 읽기 스텝 (가격표, 시간표 등):
  - driver.js 기본 "확인" 버튼으로 다음 스텝 이동
  - 하이라이트된 영역은 보기만 하는 용도

**4-3. 페이지별 독립 투어 인스턴스**

```
// 각 페이지 클라이언트 컴포넌트에서:
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const tourPhase = params.get('tour');
  if (tourPhase !== '2') return; // 이 페이지의 phase가 아니면 무시

  const driverObj = driver({
    steps: PROGRAMS_TOUR_STEPS,
    onNextClick: (el, step) => { ... },
    onDestroyed: () => { ... },
  });
  driverObj.drive();

  return () => driverObj.destroy();
}, []);
```

**4-4. 페이지 간 상태 유지**

- URL 파라미터: `?tour=1`, `?tour=2`, `?tour=3`, `?tour=4`
- 각 숫자는 phase (페이지 단위), 스텝은 phase 내 driver.js가 관리
- localStorage: `stiz_tour_completed` (true/false)
- 투어 완료 또는 건너뛰기 시 true 저장

**4-5. 헤더 메뉴 링크에 data-tour 속성 부착 방식**

PublicHeader.tsx의 NAV_ITEMS 렌더링 부분:
```tsx
{NAV_ITEMS.map((item) => (
  <Link
    key={item.href}
    href={item.href}
    data-tour={`nav-${item.href.slice(1)}`}  // 예: data-tour="nav-programs"
    ...
  >
```
이렇게 하면 각 네비 링크에 data-tour 속성이 자동 부여됨.
단, 투어 중 클릭 시 ?tour=N 파라미터를 붙여야 하므로,
onClick 핸들러에서 투어 활성 여부를 감지하여 URL을 조작해야 함.

대안: driver.js의 onHighlightStarted에서 <a>의 href를 일시적으로 교체
-> 원래 href="/programs" -> href="/programs?tour=2"
-> 클릭 후 원복 (또는 onDeselected에서 원복)

더 안전한 방법: Next.js Link의 onClick을 가로채서 router.push에 tour 파라미터 추가
-> 이건 Link 컴포넌트를 감싸는 래퍼가 필요해서 복잡.

가장 단순한 방법: **data-tour-href 속성**에 투어용 URL을 별도 저장하고,
driver.js의 onHighlightStarted에서 element.addEventListener('click', handler)로
e.preventDefault() -> router.push(data-tour-href 값) 실행.

---

**5. 컴포넌트 구조 (v2)**

```
src/components/guide-tour/
  tourConfig.ts        <- 전체 투어 phase/step 정의 (데이터만)
  useTourPhase.ts      <- 커스텀 훅: URL에서 tour phase 감지 + driver.js 실행
  GuideTourTrigger.tsx <- 플로팅 "입학 가이드" 버튼 (기존 유지, 로직 단순화)
```

이전(v1) 대비 변경:
- GuideTourProvider.tsx **삭제** (Context 불필요. 각 페이지가 독립 투어)
- GuideTourOverlay.tsx **삭제** (driver.js가 오버레이/말풍선 전부 처리)
- tourSteps.ts -> tourConfig.ts (phase 단위로 재구성)
- 신규: useTourPhase.ts (훅 하나로 투어 로직 캡슐화)

비유: 건물 안내 시스템 v2
- tourConfig.ts = 안내 지도 (어떤 층에서 어떤 방을 보여줄지)
- useTourPhase.ts = 안내원 (지도를 읽고 실제 안내 실행)
- GuideTourTrigger.tsx = 로비의 "투어 시작" 버튼
- driver.js = 안내원이 들고 다니는 레이저 포인터 (하이라이트 + 말풍선)

---

**6. 만들 파일과 수정할 파일**

| 파일 경로 | 역할 | 신규/수정 |
|----------|------|----------|
| `src/components/guide-tour/tourConfig.ts` | phase별 스텝 정의 (4개 phase, 총 6스텝) | 신규 (tourSteps.ts 대체) |
| `src/components/guide-tour/useTourPhase.ts` | 커스텀 훅: ?tour=N 감지 + driver.js 인스턴스 생성/실행 | 신규 |
| `src/components/guide-tour/GuideTourTrigger.tsx` | 플로팅 버튼 (기존 파일 전면 재작성) | 재작성 |
| `src/components/guide-tour/tourStyles.css` | driver.js popover 커스텀 스타일 (Tailwind 호환) | 신규 |
| (삭제) `src/components/guide-tour/GuideTourProvider.tsx` | Context 불필요 -- 삭제 | 삭제 |
| (삭제) `src/components/guide-tour/GuideTourOverlay.tsx` | driver.js가 대체 -- 삭제 | 삭제 |
| (삭제) `src/components/guide-tour/tourSteps.ts` | tourConfig.ts로 대체 -- 삭제 | 삭제 |
| `src/components/PublicHeader.tsx` | NAV_ITEMS 링크에 data-tour 속성 추가 | 수정 |
| `src/app/LandingPageClient.tsx` | useTourPhase(1) 훅 호출 + data-tour="hero" 제거 | 수정 |
| `src/app/programs/page.tsx` | 첫 프로그램 카드 table에 data-tour="price-table" | 수정 |
| `src/app/schedule/ScheduleClient.tsx` | 첫 요일 칼럼에 data-tour="schedule-day" | 수정 |
| `src/app/simulator/SimulatorClient.tsx` | select에 data-tour="grade-select" | 수정 |
| `src/app/layout.tsx` | GuideTourProvider 래핑 제거 (Context 삭제) | 수정 |
| `src/app/page.tsx` | GuideTourOverlay 제거 | 수정 |
| `src/components/PublicPageLayout.tsx` | GuideTourOverlay 제거 | 수정 |
| `src/components/landing/ProcessSteps.tsx` | data-tour="process-steps" 래퍼 div 제거 | 수정 |
| `src/components/landing/TrustBadges.tsx` | data-tour="trust-badges" 속성 제거 | 수정 |
| `package.json` | driver.js 의존성 추가 | 수정 |

---

**7. 기존 코드 연결**

- PublicHeader NAV_ITEMS: 8개 메뉴 링크에 data-tour 속성 추가. href 기반으로 자동 생성.
- useTourPhase 훅: LandingPageClient, programs/page.tsx, ScheduleClient, SimulatorClient에서 각각 호출.
- layout.tsx: GuideTourProvider 제거 (더 이상 전역 Context 불필요).
- GuideTourTrigger: 기존 위치(PublicPageLayout, page.tsx) 유지. 내부 로직만 단순화.

---

**8. 실행 계획**

| 순서 | 작업 | 담당 | 예상 시간 | 선행 조건 |
|------|------|------|----------|----------|
| 1 | 기존 guide-tour/ 4파일 삭제 + layout/page에서 import 제거 + `npm i driver.js` | developer | 5분 | 없음 |
| 2 | tourConfig.ts 작성 (4 phase, 6스텝 정의) + tourStyles.css 작성 | developer | 10분 | 1 |
| 3 | useTourPhase.ts 훅 구현 (driver.js 래핑 + 클릭 이동 로직) | developer | 20분 | 2 |
| 4 | GuideTourTrigger.tsx 재작성 (/?tour=1 시작 링크 + 첫방문 모달) | developer | 10분 | 1 |
| 5 | 각 페이지에 data-tour 속성 추가 + useTourPhase 훅 연결 (4개 페이지) | developer | 15분 | 3, 4 |
| 6 | 브라우저 테스트 + 엣지 케이스 수정 | developer | 10분 | 5 |
| 7 | tester 검증 + reviewer 리뷰 (병렬) | tester + reviewer | 10분 | 6 |

총 예상 소요: 약 80분 (developer 70분 + 검증 10분)
1~2단계 순차. 3~4단계 병렬 가능. 5~6 순차. 7 병렬.

---

**9. developer 주의사항 (이전 실패 교훈 반영)**

중요도 높음:
- **절대 큰 섹션(히어로, TrustBadges, ProcessSteps)을 하이라이트하지 마라.** 이것이 5번 실패의 근본 원인.
- **driver.js의 SVG cutout을 믿어라.** CSS box-shadow, z-index, 4-div 등 자체 구현은 하지 마라.
- **driver.js popover 스타일링**은 tourStyles.css에서 .driver-popover 클래스 오버라이드로 처리. Tailwind @apply 사용 가능.

클릭 이동 스텝 구현:
- driver.js의 `allowClose: false` 설정 (배경 클릭으로 닫기 방지)
- 메뉴 링크 스텝: `onNextClick`을 오버라이드하여 "다음" 버튼 대신 "여기를 눌러보세요" 텍스트만 표시
- `onHighlightStarted`에서 대상 <a> 요소에 click 리스너 부착: `driverObj.destroy()` -> `router.push(href + '?tour=N')`
- `onDeselected`에서 리스너 정리 (메모리 누수 방지)

페이지 이동 시:
- Next.js App Router에서 router.push()는 클라이언트 내비게이션 -> useEffect가 재실행됨
- ?tour=N 파라미터로 해당 phase의 투어 자동 시작
- 뒤로가기(popstate) 시 투어 자동 종료: useTourPhase 내부에서 감지

driver.js import:
- `import { driver } from 'driver.js'` + `import 'driver.js/dist/driver.css'`
- 또는 tourStyles.css에서 driver.css를 @import하고 커스텀 오버라이드

---

### 구현 기록 (developer) -- 2026-03-26

구현한 기능: 입학 가이드 투어 v2 (driver.js 기반, 4phase 페이지 이동형 투어)

| 파일 경로 | 변경 내용 | 신규/수정 |
|----------|----------|----------|
| src/components/guide-tour/GuideTourProvider.tsx | 삭제 (Context 불필요) | 삭제 |
| src/components/guide-tour/GuideTourOverlay.tsx | 삭제 (driver.js가 대체) | 삭제 |
| src/components/guide-tour/tourSteps.ts | 삭제 (tourConfig 대체) | 삭제 |
| src/components/guide-tour/tourStyles.css | driver.js popover 커스텀 스타일 | 신규 |
| src/components/guide-tour/GuideTourTrigger.tsx | 전면 재작성: 4phase 투어 로직 + 플로팅 버튼 + 첫방문 토스트 | 재작성 |
| src/types/css.d.ts | CSS dynamic import 타입 선언 | 신규 |
| src/app/layout.tsx | GuideTourProvider import/래핑 제거 | 수정 |
| src/app/page.tsx | GuideTourOverlay import/렌더링 제거 | 수정 |
| src/components/PublicPageLayout.tsx | GuideTourOverlay import/렌더링 제거 | 수정 |
| src/components/PublicHeader.tsx | data-tour-target 속성 추가 (데스크탑/모바일 네비 + 햄버거) | 수정 |
| src/app/LandingPageClient.tsx | data-tour="hero" 속성 제거 | 수정 |
| src/components/landing/TrustBadges.tsx | data-tour="trust-badges" 속성 제거 | 수정 |
| src/components/landing/ProcessSteps.tsx | data-tour="process-steps" 래퍼 div 제거 | 수정 |
| src/app/programs/page.tsx | data-tour-target="program-cards" 추가 | 수정 |
| src/app/schedule/ScheduleClient.tsx | data-tour-target="schedule-grid" 추가 | 수정 |
| src/app/simulator/SimulatorClient.tsx | data-tour-target="grade-select" 추가 | 수정 |

tester 참고:
- 테스트 방법: localhost:4000 접속 -> "입학 가이드" 플로팅 버튼 클릭
- Phase 1: 메인에서 프로그램안내 메뉴 하이라이트 -> 클릭 -> /programs?tour=2
- Phase 2: 프로그램 카드 확인 -> 시간표 메뉴 클릭 -> /schedule?tour=3
- Phase 3: 시간표 그리드 확인 -> 수업 찾기 메뉴 클릭 -> /simulator?tour=4
- Phase 4: 학년 선택 영역 하이라이트 -> 닫기 시 투어 완료
- 모바일(768px 미만): 햄버거 버튼 -> 사이드바 메뉴 2단계 안내
- 첫 방문 시 3초 후 자동 토스트 표시 (localStorage 체크)
- tsc --noEmit 통과 확인됨

reviewer 참고:
- driver.js는 모두 dynamic import (빌드 번들 미포함)
- CSS는 하드코딩 색상 사용 (tourStyles.css는 driver.js 오버라이드용이라 Tailwind 사용 불가)
- useSearchParams는 Suspense 내부에서 사용

#### 수정 이력
| 회차 | 날짜 | 수정 내용 | 수정 파일 | 사유 |
|------|------|----------|----------|------|
| 1차 | 2026-03-26 | UX 개선 5건: B-1 smoothScroll:false, B-2 href교체방식, 진행률표시, 완료토스트, 중단재개 | GuideTourTrigger.tsx, tourStyles.css | planner-architect 기획: P1 우선순위 5건 |
| 2차 | 2026-03-26 | 요소 미존재 fallback 4건: waitForElement 폴링 헬퍼 + Phase2/3/4 스킵 로직 + Phase3 side:bottom | GuideTourTrigger.tsx | tester 요청: #1(polling) + #3(fallback) + #4(side변경) |

📝 수정 상세 (1차):

| 파일 경로 | 변경 내용 | 신규/수정 |
|----------|----------|----------|
| src/components/guide-tour/GuideTourTrigger.tsx | B-1(smoothScroll:false 6곳) + B-2(setupLinkHref 헬퍼) + 진행률(progressLabel) + 완료토스트(showCompletionToast) + 중단재개(savePhase/getSavedPhase/clearSavedPhase + startTour분기 + 토스트UI분기) | 수정 |
| src/components/guide-tour/tourStyles.css | @keyframes tourSlideUp 애니메이션 추가 | 수정 |

💡 tester 참고:
- B-1 테스트: PC/모바일에서 투어 시작 시 네비 링크 하이라이트할 때 페이지가 불필요하게 스크롤되지 않는지 확인
- B-2 테스트: 프로그램안내/시간표/수업찾기 링크 클릭 시 ?tour=N 파라미터 포함하여 정상 이동하는지 확인. 간헐적 이중 네비게이션 없어야 함
- 진행률: 각 popover에 "N/4 단계" 텍스트가 회색 작은 글씨로 표시되는지 확인
- 완료 토스트: Phase 4 완료 시 화면 하단 중앙에 축하 메시지 + 체험수업 신청 링크 표시, 5초 후 자동 사라짐
- 중단 재개: 투어 도중 X 눌러서 닫은 후 -> 메인 페이지 재방문 -> "이어서 볼까요?" 토스트 표시 -> "이어서 보기" 클릭 시 중단 지점부터 재개
- 중단 재개 (처음부터): 위 토스트에서 "처음부터" 클릭 시 Phase 1부터 시작
- tsc --noEmit 통과 확인됨

⚠️ reviewer 참고:
- setupLinkHref 헬퍼: href 교체 + 클릭시 driver.destroy + onDestroyed에서 href 복원 패턴
- 인라인 스타일(showCompletionToast): DOM 직접 조작이므로 Tailwind/CSS변수 사용 불가, 예외적 허용
- smoothScroll: false는 네비 링크 하이라이트 driver 인스턴스에만 적용 (프로그램카드/시간표그리드 등 큰 요소는 스크롤 필요할 수 있으므로 미적용)

---

### 테스트 결과 (tester) -- 2026-03-26 입학 가이드 투어 플로우 정적 분석

#### 테스트 방법: 코드 정적 분석 (타이밍/위치/버튼 동작 중심)

| # | 테스트 항목 | 결과 | 비고 |
|---|-----------|------|------|
| 1 | data-tour-target 셀렉터 일치 여부 (8종) | PASS | PublicHeader에서 동적 생성 패턴(`nav-${href.slice(1)}`, `mobile-nav-${href.slice(1)}`)과 GuideTourTrigger의 셀렉터가 모두 일치 |
| 2 | Phase 1 PC: driver 로드 완료 후 drive() 호출 | PASS | loadDriver()가 await 3개(driver.js, driver.css, tourStyles.css) 모두 완료 후 driver 함수를 반환 |
| 3 | Phase 1 PC: nav-programs 요소 DOM 존재 | PASS | PublicHeader가 SSR/Client 양쪽에서 렌더링되므로 항상 존재 |
| 4 | Phase 1: setupLinkCapture의 capture phase | PASS | `{ capture: true, once: true }`로 React 합성 이벤트보다 먼저 실행됨 |
| 5 | Phase 2: ?tour=2 URL 전달 | PASS | setupLinkCapture에서 routerPush("/programs?tour=2") 호출 |
| 6 | Phase 2: program-cards 렌더링 대기 (800ms) | WARNING | 아래 문제 #1 참조 |
| 7 | Phase 2: smoothScroll 미설정 (program-cards) | WARNING | 아래 문제 #2 참조 |
| 8 | Phase 3: schedule-grid 조건부 렌더링 | WARNING | 아래 문제 #3 참조 |
| 9 | Phase 3: smoothScroll 미설정 (schedule-grid) | WARNING | 아래 문제 #4 참조 |
| 10 | Phase 4: grade-select 조건부 렌더링 (step===1) | PASS | SimulatorClient 초기 step=1이므로 즉시 렌더링 |
| 11 | Phase 4: allowClose:false 동작 | PASS | 오버레이 클릭으로 닫히지 않고 버튼으로만 닫힘 |
| 12 | 버튼 텍스트 한국어화 | WARNING | 아래 문제 #5 참조 |
| 13 | Phase 2 onDestroyed -> highlightScheduleNav 300ms | PASS | 충분한 대기 시간 |
| 14 | 모바일 사이드바 z-index(70) vs driver.js 오버레이 충돌 | PASS | driver.js 기본 z-index 10000으로 사이드바 위에 표시 |
| 15 | 모바일 사이드바 열림 애니메이션(400ms) 대기 | PASS | setTimeout 400ms 후 drive() 호출 |

---

#### 발견한 문제 리포트

| # | 문제 | Phase | 원인 | 심각도 | 해결 방향 |
|---|------|-------|------|--------|----------|
| 1 | program-cards 요소가 렌더링 안 될 수 있음 (느린 네트워크/디바이스) | Phase 2 | useEffect 300ms + loadDriver() 비동기 + drive() 500ms = 총 ~800ms 대기이나, Next.js App Router의 client-side navigation 후 Server Component 렌더링이 지연되면 program-cards가 아직 DOM에 없을 수 있음. ISR 캐시 히트 시 빠르지만, 캐시 미스 또는 첫 방문 시 데이터 fetch 시간이 추가됨 | 중 | drive() 호출 전 요소 존재 여부를 polling 방식으로 확인 (예: 최대 3초간 100ms 간격 체크 후 drive()) |
| 2 | Phase 2/3에서 큰 요소(program-cards, schedule-grid) 하이라이트 시 smoothScroll 미설정 | Phase 2, 3 | Phase 2 runPhase2의 driver 인스턴스와 Phase 3 runPhase3의 driver 인스턴스에 smoothScroll 옵션이 없음 (기본값 true). 이 요소들은 페이지 하단에 위치할 수 있는데, smoothScroll:true(기본값)가 적용되어 스크롤이 발생함. scratchpad 461줄 주석에 "큰 요소는 스크롤 필요할 수 있으므로 미적용"이라고 의도적 결정이 기록되어 있으나, sticky 헤더(약 60px)가 스크롤 후 요소 위를 가릴 수 있음 | 낮 | popover의 side:"bottom"/"top" 위치가 sticky 헤더에 가려지는지 실제 브라우저 테스트 필요. 필요 시 popoverOffset 조정 |
| 3 | schedule-grid가 데이터 없으면 렌더링되지 않음 | Phase 3 | ScheduleClient.tsx 116~125행: `!hasData`이면 "시간표를 준비 중입니다" 안내만 표시되고 `data-tour-target="schedule-grid"` 요소가 DOM에 없음. Google Sheets 데이터 fetch 실패, 설정 미완료, ISR 캐시 미스 + API 타임아웃 등의 상황에서 driver.js가 요소를 찾지 못하고 조용히 실패함 | 높 | 요소를 못 찾으면 해당 Phase를 스킵하고 다음 Phase로 자동 진행하는 fallback 로직 추가 |
| 4 | schedule-grid의 popover side:"top" 이 viewport 밖에 표시될 수 있음 | Phase 3 | schedule-grid는 매우 큰 요소(전체 시간표). side:"top"이면 popover가 요소 위에 표시되는데, 스크롤 위치에 따라 popover가 viewport 상단 밖으로 벗어날 수 있음. smoothScroll이 기본값(true)이라 요소 상단으로 스크롤되지만, sticky 헤더(~60px) 아래로 popover가 가려질 수 있음 | 중 | side를 "bottom"으로 변경하거나, popoverOffset으로 sticky 헤더 높이만큼 보정 |
| 5 | driver.js 기본 "Done" 버튼 텍스트가 영어로 나올 수 있음 | Phase 4 | Phase 4에서 doneBtnText:"시작할게요!"가 설정되어 있지만, showButtons에 "next"가 포함되어 있음. driver.js에서 단일 스텝일 때 "next" 버튼이 "Done" 텍스트로 표시되는데, 이때 doneBtnText가 적용됨. 그러나 Phase 2/3에서는 nextBtnText:"확인했어요"와 doneBtnText:"확인했어요"가 설정되어 있어 정상. 다만 Phase 1/highlightScheduleNav/highlightSimulatorNav에서는 doneBtnText/nextBtnText가 미설정 -- 이 Phase들은 showButtons:["close"]만 사용하므로 "next"/"done" 버튼이 표시되지 않아 문제 없음 | 낮 | 현재 코드에서는 영어 버튼이 노출되는 경우 없음. 단, 향후 showButtons 변경 시 주의 필요 |
| 6 | Phase 2 allowClose:false인데 X 버튼이 표시됨 | Phase 2, 3 | Phase 2/3에서 allowClose:false로 설정했지만, showButtons에 "close"가 포함되어 있음 (showButtons: ["close", "next"]). allowClose:false는 오버레이 클릭으로 닫기를 방지하지만, X 버튼(showButtons의 "close")은 여전히 표시됨. 이것이 의도된 동작인지 확인 필요 -- 사용자가 X 버튼으로 닫으면 onDestroyed가 호출되어 다음 Phase로 진행됨 | 낮 | 의도된 동작이라면 OK. 만약 "확인했어요" 버튼만 허용하려면 showButtons: ["next"]로 변경 |
| 7 | 모바일에서 사이드바 닫힘 이벤트와 투어 충돌 가능 | Phase 1 모바일 | PublicHeader의 사이드바 링크에 `onClick={() => setIsMobileMenuOpen(false)}`가 있음. 사용자가 mobile-nav-programs를 클릭하면: (1) setupLinkCapture의 capture handler가 먼저 실행 -> e.preventDefault()+stopPropagation (2) 그러나 React의 onClick(사이드바 닫기)은 합성 이벤트이므로 capture phase DOM 리스너와 별도로 실행될 수 있음. 사이드바가 닫히면서 동시에 router.push가 발생하면, 사이드바 닫힘 애니메이션(300ms)과 페이지 전환이 겹칠 수 있음 | 중 | 실제 브라우저에서 모바일 테스트 필요. 사이드바 닫힘과 페이지 이동이 시각적으로 부자연스러운지 확인 |
| 8 | loadDriver() 3회 반복 호출 (driver.js 캐시 미보장) | 전체 | 각 Phase마다 loadDriver()를 호출하여 dynamic import 3개를 실행. 브라우저의 모듈 캐시가 있으므로 2회차부터는 빠르지만, 첫 Phase의 loadDriver()에서 네트워크 지연이 발생하면 drive() 호출까지 지연됨. 특히 3G 등 느린 네트워크에서 driver.js(~5KB) + driver.css + tourStyles.css 총 3파일 fetch가 필요 | 낮 | 현재 구조로는 큰 문제 아님. 필요시 prefetch 힌트 추가 가능 |

---

종합: 15개 항목 중 10개 통과 / 5개 주의(WARNING)
주요 문제 8건 발견 (높음 1건, 중간 3건, 낮음 4건)

**높음 우선 수정**: 문제 #3 (schedule-grid 미존재 시 투어 실패)
**중간 우선 수정**: 문제 #1 (program-cards 렌더링 대기), #4 (popover 위치), #7 (모바일 사이드바 충돌)

#### 수정 요청

| 요청자 | 파일 | 문제 설명 | 상태 |
|--------|------|----------|------|
| tester | GuideTourTrigger.tsx | #3: 요소 미존재 시 fallback 로직 필요 (Phase 스킵 -> 다음 Phase 진행) | 완료 |
| tester | GuideTourTrigger.tsx | #1: drive() 호출 전 요소 존재 polling 추가 (Phase 2/3/4) | 완료 |
| tester | GuideTourTrigger.tsx | #4: Phase 3 schedule-grid popover side:"top" -> "bottom" 또는 popoverOffset 조정 | 완료 |

---

## 작업 로그 (최근 10건)

| 날짜 | 작업 내용 | 파일 | 상태 |
|------|----------|------|------|
| 2026-03-26 | 투어 UX 개선 5건 구현 (B-1 스크롤충돌, B-2 Link충돌, 진행률, 완료토스트, 중단재개) | GuideTourTrigger.tsx, tourStyles.css | 구현완료 |
| 2026-03-26 | 투어 UX 개선 계획 + 위치 버그 3건 특정 (sticky헤더/Link충돌/사이드바타이밍) | GuideTourTrigger.tsx, PublicHeader.tsx | 분석완료 |
| 2026-03-26 | 입학 가이드 투어 v2 구현 (driver.js, 4phase, 16파일 변경) | guide-tour/ + 각 페이지 | 구현완료 |
| 2026-03-26 | 입학 가이드 투어 v2 재기획 (driver.js 채택, 6스텝/4phase, 작은요소만) | guide-tour/ | 재기획완료 |
| 2026-03-26 | 입학 가이드 투어 v1 구현 시도 5회 실패 (box-shadow/z-index/4-div 방식 모두 실패) | GuideTourOverlay.tsx | 실패-폐기 |
| 2026-03-26 | admin 속도 최적화 전체 완료 (구현+tester+reviewer 통과) | page.tsx, queries.ts, schedule/page.tsx | 완료 |
| 2026-03-22 | 최적화 3건 (폰트/MergedSlot/middleware) | layout.tsx, fonts.ts, mergeSlots.ts, middleware.ts | 완료 |
| 2026-03-22 | 앱 최적화 4건 (OG/sitemap/robots/error/API인증) | layout.tsx, sitemap.ts, robots.ts, error.tsx | 완료 |
| 2026-03-22 | 시뮬레이터 + 관리자 최적화 (구현/테스트/리뷰 전체 통과) | simulator/ + admin/ | 완료 |
| 2026-03-22 | 챗봇 종합 개선 (분류체계/프롬프트/데이터소스/UI/버튼) | route.ts + ChatMessage/Panel.tsx | 완료 |

---

## 프로젝트 현황 요약
- **완료된 Phase**: 초기 ~ Phase 10 (총 10단계 + 보안패치)
- **릴리즈 기능 커버율**: 약 85%
- **남은 기능**: 모바일 결제(상) -- 보류, 입학 가이드 투어 -- v2 재기획 완료
- **개발서버**: localhost:4000 (포트 변경됨)
- **프로덕션 배포**: stiz-dasan.kr (Vercel) -- 2026-03-21 최신 푸시 완료

### 대기 중인 작업
1. **입학 가이드 투어 v2**: 재기획 완료. developer 실행 대기. (기존 파일 삭제 후 재구현, 약 80분)
2. **엑셀 업로드 일괄 등록**: planner 계획 수립 완료 (7단계, 약 70분). 사용자 결정 대기.
