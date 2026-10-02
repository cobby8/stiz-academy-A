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
- 🚨 **정규 셔틀 시트 방식은 지우면 안 된다 (2026-08-06 확인)**
  원장은 "정규 배차(신청서 좌표)만 쓴다"고 답했지만, **구버전(시트 방식)이 기사 앱을 떠받치고 있다.**
  · `/driver/[token]`·`/shuttle/regular/[token]` 기사 운행 화면이 `getRegularShuttleStops()`(시트 명단)를 직접 읽음
  · 결석→셔틀 자동 제외 매칭(`lib/regular/regularAbsenceMatch.ts`)도 시트 명단 기준
  · **"🚌 기사님 운행 링크 복사" 버튼이 시트 방식 화면에만 있다.** 정규 배차 화면에는 기사 링크가 아예 없음(버튼이 요일 선택 하나뿐)
  → 시트 방식을 지우면 정규 셔틀 기사님이 명단을 못 받는다. **원장에게 "기사님이 지금 어떤 링크로 보시는지" 확인 대기 중.**
  → 통합하려면 정규 배차 쪽에 기사 링크 발급 + 기사 앱 데이터 소스 전환이 필요한 **기획 작업**이다.
- 리포트 편집 화면 vs `SessionLogModal` — 같은 Session 레코드를 편집하는 화면이 둘(확인 필요)
- **남은 판단거리 (작은 것)**
  · 설정 화면 "외부 신청 링크"(구글폼 주소) 칸이 이제 공개 사이트에 무영향 — 칸 제거 or 점검 항목 정리
  · `lib/siteOpsBot.ts` 의 체험/수강 신청 점검이 항상 ok 가 됨 — 단순화 or 삭제
  · 스킬 "평가자" 자유 입력 → 로그인 사용자 자동 기입(서버 `skills/page.tsx` 2줄 + prop 1개 필요)
- **테스트가 문구·코드 존재를 단정해 못 건드린 것** (지우려면 테스트 동반 수정 필요):
  · `ShuttleRouteAdminClient.tsx` 633줄 — tests/ 7개 파일이 소스를 텍스트로 읽음. **원장 결정: 그대로 둔다**(빌드 미포함이라 무해)
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

## 구현 기록 (developer) — 셔틀 명단 앱 편집 1단계 (2026-10-02)

구현한 기능: 「정규 셔틀(시트)」 탭을 「셔틀 명단」 화면으로 교체. RegularShuttleStop 을 앱이 직접 편집(추가·빼기·반이동·정류장 수정·다음 달 복사). 스키마 변경 없음.

| 파일 경로 | 변경 내용 | 신규/수정 |
|----------|----------|----------|
| src/lib/shuttle/regularRosterEditLogic.ts | 입력 검증·행 생성·화면 묶음 순수 함수 | 신규 |
| src/lib/shuttle/regularRosterEditLogic.test.ts | node:test 11건 | 신규 |
| src/lib/shuttle/regularRosterEdit.ts | 서버 편집(raw SQL·트랜잭션·달 단위 advisory lock·ShuttleAuditLog 기록)·학생 검색 | 신규 |
| src/app/api/admin/shuttle/regular-roster/route.ts | GET 검색/POST add·copyMonth/PATCH move·editStop/DELETE 빼기 | 신규 |
| src/app/admin/shuttle/regular/page.tsx · RegularShuttleClient.tsx | 명단 화면으로 교체(시트·좌표자동·배차지도·월비교/문자 UI 제거, 위치링크·기사링크 유지) | 수정 |
| src/app/admin/shuttle/ShuttleSectionTabs.tsx | 라벨 「셔틀 명단」·아이콘 groups | 수정 |
| tests/regular-shuttle-admin-ui.test.mjs · regular-shuttle-month-diff.test.mjs | 제거된 UI 단정 3건 → 새 화면 계약 단정으로 교체 | 수정 |

tester 참고:
- 테스트 방법: /admin/shuttle/regular → 학생 추가(검색·요일 복수·등원만/하원만) → 반이동 → 정류장 수정(전체 적용 체크) → 빼기(요일만/전체) → 다음 달 명단 만들기(대상 달 있으면 거부 메시지)
- 정상 동작: 저장 후 목록 갱신 + 「정규 배차로 가기」 안내 표시. 좌표 없는 정류장은 ⚠ 좌표 없음
- 주의할 입력: 같은 요일·방향·수업 중복 추가(거부), 도착시각 "24:00"/"오후5시"(거부), 대상 달이 이미 있는 복사(거부)
- 실행: `node --test src/lib/shuttle/*.test.ts src/lib/regular/*.test.ts` (vitest 없음)

reviewer 참고:
- 새 행 sortOrder = 그 요일·방향·수업 max+1 (뒤 행과 번호 동률 가능, 정렬만 동률)
- editStop applyToAll 은 같은 달 같은 stopName 전체(PIVOT·RETURN 운영 정차 포함)의 이름·좌표를 바꾼다. 도착시각은 해당 행만
- 빼기는 BOARD/ALIGHT 행만, 요청 id 수와 삭제 수가 다르면 전체 롤백

## 테스트 결과 (tester) — 셔틀 명단 앱 편집 1단계 (2026-10-02, 읽기 전용)

| 테스트 항목 | 결과 | 비고 |
|-----------|------|------|
| `npx tsc --noEmit` | ✅ 통과 | 오류 0 |
| `node --test src/lib/shuttle/*.test.ts src/lib/regular/*.test.ts` | ✅ 통과 | 57/57 |
| `node --test tests/regular-shuttle-*.test.mjs` | ✅ 통과 | 48/48 |
| 경계 스크래치 테스트(월 형식·요일 0~6·빈 수업시간·도착시각·좌표 한쪽만·12월→다음 해 1월·ids 100/101개·같은 달 복사) | ✅ 통과 | 8건, 임시 파일 삭제 완료 |
| 첫 화면 달 선택(`months` DESC + `find(m<=현재)`) | ✅ 통과 | 이번 달 이하 중 최신 달 |
| 탭 라벨 「셔틀 명단」·아이콘 groups | ✅ 통과 | 소스 확인 |
| 비로그인 접근 차단 | ✅ 통과 | 페이지 307→/login, GET API 403 |
| 화면 렌더·모달 확인 | ⏭ 생략 | 관리자 로그인 필요(계정 없음). 4000 서버는 타 세션 것(PID 40356)이라 종료 안 함 |

관찰(실패 아님): `buildMoveUpdates` 는 서로 다른 학생의 BOARD+ALIGHT 두 행을 한 번에 옮기는 것도 허용(화면은 한 학생 행만 보내므로 API 직접 호출 시만 해당).

📊 종합: 7개 중 7개 통과 / 0개 실패 (화면 확인 1건 생략)

## 리뷰 결과 (reviewer) — 셔틀 명단 1단계: 높음 1(기사 화면 월 고정)·권장 3 → developer 수정 4건 완료(작업 로그 참조)

## 리뷰 결과 (reviewer) — 셔틀 명단 월 자동 생성 + 적용 범위 (2026-10-02)

📊 종합 판정: 수정 필요 (높음 1 — 배포 당일 기사님 탑승체크 어긋남)

✅ 잘된 점: 복사 CTE 정확(gen_random_uuid 휘발성+두 번 참조 → materialize, 쓰기 CTE 1회 실행, 옛→새 짝 일치). remapStopRowIds 는 값 전체 일치만 치환(부분일치 없음). 멱등(잠금 후 대상 달 COUNT 재확인, READ COMMITTED 새 스냅샷). 잠금 순서(전체→달 오름차순) 일관·THIS_MONTH 는 단일 잠금이라 교착 없음. 평시 화면 진입 비용 = DISTINCT 1쿼리. 크론 인증 makeup-credits 와 동일, 15:05 UTC=KST 00:05. 편집 4종 한 트랜잭션·requireAdmin·파라미터 바인딩·KST 금지패턴 없음. 테스트 node 6/6·로직 20/20.

🔴 필수 수정:
- regularRosterEdit.ts:363 copyMonthInTx (+ensure 433) — 오늘(10-02) 기사 화면은 09 명단을 봄(10 없음). 배포 후 누가 화면만 열어도 10월이 생성되며 기사 화면이 10월 새 행 id 로 전환 → 10-01·10-02 에 찍힌 ShuttleBoarding(direction='REGULAR', shuttleRequestId=옛 09 행 id)이 미체크로 보임. 수정: 복사 대상 달 ≤ 이번 달(따라잡기 생성)일 때 같은 tx 에서 그 달 날짜의 REGULAR 탑승체크 shuttleRequestId 를 pairs 로 옛→새 갱신(serviceDate 'YYYY-MM-01' 이상 다음 달 1일 미만). 또는 운영: 마지막 운행 뒤 배포+크론 수동 1회 실행.

🟡 권장 수정:
- regularRosterEditLogic.ts:375 resolver — 학부모 전화 둘 다 없으면 끝4자리 ""로 같아져, 동명이인(studentId 있는 학생 1명 + 이름만 행)이 한 학생으로 묶임 → 「전체 빼기」에 남의 행 포함. 끝4자리 빈 값이면 묶지 말 것. isSameRosterStudent(:399)도 동일(이후 달 대응 행 오매칭).
- lockForEdit 기본 FROM_THIS_MONTH — 지난 달(08) 수정도 09·10·11로 전파. 지난 달이면 기본값 THIS_MONTH 권장(문구엔 표시됨).
- moveRosterRows 감사 로그에 이후 달 옮긴 행 id 없음(remove 는 laterRows 기록). 맞추면 좋음.
- (기존) importRegularShuttleFromSheet 는 advisory lock 미사용 — 시트 가져오기를 계속 쓰면 편집·복사와 경합.

## 리뷰 결과 (reviewer) — 정규 배차 편집 강화 2단계 (2026-10-02)

📊 종합 판정: 수정 필요 (중간 2 — 데이터 손실·엉뚱한 달 저장 가능)

✅ 잘된 점: 방학특강 회귀 없음(새 UI·확인창·beforeunload 전부 `regularEditing` 가드, onDirtyChange 미전달 시 no-op, DispatchClient 무변). 순수 모듈 깊은 복사·빈 정차 제거·거점 유지·etaManual 해제 정확, 차량 수 불변이라 mapVehicle/reroute 인덱스 안전. 저장 검증(requestId 중복)·기사 화면(빈 정차·빈 차량 섹션 생략) 호환. tsc 0, 신규 테스트 12/12. contracts.test "legacy text-only…" 실패는 HEAD 워크트리에서도 동일 = 기존 실패.

🔴 필수 수정:
- RegularDispatchClient.tsx:83 + RouteSection.tsx:233 — 월 변경(router.push)은 컴포넌트를 다시 만들지 않고 RouteSection 재조회 deps 가 [date, refreshKey] 뿐이라, 새 달로 바꿔도 세부 조정엔 옛 달 노선+dirty 가 남고 💾 저장 시 serviceMonth=새 달로 옛 달 노선을 덮어씀(기존 결함이나 이번에 기본 펼침+"이동하면 사라집니다" 문구로 노출↑). 수정: RegularDispatchClient 에서 `refreshKey={months.indexOf(serviceMonth)}` 처럼 월마다 바뀌는 값을 넘겨 switchTo 재실행(방학특강 무영향).
- RouteSection.tsx:255 saveRoute — 저장 요청 중(약 1초) 이동·빼기를 하면 응답 후 setDirty(false) 로 미저장 편집이 「저장됨」 처리 → 배지·이탈 경고·전환 확인 모두 꺼져 조용히 사라짐. 수정: editSeq ref 를 편집마다 +1, 저장 시작 값과 같을 때만 setDirty(false) (또는 saving/loading 중 편집 컨트롤 disabled).

🟡 권장 수정:
- RouteSection.tsx:331 applyRouteEdit — sugRef(렌더 시점 값)+객체형 setSug. 대기 중인 updater(재경로·저장본 불러오기)가 있으면 덮어씀(08-03 사고와 같은 계열, 확률 낮음). touched 는 [vIdx,toV] 로 미리 알 수 있으니 `setSug(prev => …)` 안에서 계산 권장.
- removeStudent × 안내 문구 — 시트/명단에 남은 학생은 기사 화면 「확정 전」(leftoverRows) 섹션에 그대로 뜸. 문구에 명시 권장.
- 학생·정차 이동 메뉴가 다른 수업시간 회차도 고를 수 있음(라벨에 시각은 보임). 다른 수업시간이면 확인창 권장.
- (기존) 재경로 응답 순서 역전 시 옛 path 가 최종값이 될 수 있음 — 편집 빈도 늘어 노출↑.

## 구현 기록 (developer) — 정규 배차 편집 강화 2단계 (2026-10-02)

📝 정규 배차 손편집: 정차/학생 차량 간 이동·학생 빼기·정원 경고·모바일 ↑↓·자동 제안 확인·초기화 이름 변경·저장 안 됨/이탈 경고·세부 조정 기본 펼침. 새 기능은 `RouteSection` 의 `regularEditing`(기본 false) 로만 켬.

| 파일 | 변경 | 신규/수정 |
|---|---|---|
| src/lib/regular/regularRouteEdit.ts | 순수 계산(moveStopToVehicle·moveStudentToVehicle·removeStudentFromRoute·overCapacityVehicles·bestInsertIndex) | 신규 |
| src/lib/regular/regularRouteEdit.test.ts | node --test 8건 | 신규 |
| src/components/seasonal/RouteSection.tsx | regularEditing·onDirtyChange prop, dirty 상태, 편집 UI | 수정 |
| src/app/admin/shuttle/regular-dispatch/RegularDispatchClient.tsx | details open·regularEditing 전달·요일/월 전환 확인 | 수정 |
| tests/regular-dispatch-editing-ui.test.mjs | 방학특강 회귀 방지 + 연결 소스 테스트 4건 | 신규 |

💡 tester: 정규 배차 → 정차 「→ 차량 이동」 / 학생 옆 ⇄(정차에 2명 이상·거점일 때만)·× → 두 차량 인원·시각 갱신, 「● 저장 안 됨」, 저장 시 정원 초과면 확인창. 같은 장소(≤30m)면 합쳐짐, 무료탑승 거점은 일반 정차와 안 합침·비어도 남음. 방학특강 /admin/seasonal/dispatch 는 변화 없어야 함.
⚠️ reviewer: 학생 × 는 저장본에서만 빠짐 → 명단에 남아 있으면 다음 저장본 불러올 때 「신규·복귀」 배너로 다시 뜸(의도). 다른 차량으로 옮긴 정차의 수동 확정시각(etaManual)은 풀림.

#### 수정 이력
| 회차 | 날짜 | 수정 내용 | 수정 파일 | 사유 |
|---|---|---|---|---|
| 1차 | 2026-10-02 | 월 변경 시 refreshKey=월(숫자)로 두 방향 재로딩 + 불러오기 완료 전 저장·초기화 차단(routeReady) / editSeq 로 저장 중 편집은 「저장 안 됨」 유지 / applyRouteEdit 를 setSug updater 안 계산으로 / × 확인창에 기사님 '확정 전' 안내 / 다른 수업시간 회차 이동 확인(runTimeChange) | RouteSection.tsx, RegularDispatchClient.tsx, regularRouteEdit(.test).ts, tests/regular-dispatch-editing-ui.test.mjs | reviewer 요청 중간2·낮음3 |

## 구현 기록 (developer) — 셔틀 명단 월 자동 생성 + 적용 범위 (2026-10-02)

📝 이번 달·다음 달 명단 자동 보장(크론 매일 KST 00:05 + 셔틀 명단·정규 배차 화면 진입 시), 저장 노선 함께 복사, 편집 4종 적용 범위(기본 이후 달까지), studentId 섞인 학생 두 줄 표시 수정.

| 파일 | 변경 | 신규/수정 |
|---|---|---|
| src/lib/shuttle/regularRosterEditLogic.ts | planEnsureMonths·normalizeRosterScope·findCounterpartRows·isSameRosterStudent·rosterStudentKeyResolver·remapStopRowIds·formatRosterMonths, buildAddRows skipDuplicates | 수정 |
| src/lib/shuttle/regularRosterEdit.ts | ensureRegularRosterMonths, copyMonthInTx(노선 복사·stop:id 재매핑), lockForEdit(전체 잠금+이후 달 잠금), 편집 4종 scope·appliedMonths/skippedMonths | 수정 |
| src/app/api/cron/regular-shuttle-months/route.ts | CRON_SECRET 인증 크론 | 신규 |
| vercel.json | `5 15 * * *` 등록 | 수정 |
| src/app/admin/shuttle/regular/page.tsx · regular-dispatch/page.tsx | 진입 시 ensure(try/catch) | 수정 |
| src/app/admin/shuttle/regular/RegularShuttleClient.tsx | 모달 4종 적용 범위 라디오, "10월·11월에 반영" 문구, 「다음 달 명단 만들기」 제거(빈 달 직전 달 복사만) | 수정 |
| regularRosterEditLogic.test.ts(+8건) · tests/regular-shuttle-auto-month.test.mjs(6건) | 테스트 | 수정/신규 |

💡 tester: 화면 진입만으로 운영 DB 쓰기(10월·11월 생성)가 일어나므로 **개발서버로 화면 열지 말 것**(운영 DB 공유). 순수 테스트·tsc 로 검수. 배포 후 첫 진입 시 2026-10·2026-11 생성 + ShuttleAuditLog `REGULAR_ROSTER_AUTO_MONTH`(actorId null) 2건 확인.
⚠️ reviewer: ①copyMonthInTx 의 CTE(gen_random_uuid 를 src 에서 한 번 계산 → ins JOIN) ②잠금 순서(전체 `regular-roster:*` → 달 오름차순; THIS_MONTH 편집은 달 잠금만) ③editStop 이후 달에서 applyToAll 은 옛 정류장 이름 기준 ④반이동 이후 달 겹침은 그 달만 건너뜀.

#### 수정 이력
| 회차 | 날짜 | 수정 내용 | 수정 파일 | 사유 |
|---|---|---|---|---|
| 1차 | 2026-10-02 | 따라잡기 생성(대상 달<=이번 달) 시 그 달 날짜의 ShuttleBoarding(REGULAR)·DriverRequest(REMOVE·PENDING) 식별값을 새 행 id 로 이전(unnest 한 번, 건수 감사 기록) · 전화 끝자리 빈 값이면 이름만으로 studentId 학생에 묶지 않음 · 지난 달 편집 기본 범위 THIS_MONTH · 반이동 감사에 이후 달 행 | regularRosterEditLogic.ts·regularRosterEdit.ts·RegularShuttleClient.tsx·테스트 2 | reviewer 요청(높음1·권장3) |

## 작업 로그 (최근 10건)

| 날짜 | 작업 내용 | 상태 |
|------|----------|------|
| 2026-10-02 | **셔틀 명단 월 자동 생성 리뷰(reviewer)** — 수정 필요(높음 1): 10월 따라잡기 생성 순간 기사 화면 행 id 교체로 10-01·02 탑승체크 미표시 → 복사 시 ShuttleBoarding 재매핑 또는 운행 후 배포. 권장: 전화 없는 동명이인 묶임·지난 달 수정 전파. CTE·잠금·멱등·크론 인증 문제 없음 | 수정 요청 |
| 2026-10-02 | **정규 배차 2단계 리뷰(reviewer)** — 수정 필요(중간 2): 월 변경 시 세부 조정에 옛 달 노선이 남아 새 달로 저장됨·저장 요청 중 편집이 「저장됨」 처리. 방학특강 회귀 없음, tsc 0·테스트 12/12, contracts 실패는 HEAD 에서도 동일(기존) | 수정 요청 |
| 2026-10-02 | **셔틀 명단 월 자동 생성(developer)** — 이번 달·다음 달 자동 보장(크론 KST 00:05·화면 진입), 저장 노선 함께 복사(이름만 등록 행 stop:id 재매핑), 편집 4종 적용 범위(기본 이후 달까지)·반영 달 문구, 다음 달 만들기 버튼 제거, studentId 섞인 학생 한 줄로. tsc 0·셔틀/정규 단위 80/80·tests 60/60. 운영 DB 쓰기 0. 미커밋 | 검수 대기 |
| 2026-10-02 | **정규 배차 편집 강화 2단계(developer)** — 정차·학생 차량 간 이동, 학생 빼기(명단 안내 확인창), 정원 초과 표시·저장 전 경고, 모바일 ↑↓, 자동 제안 확인·「↺ 자동 제안으로 초기화」, 저장 안 됨 배지·beforeunload·요일/월 전환 확인, 세부 조정 기본 펼침. 모두 `regularEditing` prop 으로만 켬(방학특강 무변). 리뷰 1차 수정(월 전환 재로딩·저장 중 편집·회차 시간 확인) 반영. tsc 0·단위 118 중 실패 1(contracts.test 기존)·관련 tests 36/36. 미커밋 | 재검수 대기 |
| 2026-10-02 | **셔틀 명단 1단계 리뷰 수정 4건(developer)** — ①기사 화면 월 고정: `pickServiceMonthFor`(serviceMonth.ts·테스트 6건)로 그날 달 이하 최신 달을 명단·저장노선·탑승키에 전달, weekdayOf→kstDow ②정규 배차·셔틀 명단 기본 월 같은 함수 사용, toISOString 폴백 제거 ③정류장 수정(단일·일괄) 좌표 COALESCE 유지 ④반이동 다른 학생 섞이면 거부(rosterStudentKey). tsc 0·단위 64/64·tests 54/54. 미커밋 | 검수 대기 |
| 2026-10-02 | **셔틀 명단 1단계 리뷰(reviewer)** — 수정 필요. 높음 1: 기사 화면이 월 인자 없이 최신 월을 읽어 다음 달 명단 복사 즉시 다음 달로 전환(regularDriverRoute.ts). 권장: 정규 배차 기본 월·applyToAll 좌표 지움. SQL·권한·삭제 범위·reconcile 호환 문제 없음 | 수정 요청 |
| 2026-10-02 | **셔틀 명단 1단계 검수(tester)** — tsc 0·셔틀 단위 57/57·regular-shuttle 48/48·경계 8건 통과. 화면은 관리자 로그인 필요로 생략(비로그인 307/403 차단 확인). DB 쓰기 0 | 통과 |
| 2026-10-02 | **셔틀 명단 앱 편집 1단계(developer)** — 시트 탭을 「셔틀 명단」 화면으로 교체, RegularShuttleStop 추가·빼기·반이동·정류장 수정·다음 달 복사 API(raw SQL·ShuttleAuditLog 기록). tsc 0 / 셔틀 단위 57-0 / tests 1750 중 실패 1(기준선 동일). 미커밋 | 검수 대기 |
| 2026-10-02 | **토스 심사 주문서 리뷰(reviewer)** — 통과. DB 쓰기·청구서 접근 0, 키 없음/라이브 키 시 주문서는 안내·API 404, 금액은 서버 DB 가격(클라는 programId·tier 만), customerName/customerMobilePhone(숫자만) v2 필드명 일치. tsc 0·테스트 13/13·개발서버 /programs(6개 카드·주문서 링크)·주문서 정상/잘못된 tier/없는 id 렌더 확인. 권장만: 안내 화면 HTTP 200 | 통과 |
| 2026-10-02 | **토스 심사 주문서** — `/programs/order`(상품정보·빈도/금액·주문자 이름/휴대폰(저장 안 함)·카드 라디오·구매조건 동의·결제하기) 신설, 카드 [결제하기]는 주문서로 이동, 결제창 코드는 `lib/payments/tossReviewClient.ts` 한 벌, 공개 /programs 에서 0원 프로그램 숨김(`hasSellablePrice`). 테스트 13/13·tsc 통과·개발서버 렌더 확인 | 검수 대기 |
