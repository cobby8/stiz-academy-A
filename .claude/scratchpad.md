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

## 리뷰 결과 (reviewer) — 셔틀 명단 앱 편집 1단계 (2026-10-02)

📊 종합 판정: 수정 필요 (높음 1)

✅ 잘된 점: 모든 SQL 파라미터 바인딩·route+lib 이중 requireAdmin·편집마다 트랜잭션+달 단위 advisory lock+감사 기록. 삭제는 id+serviceMonth+BOARD/ALIGHT 3중 한정, 개수 불일치 시 롤백. 복사는 대상 달 있으면 거부. 추가 행 studentId(실제 Student.id, FK 검증)는 COALESCE 1순위라 신규 배너·reconcile 과 호환. 날짜는 문자열 월 계산·koreaServiceMonth 만 사용. 위치 링크·기사 운행 링크 유지. 관련 테스트 34/34.

🔴 필수 수정:
- src/lib/shuttle/regularDriverRoute.ts:70·85·47 — 월 인자 없이 호출 → 「다음 달 명단 만들기」(10월 중 11월 생성) 즉시 기사 화면이 11월 명단(getRegularShuttleStops 의 months[0])·11월 저장 노선(MAX → 없음 → 폴백 순서)으로 바뀜. 정류장 행 id 도 새로 생겨 그날 탑승체크 rowId 가 안 맞음. 수정: getRegularDriverClasses 에서 month = "viewDate.slice(0,7) 이하 중 최신 저장 월" 한 번 계산해 세 호출(stops·saved·loadRowIdsByStudentId→getRegularShuttleRiders)에 모두 전달.

🟡 권장 수정:
- src/app/admin/shuttle/regular-dispatch/page.tsx:18 — 기본 월이 months[0](최신=다음 달). 명단 화면처럼 `months.find(m => m <= koreaServiceMonth())` 로. 같은 줄 폴백 `new Date().toISOString().slice(0,7)` 은 금지 패턴(기존 코드).
- src/lib/shuttle/regularRosterEdit.ts:529 applyToAll — 새 좌표가 비어 있으면 같은 이름 다른 행 좌표까지 null 로 지움 → `COALESCE($2,"latitude")` 처럼 비어 있으면 유지.
- (기존 코드) regularDriverRoute.ts:33 weekdayOf 가 `T12:00:00+09:00`+getUTCDay 금지 패턴. 위 수정 때 공용 KST 모듈로 교체 권장.

## 작업 로그 (최근 10건)

| 날짜 | 작업 내용 | 상태 |
|------|----------|------|
| 2026-10-02 | **셔틀 명단 1단계 리뷰 수정 4건(developer)** — ①기사 화면 월 고정: `pickServiceMonthFor`(serviceMonth.ts·테스트 6건)로 그날 달 이하 최신 달을 명단·저장노선·탑승키에 전달, weekdayOf→kstDow ②정규 배차·셔틀 명단 기본 월 같은 함수 사용, toISOString 폴백 제거 ③정류장 수정(단일·일괄) 좌표 COALESCE 유지 ④반이동 다른 학생 섞이면 거부(rosterStudentKey). tsc 0·단위 64/64·tests 54/54. 미커밋 | 검수 대기 |
| 2026-10-02 | **셔틀 명단 1단계 리뷰(reviewer)** — 수정 필요. 높음 1: 기사 화면이 월 인자 없이 최신 월을 읽어 다음 달 명단 복사 즉시 다음 달로 전환(regularDriverRoute.ts). 권장: 정규 배차 기본 월·applyToAll 좌표 지움. SQL·권한·삭제 범위·reconcile 호환 문제 없음 | 수정 요청 |
| 2026-10-02 | **셔틀 명단 1단계 검수(tester)** — tsc 0·셔틀 단위 57/57·regular-shuttle 48/48·경계 8건 통과. 화면은 관리자 로그인 필요로 생략(비로그인 307/403 차단 확인). DB 쓰기 0 | 통과 |
| 2026-10-02 | **셔틀 명단 앱 편집 1단계(developer)** — 시트 탭을 「셔틀 명단」 화면으로 교체, RegularShuttleStop 추가·빼기·반이동·정류장 수정·다음 달 복사 API(raw SQL·ShuttleAuditLog 기록). tsc 0 / 셔틀 단위 57-0 / tests 1750 중 실패 1(기준선 동일). 미커밋 | 검수 대기 |
| 2026-10-02 | **토스 심사 주문서 리뷰(reviewer)** — 통과. DB 쓰기·청구서 접근 0, 키 없음/라이브 키 시 주문서는 안내·API 404, 금액은 서버 DB 가격(클라는 programId·tier 만), customerName/customerMobilePhone(숫자만) v2 필드명 일치. tsc 0·테스트 13/13·개발서버 /programs(6개 카드·주문서 링크)·주문서 정상/잘못된 tier/없는 id 렌더 확인. 권장만: 안내 화면 HTTP 200 | 통과 |
| 2026-10-02 | **토스 심사 주문서** — `/programs/order`(상품정보·빈도/금액·주문자 이름/휴대폰(저장 안 함)·카드 라디오·구매조건 동의·결제하기) 신설, 카드 [결제하기]는 주문서로 이동, 결제창 코드는 `lib/payments/tossReviewClient.ts` 한 벌, 공개 /programs 에서 0원 프로그램 숨김(`hasSellablePrice`). 테스트 13/13·tsc 통과·개발서버 렌더 확인 | 검수 대기 |
| 2026-10-02 | **기록 목록 병합 필터** — 병합 엔진이 기록도 옮기게 된 후속 작업. 흡수 쪽 잔여가 진짜 중복인 목록(학부모·원장 보강권, 보강 일정, 셔틀 예외 예정목록·기사 명단·누락알림 복구)에 notMergedStudent 적용. 결석(UNIQUE 가 상태 무시 → 살아있는 결석이 흡수 쪽에 남을 수 있음)·반변경 신청(남는 게 유일한 기록)은 리뷰 지적으로 예외 유지. 가드 예외 개수 실측 일치 | 완료 |
| 2026-10-02 | **학생 병합 엔진 참조 목록 보강** — 운영 DB 재실측(SELECT 만)으로 7/26 이후 생긴 학생 참조 12곳(보강권·정규결석·셔틀당일예외·수강변경신청·납부요청·POS알림 등)+운영 미반영 4곳을 `studentMerge/tables.ts` 에 추가. UNIQUE 충돌키·부분 UNIQUE·청구 계열은 Payment 를 따라가게(동결분은 같이 남음)·월별수강대장은 payload CHECK 때문에 흡수 쪽 고정. schema.prisma 대조 누락 가드 테스트 신설. 기병합 8명 잔여 참조 0건이라 재이관 불필요. 발견: studentVisibility 가드 기존 실패(27파일) | 완료 |
| 2026-10-02 | **결제 절차 문서 테스트 정상화** — SKILL.md 가 9/30 방침(사이트 기준·10월 시트 장부 중단)으로 바뀌었는데 테스트가 옛 문장을 찾아 실패. 같은 안전 계약(완료조건·HELD 해제조건·대상 특정·실행 후 재확인)을 새 문장으로 검사 + first-registration.md 초대 1회·재발송 금지 추가. 이제 `npm test` 전체 1736/1736 통과 | ✅ de22a07e 배포 |
| 2026-10-02 | **학생 병합 필터 가드 정상화** — 27파일 56건 분류: 학부모 «새 신청» 자녀 선택 5곳에 notMergedStudent(운영 실측 흡수 8명·진행 수강 0건이라 화면 변화 0), 나머지는 사유 붙여 예외 등록(청구·POS 대조·id 단건·게이트·병합엔진이 안 옮기는 기록 목록). `npm test`·`test:guards` 신설 + release-preflight 에 가드 편입. 후속: tables.ts 에 MakeupCredit 등 신규 테이블 추가 필요 | ✅ 667c73be 배포(검수 승인·런타임 오류 0) |
