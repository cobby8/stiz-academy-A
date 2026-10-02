# 작업 스크래치패드

## 현재 작업
- **상태(2026-08-09)**: PWA 4앱 설치 문제 해결 완료(실기기 검증). 앱 아이콘 개편 배포. UI 전수 점검은 "남은 일" 목록만 대기.
- **미푸시 커밋 0개** — 전부 푸시됨.
- **현재 담당**: pm
- **마지막 세션**: 2026-08-09
- **테스트 기준선 갱신**: **973건 중 실패 9건**(아래 40번 줄의 858은 옛 수치)

## UI 전수 점검 — 남은 일 (다음 세션 이어서)
조사 보고서 6종은 세션 임시 폴더에 있어 **사라질 수 있음**. 핵심만 여기 옮겨 둔다.

- **기능/UI 제거 — 주요 항목은 처리 완료**(2026-08-06). 남은 것:
  · `상태 직접 변경` 셀렉트(4버튼과 중복이나 **PENDING 되돌리기는 셀렉트에만 있음** — 제거 시 기능 손실. 되돌리기를 쓰는지 확인 필요)
  · 이관 화면의 CSV 붙여넣기 경로(구글시트 직접 가져오기가 상위호환인 레거시 이중 경로)
  · 공지 → 소셜 발행의 "페이스북 광고 소재" 섹션(광고를 실제로 집행하는지)
  · 갤러리 "인스타 가져오기"(등록 경로가 3중)
  · 설정 화면 `AppliesTo` 파란 뱃지 9곳(실무에 쓰이는지 시각 소음인지)
  · 시설 사진·프로그램 이미지의 URL 수기 입력(다른 이미지는 전부 파일 업로드인데 여기만 URL)
- ✅ (해소 2026-10-02) 정규 셔틀 시트 방식 → 「셔틀 명단」 탭에서 앱이 RegularShuttleStop 을 직접 편집. 기사 화면·결석 매칭은 같은 테이블을 그대로 읽는다. 시트 가져오기 API 는 410 으로 종료.
- 리포트 편집 화면 vs `SessionLogModal` — 같은 Session 레코드를 편집하는 화면이 둘(확인 필요)
- **남은 판단거리 (작은 것)**
  · 설정 화면 "외부 신청 링크"(구글폼 주소) 칸이 이제 공개 사이트에 무영향 — 칸 제거 or 점검 항목 정리
  · `lib/siteOpsBot.ts` 의 체험/수강 신청 점검이 항상 ok 가 됨 — 단순화 or 삭제
  · 스킬 "평가자" 자유 입력 → 로그인 사용자 자동 기입(서버 `skills/page.tsx` 2줄 + prop 1개 필요)
- **테스트가 문구·코드 존재를 단정해 못 건드린 것** (지우려면 테스트 동반 수정 필요):
  · ~~`ShuttleRouteAdminClient.tsx`~~ — 2026-10-02 3단계 정리에서 삭제, 그 화면을 읽던 tests 7개는 서버·API 단정만 남김
  · 신청관리 문구 2건, 방학특강 문구 2건
- ⚠️ **다중 에이전트 동시 작업 중 `git stash` 금지.** 이번에 한 에이전트가 baseline 측정용으로 실행해 다른 4개의 미저장 변경 46파일을 함께 치웠고 pop이 충돌했다. baseline이 필요하면 `git show HEAD:<파일>`로 개별 조회할 것.

## ⚠️ 배포 메커니즘(중요)
- Vercel 빌드는 `prisma generate && next build`뿐 — **`migrate deploy` 자동 실행 안 됨**. 스키마 변경은 **멱등 SQL을 운영 Supabase(ref gpjdtkumqxzfgkixjamp)에 직접 적용**(Supabase MCP apply_migration). 마이그레이션 폴더는 기록용.
- 운영 배포 = `git push origin HEAD:main` fast-forward.
- 테스트는 `node --test tests/*.test.mjs`. **`npx vitest`는 이 프로젝트에 없음**(설정도 없어 worktree까지 긁어 전부 오탐).
- 현재 테스트 기준선: **858건 중 실패 9건**(체험신청 폼·셔틀 좌석/주소·청구 안내 등 기존 실패). 신규 실패 판정은 이 집합과 비교할 것.

## 진행 현황
| 항목 | 상태 |
|------|------|
| 관리자·선생님 UI 전수조사(6영역 병렬) | 완료 — 문구 140·기능 46·보존 144·확인필요 61 |
| 선생님 화면 문구 정리 + 설치배너 제거 | 완료·커밋 |
| 관리자 문구 106건 정리 | 완료·커밋 |
| 도달 불가 라우트·미사용 심볼 제거 | 완료·커밋 |
| 수강신청 "수정" 버튼 복구(진입점 유실) | 완료·커밋 |
| 원생목록 7월 하드코딩 수정 | 완료·커밋 |
| 보강 잔여석 실제 계산 + 정원 초과 차단 | 완료·커밋 |
| 수업 리포트 사진 깨짐 수정 | 완료·커밋 |
| UI 기능/UI 제거 46건 | 대기(원장 확인 필요 항목 다수) |
| 셔틀 확정 명단 4~5단계(변동 감지·재발 방지 가드) | 대기 |
| 4b 시즌 격리 / 4c 추가 확정 / 4d 변동 배지 | 대기 |
| 정규반 형제할인 자동화 | 대기(시트 수동 10% 이중적용 위험 확인 필요) |
| 미푸시 커밋 | **13개** |

## 미해결 리뷰 수정 사항 (이월)
| 번호 | 파일 | 심각도 | 내용 |
|------|------|--------|------|
| R-1 | api/admin/trial-count/route.ts | 필수 | 인증 가드 추가 |
| R-2 | actions/public.ts | 권장 | source/referralSource 서버 화이트리스트 검증 |
| R-3 | actions/public.ts:353 | 권장 | shuttleNeeded: `\|\|` → `??` 변경 |
| R-7② | lib/seasonal/shuttleRoster.ts:166~176 | 권장 | 다음 시즌 신청자가 목록·확정 버튼에서 사라짐(시즌 스코프 전체 합산) |
| R-8② | admin/seasonal/shuttle/ShuttleRosterClient.tsx | 권장 | 제외 되돌리기가 세션 한정(새로고침 시 복구 UI 소멸) |
| M-1 | actions/admin.ts `bookMakeupSession` | 참고 | 정원 검증이 "조회 후 INSERT"라 극단적 동시 요청에선 이론상 1건 초과 가능(DB 제약 아님) |

---

## 구현 기록 (developer) — 토스POS ↔ 사이트 결제 월별 대사 (2026-09-18)

(완료·커밋됨 — 상세는 git log 참조: 5a9a793·ddbd479·eae8b702·522c913d·fa52192e 및 이번 슬랙 DM 커밋)
- 핵심 규칙: 청구 원본=랠리즈(전달 3주차 발행), 사이트는 따라가는 기록. 대사는 읽기 전용, 돈 쓰기는 슬랙 [랠리즈 처리함 · 사이트 납부 반영] 버튼→재확인 선점 UPDATE→markPaymentPaid 한 경로뿐.
- 매칭 로직 1벌: src/lib/pos/tossplace-match.mjs / 판단: payment-notice.mjs / 서명: webhookSignature.ts·slack/signature.ts

## 구현 기록 (developer) — 셔틀 관리 3단계 정리 (2026-10-02)

📝 옛 노선 편성 화면 삭제 · 시트 가져오기 API 410 차단 · 시트 전용 함수/파서 제거 · 시트 관련 주석·문구를 「셔틀 명단」 기준으로. 로직·스키마 변경 없음.

| 파일 | 변경 | 신규/수정 |
|---|---|---|
| src/app/admin/shuttle/ShuttleRouteAdminClient.tsx · .test.ts | 삭제(어디서도 import 안 함) | 삭제 |
| src/app/api/admin/shuttle/regular-import/route.ts | POST → 410 「구글 시트 가져오기는 종료됐습니다…」, DB 접근 없음 | 수정 |
| src/lib/shuttle/regularImport.ts | importRegularShuttleFromSheet·toCsvExportUrl·reconcile/키 헬퍼 제거(조회·좌표·순서 저장 유지) | 수정 |
| src/lib/shuttle/regularSheet.ts | CSV 파서 제거, 타입 RegularShuttleStop 만 | 수정 |
| regular-dispatch/page.tsx·RegularDispatchClient.tsx(안내 문구 1)·regularDriverRoute(Logic)·unifiedDriverRun·RegularDriverClient·shuttleRoster(Logic)·shuttle-dispatch·parent-shuttle-exception·StudentDetailClient·shuttle/page.tsx | 주석·문구만 「셔틀 명단」 기준으로 | 수정 |
| tests 9개(coordinate-links·location-picker-admin-ux·shuttle-class-based-candidates·shuttle-driver-assignment·shuttle-preferred-vs-confirmed-time·shuttle-ride-status·tmap-route-optimization·regular-shuttle-data-safety·regular-shuttle-month-diff) | 옛 화면 단정 제거, 410 차단·명단 삭제 범위 단정으로 교체 | 수정 |

💡 tester: tsc 0 · 단위 121 중 실패 1(contracts legacy text-only, 기준선) · tests 1756 중 실패 1(POS 매칭 한 벌, 기준선). 화면 렌더 금지(운영 DB).
⚠️ reviewer: 관리자 화면에서 DriverLocationPanel·DriverRequestPanel(기사 실시간 위치·기사 요청 처리) 진입점이 사라진 상태 — 파일은 남김, PM 판단 대기.

## 구현 기록 (developer) — 「셔틀 명단 = 기사님 화면」 (2026-10-02)

📝 셔틀 명단에 「기사님 화면(운행 순서)」 보기 + 정차 단위 순서·시각 저장, 명단 점검 경고, 저장 노선 운행 표시, 정규 배차 저장 경고. 스키마 변경 없음.

| 파일 | 변경 | 신규/수정 |
|---|---|---|
| src/lib/shuttle/regularDriverRouteLogic.ts | `selectDriverDayRows`(요일 학생행 고르기·정렬) 추가 — 기사 화면·관리자 보기 공용 | 수정 |
| src/lib/shuttle/regularDriverRoute.ts | 같은 필터를 `selectDriverDayRows` 호출로 교체(동작 동일) | 수정 |
| src/lib/shuttle/regularRosterEditLogic.ts | reorder 검증·슬롯 재배정·이후 달 대응 행 반영 순수 함수 | 수정 |
| src/lib/shuttle/regularRosterCheckLogic.ts (+test) | 명단 점검 5종(중복·등원 늦음·하원 이른·수업시간 없음·같은 정류장 다른 시각) | 신규 |
| src/lib/shuttle/regularRosterEdit.ts | `reorderRosterStops`(lock·audit REGULAR_ROSTER_REORDER) · `getRegularRouteStatus`(조회 전용) | 수정 |
| src/app/api/admin/shuttle/regular-roster/route.ts | PATCH action:"reorder", GET ?routeStatus=1 | 수정 |
| src/app/admin/shuttle/regular/DriverOrderView.tsx | 기사님 화면 보기(buildFallbackClasses 재사용, ↑↓·time·칸별 저장·저장 안 됨) | 신규 |
| src/app/admin/shuttle/regular/RegularShuttleClient.tsx | 보기 전환·점검 접이식·저장 노선 표시·추가 안내·이탈 확인 | 수정 |
| regular-dispatch/RegularDispatchClient.tsx · components/seasonal/RouteSection.tsx | 경고 배너 · 정규 모드 첫 저장(저장본 없음) confirm | 수정 |
| tests/regular-roster-driver-view.test.mjs · regular-shuttle-auto-month.test.mjs | 가드·왕복 테스트 신규 / 편집 4종→5종 | 신규/수정 |

💡 tester: tsc 0 · 단위 133 중 실패 1(contracts legacy, 기준선) · tests 1760 중 실패 1(매칭 한 벌, 기준선). 화면 렌더 금지(운영 DB).
⚠️ reviewer: 슬롯 재배정 시 겹친 번호를 +1 로 벌림(다른 칸 번호와 동률 가능, 칸 내부 순서엔 무해) · 순서 편집 classTime 은 글자 그대로 비교(기사 화면 섹션 키와 동일).

### 리뷰 결과 (reviewer) — 셔틀 명단 = 기사님 화면

📊 종합 판정: 통과 (필수 수정 없음, 권장 4건)
✅ 기사님 화면 회귀 0 — selectDriverDayRows 는 옛 filter·sort 와 글자 단위 동일. 슬롯 재배정은 칸 안 순서만 바꾸고(섹션=수업·방향별 groupSheetStops) 정차 블록이 연속 번호라 '처음 나온 위치' 규칙과 일치. 서버 행 집합 일치 검증·lockForEdit·감사로그·$n 바인딩·requireAdmin 이중 가드 OK. RouteSection 경고는 regularEditing 안이라 방학특강 무영향. tsc 0 · 관련 테스트 46/46 · KST 가드 6/6.
🔴 필수: 없음
🟡 권장:
- DriverOrderView.tsx:105 — arriveTime 원문 그대로 전송. 기존 행 시각이 HH:MM 이 아니면(예 '16시40분'·'-') 화면은 빈칸인데 칸 전체 저장이 "도착시각은 17:05 처럼" 오류로 막힘 → 점검 로직에 '시각 형식 이상' 경고 추가 또는 오류 문구에 정류장명.
- regularRosterEdit.ts reorder 감사로그 — 이후 달 행의 변경 전 sortOrder·arriveTime 미기록(되돌림 정보 부족).
- regularRosterCheckLogic.ts:80 — 칸 키를 trim 한 classTime 으로 묶음(기사 화면은 원문). 끝 공백만 다른 행이 한 칸으로 합쳐져 '한 정차로 합쳐짐' 문구가 틀릴 수 있음. 공백만 다른 수업시간(섹션 분리) 자체를 경고하면 더 유용.
- RegularDispatchClient.tsx:91 — 배너가 고정 문구라 이미 저장 노선으로 운행 중인 요일에도 "셔틀 명단 순서로 운행 중"이라 표시(사실과 다름). RegularShuttleClient 의 routeStatus null(로딩·실패) 시 추가 안내 둘 다 숨음 — 경미.

## 작업 로그 (최근 10건)

| 날짜 | 작업 내용 | 상태 |
|------|----------|------|
| 2026-10-02 | **셔틀 명단 = 기사님 화면 리뷰(reviewer)** — 통과. 기사 화면 회귀 0(필터·정렬 동일), reorder 칸 밖 순서 무영향. 권장 4(비정형 시각 저장 막힘·이후 달 감사 before·점검 trim 키·배너 고정 문구) | 통과 |
| 2026-10-02 | **셔틀 명단 = 기사님 화면(developer)** — 기사님 화면 보기(같은 순수 함수)·정차 순서·시각 저장(reorder)·명단 점검·저장 노선 표시·정규 배차 저장 경고. tsc 0·기준선 실패 2건만. 미커밋 | 검수 대기 |
| 2026-10-02 | **셔틀 관리 3단계 정리(developer)** — 옛 노선 편성 화면 삭제, 시트 가져오기 API 410, 시트 가져오기 함수·CSV 파서 제거, 시트 주석·문구 정리, 테스트 9개 갱신. tsc 0·기준선 실패 2건만. 미커밋 | 검수 대기 |
| 2026-10-02 | **셔틀 명단 월 자동 생성(developer·reviewer)** — 이번 달·다음 달 자동 보장(크론 KST 00:05·화면 진입), 저장 노선 복사, 편집 4종 적용 범위. 리뷰 높음1·권장3 수정(따라잡기 생성 시 탑승체크·기사요청 id 이전, 전화 없는 동명이인 미묶음, 지난 달 기본 THIS_MONTH) | 커밋 146e0cee |
| 2026-10-02 | **정규 배차 편집 강화 2단계(developer·reviewer)** — 정차·학생 차량 간 이동·빼기·정원 경고·저장 안 됨/이탈 경고(regularEditing 로만). 리뷰 중간2·낮음3 수정(월 전환 재로딩·저장 중 편집 보존·회차 시간 확인) | 커밋 146e0cee |
| 2026-10-02 | **셔틀 명단 앱 편집 1단계(developer·tester·reviewer)** — 시트 탭을 「셔틀 명단」 화면으로 교체(추가·빼기·반이동·정류장 수정, ShuttleAuditLog). tester 7/7, 리뷰 높음1·권장3 수정(기사 화면 월 고정 pickServiceMonthFor 등) | 커밋 5b9c2bb8 |
| 2026-10-02 | **토스 심사 주문서 리뷰(reviewer)** — 통과. DB 쓰기·청구서 접근 0, 금액은 서버 DB 가격, v2 필드명 일치. 권장만: 안내 화면 HTTP 200 | 통과 |
| 2026-10-02 | **토스 심사 주문서** — `/programs/order` 신설, 결제창 코드 `lib/payments/tossReviewClient.ts` 한 벌, 공개 /programs 0원 프로그램 숨김. 테스트 13/13·tsc 통과 | 커밋 77232fcf |
