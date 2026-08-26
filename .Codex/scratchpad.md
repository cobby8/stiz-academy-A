# STIZ Codex Scratchpad

## 현재 작업
- 정규 차량 배정 확장 완료: 월별 시트 보존, 전월 비교, 휴원·퇴원 제외, 확인보류, 문자 미리보기(승인 전 무발송), 월별 자동 배차 저장.
- 안전 규칙 수정: 외부 알림은 수신자·변경값·문구·건수 미리보기 후 별도 명시 승인이 있어야만 발송한다.
- 작업명: 학부모 요청 기반 시트·랠리즈·홈페이지 3중 동기화
- 상태: **출석·학생 상태 3중 동기화 완료 / 8·9월 차량 정리 및 변동 문자 11건 발송 완료**
- 기준일: 2026-08-26

## 진행 현황표
| 항목 | 상태 | 메모 |
| --- | --- | --- |
| 방학특강 명단·금액 | 완료 | 23명 시트와 100% 일치. 탁경일·김도운 반/요일 교정 |
| 방학특강 형제할인 | 완료 | 소급 2명(이서원·이효성 →135,000), 멱등 3회 검증 |
| 기존회원 판정 | 완료 | ACTIVE 재원만 + 특강 전용 반 제외(두 조건 AND) |
| 셔틀 정합화 | 완료 | 누락 6명 반영, 취소자 제외, 희망/확정시간 분리, 타임존 버그 |
| 교사 앱 청구 | 완료 | 0건 → 384행. Enrollment 폴백 + `i.amount=p.amount` 조인 제거 |
| 정규반 금액 계산 | 완료 | 4중 버그 수정(첫행만/추가수강/묶음키/컬럼덮어쓰기) |
| **8월 청구 재계산** | 완료 | 14,041,750 → **19,709,000원** / 138건 |
| 납부기한 | 완료 | 매월10일(3곳 하드코딩) → 약관 기준 전월 말일 |
| 재원 상태 교정 | 완료 | 39명(퇴원 33·휴원 6), ACTIVE 148→141 |
| 퇴원 판정 결함 | 완료 | 시트에서 사라지면 영원히 휴원 → 퇴원 후보 노출(수동 승인) |
| 약관 개정 초안 | 확정 대기 1건 | `.Codex/drafts/terms-revision-2026-07.md` — **미게시** · 자동 퇴원 확정, **시행일만 미정** |
| 정규반 형제할인 자동화 | **미착수** | 이중 할인 방지 설계 필요(시트에 이미 수기 반영) |
| 랠리즈 출석 동기화 | **코드 완료** | 관리용 이름 fallback, 미처리·명단불일치·수동출석 충돌은 HELD |
| 수7 출석·학생 상태 | 완료 | 수7 5명 출석, 김지훈·박재윤·원지섭 활성, 정휘건 휴원, 배유빈 퇴원, 이윤건 수6 등록 |
| 8·9월 차량 동기화 | 완료 | 휴원·퇴원 8명 제거(8월 18행·9월 17행), 시간 변동 11명 문자 발송 성공 |
| 배포 | 완료 | `fee61e2` 운영 배포 Ready 확인 |

### 2026-08-26 오늘 출석 대조
- 최종 처리: 수7 박하준·서우빈·우지율·우지호·이현일 전원 출석 완료.
- 김도현은 보호자 박유진·연락처·생년월일 대조 후 랠리즈 관리명을 `김도현B`로 교정.
- 김지훈·박재윤·원지섭 활성, 정휘건 8~9월 휴원, 배유빈 퇴원, 이윤건 수6 등록을 시트·랠리즈·홈페이지 기준으로 반영·재조회함.
- 수3: 7명, 이서준은 관리명 `이서준A`로 연결 가능.
- 수4: 김지훈·박재윤 활성 반영 완료.
- 수5: 보호자·연락처·생년월일 대조 후 랠리즈 김도현을 관리명 `김도현B`로 교정 완료.
- 수6: 원지섭 활성, 정휘건 휴원, 배유빈 퇴원, 이윤건 수6 등록 완료.
- 수7: 5명 전원 출석 완료. 차량 시트의 구 연락처 기준 여민재 행은 비재원으로 제거.

## 확정된 운영 규칙 (사용자 승인, 2026-07-26)
1. 보강이 원래 수업일과 겹치면 **차단**
2. 반 이동 시 예전 예정일 **소프트 취소**, 하드 DELETE 금지
3. 출결 기록 행은 **불가침**
4. 보강 이수해도 원래 결석은 **결석 유지**
5. 정원 초과는 **의도된 운영** — 초과 반 보강은 경고만
6. 기존회원 = **현재 재원(ACTIVE)만**. 휴원·퇴원·특강만 수강 제외
7. 형제 = 보호자 전화번호 합집합. **같은 시즌 함께 신청**한 경우만 할인
8. 형제할인 **10% 전원 각각, 기존회원가에 중복, 수강료만, floor**
9. 셔틀 `pickupTime`=희망(참고) / `ShuttleRouteStop.plannedAt`=확정
10. 정규반 금액은 **홈페이지 기준** — 시트 대사가 덮어쓰지 못하게
11. **청구액 = 그 달 모든 등록 행 수강료 합계 + 셔틀비(첫 행 1회)**
12. 청구 대상 = `미결제/카드결제/추가수강` · 제외 = `휴원/퇴원/이월`
13. **이월 1회 차감 = 그 달 실제 수업 횟수로 나눈 1회분** (주2회면 ÷8)
14. 납부기한 = **수강 시작일 전** (= 전월 말일)
15. 휴원: 신청 마감 **수강 시작일 전**, 최대 **2개월**, **자리 보장**
16. 환불 = **학원법 시행령 별표4 표준안 그대로**
17. 셔틀비 반환 = **안 탄 날짜만큼**

## ⚠️ 위험 메모 (반드시 유지)
- **`prisma migrate dev` 금지** — `_prisma_migrations` 드리프트. 실행 시 **DB 리셋 제안**. `IF NOT EXISTS` 멱등 SQL 직접 적용이 관례.
- **`git add -A` 절대 금지** — `.tmp/`에 실 신청자 개인정보, 저장소 public.
- **생년월일 비교식 `(AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Seoul'` 고치지 말 것** — 실측 293/295 정확. 테스트로 방어 중.
- **시트 임포트/재동기화 실행 시 8월 청구 금액 덮어쓰기 위험.** 상태만 고칠 땐 SQL 직접 교정.
- `SpecialProgramApplicationItem` CHECK 제약 — 금액 컬럼 추가 시 제약도 함께 갱신.
- `StaffPaymentConfirmationRequest` 복합 FK — `Payment.classId` NULL이면 수납확인 INSERT 거부.

## 원장 확인 대기
| 항목 | 내용 |
| --- | --- |
| 박태이 탑승시간 | 시트 `오전 12:00` 오타 — 실제 시간 미회신 |
| 셔틀 노선 편성 | 신규 6명 지도 위치 핀 필요, 기사 계정 0명 |
| 김현호 | 8월 **신규 등록자인데 Enrollment가 PAUSED** — 비정상 |
| 전화번호 오기 3건 | 김백찬·박서준·이하준 — 어느 번호가 정인지 |
| 약관 시행일 | 게시 예정일 미정(`2026년 __월 __일`). 자동 퇴원 조항은 **승인 완료** |

## 후속 과제
| 대상 | 내용 |
| --- | --- |
| 정규반 형제할인 | 시트에 이미 수기 반영 → **이중 할인 방지 설계 필수** |
| 학부모 화면 할인 분해 | "수강료 110,000 − 형제할인 11,000 = 99,000" 표시(15개+ 화면) |
| 이월 기능 | `StudentCarryOver` 테이블 설계안 존재. 사유·증빙 기록 + 검산(verify 모드) |
| 특강 납부기한 | `seasonal/route.ts:167` 아직 "오늘+7일" — 약관과 불일치 |
| 8월 기한 혼재 | 신규 2건만 7/31, 나머지 144건 8/10. 미발송 상태라 통일 가능 |
| 표성현 중복 레코드 | Student 2개 |
| `enrollment-dates-diff.ts:55` | 취소된 보강 좌석이 정규 복귀 차단(희귀) |
| 셔틀 통계 불일치 | 미배정 카운트가 취소자 포함(목록 16 vs 통계 18) |

## 기획설계 / 구현 / 테스트 / 리뷰 기록
(상세는 커밋 메시지 참조: `15a703e` `3b87ae8` `b2dfbaf` `a1db994` `437d267` `471102c` `4de93e8` `0ab7688` `9de8d84`)

### 기획설계 2026-07-26 — 셔틀 확정 명단 전환 (설계만 · 코드/DB 무변경 · 미승인)

🎯 목표: 셔틀 대상자를 "매번 재조회"에서 **"한 번 확정하면 유지"**로 바꾼다. 원본 변동은 알림만, 반영은 관리자 클릭.

- **근본원인**: `SpecialProgramShuttleRequest`는 신청 기록일 뿐 대상자 명단이 아니다. 화면마다 신청서·수강항목·개설반을 4테이블 조인해 걸러야 해서 새 SQL 짤 때마다 필터가 빠졌다(4회 반복: `b2dfbaf`·`4c87468`×2·자동배차). 공용 모듈만으로는 **새 SQL이 그걸 안 쓰면 또 뚫린다.**
- **실측(SELECT만)**: 신청 20건 → 유효 18(탑승16/미탑승2: 김도운·양시우). 제외 2 = 나우준·문근우(3단계 전부 CANCELLED). **`ShuttleRoutePlan`/`Stop`/`Passenger` 전부 0건 → 기존 노선 충돌 위험 0. 지금이 전환 최적 타이밍.**
- **날짜별 인원 실측(15운행일, 7/27~8/19)**: 월9 · 화11 · 수9 · 목11 · 금4. **월≠수, 화≠목** (월엔 우지율, 수엔 김민준 / 화엔 이윤석, 목엔 이승민). 요일 패턴으로 뭉갤 수 없다.
- **핵심 판단 — 2계층**: ① **시즌 확정 명단**(누가 셔틀 회원인가, 16행) = 지금 빠진 것 ② **날짜별 운행 명단**(그날 누가 타나) = **이미 `ShuttleRoutePlan.serviceDate` + `ShuttleRoutePassenger`가 담당**. 날짜별 확정 테이블을 새로 만들면 15일×2방향=30번 확정이라 운영 불가. **①만 만들고 ②는 파생.**
- **저장**: 신규 테이블 `SeasonalShuttleRoster`(시즌×셔틀신청 1행, 방향은 컬럼, 요일은 `weekdaysSnapshot`). 기존 행에 컬럼 추가 불가 — 8월 청구와 달리 **행의 존재 자체가 흔들리기** 때문(취소 시 확정본도 같이 죽음). FK 없이 ID만(=`SpecialProgramEnrollmentDate` 관례).
- **`priceSnapshot` 방식(값 복제) 채택**: 확정시각만 기록하면 조회가 여전히 4조인이라 **필터 누락 사고가 그대로 재발**한다. 좌표·주소는 학부모가 바꿀 수 있고 기사님이 물리적으로 찾아가는 값이라 금액보다 복제 필요성이 크다.
- **탑승 토글 이동**: 현재 토글은 원본 `status`를 REQUESTED/CANCELLED로 덮는데, 이건 `syncLegacyAssignment`가 `ASSIGNED`를 쓰는 **같은 컬럼**이다(배정 학생 토글 시 강등 버그). → 확정본 `ride` 컬럼으로 분리하면 자동 해소.
- **전환 안전장치**: 확정본이 없으면 게이트웨이가 내부적으로 원본 fallback → 원장이 안 눌러도 16명 안 끊김. **자동 백필 안 함**(확정 = 사람이 확인했다는 뜻인데 자동 생성하면 제도가 무의미). 킬 스위치는 `AcademySettings` DB 플래그(배포 없이 되돌림).
- **재발 방지 3중**: 출구 함수 1개(`shuttleRoster.ts`) + **소스 전수 가드 테스트**(`studentVisibility.test.ts`에서 검증된 패턴 — 허용목록 밖에서 `"SpecialProgramShuttleRequest"` 조회 시 테스트 실패) + 타입 브랜딩.
- **순서**: 0 DDL(위험0) → 1 게이트웨이+fallback → 2 소비처 4곳 교체(**결과 동일해야 정상**) → 3 확정 UI+원장 확정 → **여기서 노선 편성** → 4 변동 감지 UI → 5 가드. 0~3 오늘, 4~5 내일.
- 상세 표·컬럼 정의·diff 분류·원장 확인 6건은 PM 보고 본문 참조. **DDL 미적용·코드 무변경. decisions.md는 승인 후.**

### 기획설계 2026-07-26 — 중복 학생·임시 보호자 정리 (설계만·DB 무변경)
- **근본원인**: 묶음키는 `이름+생년월일`(`studentBilling.ts:47-55`, `4de93e8`에서 변경)인데 DB 조회키는 여전히 `이름+parentId`(`import-students/route.ts:519-523`). parentId는 전화번호 파생(`route.ts:480-483`) → **시트에 부/모 번호가 섞이면 새 User + 새 Student**. `Student`에 UNIQUE 없음, 생성 경로 6개의 판정키가 전부 다름. `firstIfSingle`(`studentSheetMatching.ts:82-84`)이 후보 2건을 매칭실패 처리해 눈덩이.
- **실측 규모**: 이름+생일 동일 **7쌍** + 정하준(생일 1일차·학부모명 동일) **1쌍** = **8쌍**. Ledger `parentName`이 양쪽 모두 같은 실명 → 동일인 확정. 임시 보호자 133개(`기타(기본 보호자)`)는 3/20 배치 계정, 학생 163명이 여기 매달림. 로스터 자동생성 8명(`team_*@stiz.local`, 전화 NULL).
- **병합 규칙(권장)**: 대표 = **8월 확정 청구가 붙어 있는 쪽** → 8월 Payment/Invoice UPDATE 0건. 대표가 A/B로 엇갈리는 것은 정상(청구 확정 때 이미 사람이 고른 결과).
- **최대 장애물**: `Enrollment_studentId_classId_key` UNIQUE — 8쌍 전부 같은 slotKey 중복(ACTIVE+PAUSED). 병합 시 상태 우선순위(ACTIVE>PAUSED>WITHDRAWN)로 1행 남기고 나머지 흡수 기록.
- **롤백**: 하드 삭제 금지. `Student.mergedIntoStudentId` soft merge + `StudentMergeLog`(테이블·PK·이전 studentId) 저장.
- **위험**: `cleanup-duplicates/route.ts`는 하드 DELETE + FK 누락 → **호출 금지** 대상.
- 상세 설계·단계별 계획은 PM 보고 본문 참조. decisions.md 기록은 원장 승인 후.

### 구현 기록 2026-07-26 — 중복 학생 병합 엔진 + DRY-RUN (실제 병합 미실행)

📝 구현: 병합 스키마(추가 전용) + 판단 규칙 순수 모듈 + 실행 엔진 + DRY-RUN 시뮬레이션.

| 파일 | 변경 내용 | 신규/수정 |
|---|---|---|
| `prisma/sql/add_student_merge.sql` | 멱등 DDL: `Student.mergedIntoStudentId/mergedAt` + `StudentMergeLog` | 신규 |
| `prisma/sql/verify_student_merge.sql` | 적용 확인 + 8월 기준선 조회 | 신규 |
| `prisma/schema.prisma` | Student 병합 필드·self relation, `StudentMergeLog` 모델 | 수정 |
| `src/lib/studentMerge/plan.ts` | 대표 선정·Enrollment 충돌·청구 동결 가드 (의존 0 순수 모듈) | 신규 |
| `src/lib/studentMerge/plan.test.ts` | 회귀 테스트 11건 (박하준·최현 실측 케이스 포함) | 신규 |
| `src/lib/studentMerge/tables.ts` | 학생 ID를 든 28개 컬럼 목록(FK 13 + FK없음 15) | 신규 |
| `src/lib/studentMerge/engine.ts` | 트랜잭션 병합 실행 + 8월 지문 검증 + 유령참조 스캔 | 신규 |
| `.tmp/merge-dryrun.mjs` | BEGIN→전체 실행→ROLLBACK 시뮬레이터 (개인정보라 .tmp) | 신규 |

- **DDL은 실제 적용함**(추가 전용·멱등 2회 검증, 행 수/8월 금액 완전 동일). **병합은 미실행.**
- **대표 선정 8쌍**: 김백찬A·김용준A·박서준B·박하준A·이하준B·정하준B(8월 확정청구) / 최현B·표성현B(기록 수).
- **8월 청구 불변**: PENDING 138건 19,779,000원 · ISSUED 138건 19,779,000원 · 8월↑ 행 md5 지문 동일.
- **설계 변경 1건**: `User.phone` UPDATE를 전면 폐기하고 **`Student.parentId` 재연결**만 쓴다(김백찬·최현 2건). 오기 번호 계정에 김관우·이시윤이 매달려 있어 계정 수정은 그 학생을 망가뜨린다.
- 교차검증: 병합 후 8쌍 전부 **7월 청구 합계 = 8월 청구액** 일치.

💡 tester 참고:
- 재현: `node .tmp/merge-snapshot.cjs` → `node .tmp/apply-merge-ddl.cjs` → `node --import ./.tmp/ts-hook-register.mjs .tmp/merge-dryrun.mjs`
- 정상: 마지막 줄이 `ROLLBACK 완료`, 8월 지문 동일, 박하준 ACTIVE 3반, 최현 ACTIVE 0
- 주의: `--apply` 플래그는 절대 붙이지 말 것(COMMIT 됨)

⚠️ reviewer 참고: `engine.ts`의 `billingFreezeGuard` 사용처 4곳(Payment/Invoice/Transaction/후검증)과 `moveTable`의 UNIQUE 충돌 가드.

### 구현 기록 2026-07-26 — 학생 조회 병합 필터 (조회 로직만 · DB 무변경 · 병합 미실행)

📝 구현: `Student`를 읽는 경로 **54곳**에 `mergedIntoStudentId IS NULL`을 추가. 지금은 전부 NULL이라 **동작 변화 0**.

| 파일 | 변경 내용 | 신규/수정 |
|---|---|---|
| `src/lib/studentVisibility.ts` | 공용 헬퍼 3종(`notMergedStudent` / `notMergedStudentOptional` / `NOT_MERGED_STUDENT`) | 신규 |
| `src/lib/studentVisibility.test.ts` | 조건식 3건 + **소스 전수 가드**(필터 누락 시 실패) | 신규 |
| `src/lib/queries.ts` | 학생목록·대시보드·반명단·출석부·세션노트·자녀목록·대기자 8곳 | 수정 |
| `src/lib/adminReadPayloads.ts` | 원생수·최근등록·재원상태 집계 3곳 | 수정 |
| `src/lib/staff-*.ts` (5개) | 교사앱 명단·연락처·출석·문자대상 7곳 | 수정 |
| `src/lib/shuttle/{service,parent}.ts` | 셔틀 후보명단, 학부모 자녀 2곳 | 수정 |
| `src/lib/seasonal/{makeup,service,sibling-discount-sync}.ts` | 보강후보·기존회원판정·형제판정 4곳 | 수정 |
| `src/lib/studentSheetMatching.ts` | 시트 재임포트 후보 조회 5곳 | 수정 |
| `src/app/actions/{admin,staff-sessions}.ts` | 월청구 대상·임포트 매칭·특강명단 4곳 | 수정 |
| `src/app/api/admin/**` (7개 라우트) | 자동완성·임포트·중복탐지·특강승인 13곳 | 수정 |
| `src/app/api/staff/sessions/**/photos/*` | 사진 대상 학생 4곳 | 수정 |
| `src/app/mypage/{skills,reports}` | 학부모 자녀 2곳 | 수정 |

- **일부러 제외**(사유는 테스트 파일의 `ALLOWED_WITHOUT_FILTER`에 등록): 병합 엔진 4 · 청구/수납 목록 5 · 단건 상세·알림 10 · 권한/동의 게이트 2 · 고아학부모 판정 1 · 이력 LEFT JOIN 6.
- **실데이터 검증(SELECT만)**: 주요 조회 12개에서 필터 전후 건수 **완전 동일**(학생 311/311, 반명단 207/207, 교사앱 142/142, 월청구 142/142, 문자대상 142/142, 보강후보 반 36/36 …).
- **8명 가상 제외 시뮬레이션**: 학생목록·자동완성·대시보드 311→303, 반명단 207→201, 교사앱/월청구/문자대상 142→137, 보강 후보 반 개수는 36 유지(LEFT JOIN 안전).
- **⚠️ 발견**: 흡수 예정 4명(김백찬·김용준·박서준·이하준)에게 **`CANCELED` 8월 청구 4건**이 붙어 있다. 동결월 규칙상 병합해도 옮겨가지 않아 청구 **전체 목록**에는 흡수된 이름으로 남는다(미납 목록에는 안 뜸). 청구 화면에 필터를 넣지 않은 이유이기도 하다 — 김백찬 흡수 쪽에는 **7월 미납 90,000원(OVERDUE)** 이 살아 있어, 필터를 걸었으면 병합 전 상태에서 미납이 화면에서 사라졌을 것이다.

💡 tester 참고:
- 테스트 방법: `npx tsc --noEmit` → `node --test src/lib/studentVisibility.test.ts`
- 정상 동작: 5건 통과. `src/lib`에 필터 없는 `FROM/JOIN "Student"` 쿼리를 새로 넣으면 **실패해야 정상**(가드 역방향 확인 완료)
- 주의할 입력: LEFT JOIN 자리 — WHERE에 `IS NULL`을 그냥 걸면 학생이 안 붙은 행이 통째로 사라진다(실측 3행→1행)

⚠️ reviewer 참고: `queries.ts`의 대기자 목록(`notMergedStudentOptional`)과 `seasonal/makeup.ts`의 ON 절 배치. 이 둘이 LEFT JOIN 오적용 위험 지점이다.

### 구현 기록 2026-07-26 — 셔틀 노선 출발지·도착지 "학원으로 채우기"

📝 구현: 노선 만들기 모달에서 학원 위치를 버튼 한 번으로 4칸(장소명·주소·위도·경도) 채우기. 학원 좌표 정본을 환경변수 → **DB(`AcademySettings`)** 로 승격하고 환경변수는 fallback으로 남김.

| 파일 경로 | 변경 내용 | 신규/수정 |
|----------|----------|----------|
| `prisma/sql/add_academy_shuttle_location.sql` | 멱등 DDL: `academyPlaceName/Address/Latitude/Longitude` 4컬럼(TEXT, NULL 허용) | 신규 |
| `prisma/schema.prisma` | `AcademySettings`에 위 4필드 추가 | 수정 |
| `src/lib/shuttle/academyLocation.ts` | 좌표 파싱·한국 범위 검증·DB→env 우선순위 결정 (의존 0 순수 모듈) | 신규 |
| `src/lib/shuttle/academyLocation.test.ts` | 회귀 테스트 11건 (실측 좌표 범위·위경도 뒤바뀜·fallback) | 신규 |
| `src/lib/shuttle/service.ts` | `academyWaypoint()`(env 전용) → `getAcademyShuttleLocation()`(DB 우선) + 대시보드 payload에 `academyLocation` 추가 | 수정 |
| `src/app/admin/shuttle/ShuttleRouteAdminClient.tsx` | `EndpointFields`에 "학원으로 채우기" 버튼, 안내문 갱신 | 수정 |
| `src/app/admin/settings/AdminSettingsClient.tsx` | "연락처 및 위치"에 학원 위치 4칸 + "지도에서 선택"(LocationPickerModal, 동적 로드) | 수정 |
| `src/lib/queries.ts` / `src/app/actions/admin.ts` | 4컬럼 읽기 매핑 + 저장 허용목록·컬럼 보장·좌표 검증 | 수정 |

- **DDL 실제 적용함**(추가 전용·멱등 2회 검증). 기존 컬럼/행 무영향, `singleton` 1행만 UPDATE.
- **좌표 확정**: `37.6145054 / 127.1563116` — 카카오맵(`스티즈농구교실 다산2호점`, place 1661652155)과 네이버 지역검색이 동일 도로명주소를 반환, 기존 env 값과 **6.6m** 차이(동일 건물).
- 좌표는 코드에 하드코딩하지 않음. 테스트 파일에만 검증 기준값으로 존재.

💡 tester 참고:
- 테스트 방법: `npx.cmd node --test --experimental-strip-types src/lib/shuttle/academyLocation.test.ts` (11건). 화면은 `/admin/shuttle` → `노선 만들기` → 출발지/도착지 각각의 `학원으로 채우기`.
- 정상 동작: 4칸이 `스티즈농구교실 다산2호점 / 경기 남양주시 다산중앙로20번길 10-32 / 37.6145054 / 127.1563116`으로 채워지고, 채운 뒤에도 손으로 수정 가능.
- 주의할 입력: 관리자 설정에서 위도·경도를 **바꿔 입력**하면 저장이 거부돼야 정상. 좌표 둘 다 비우는 것은 "미지정"으로 허용(버튼이 비활성화되고 안내문이 뜸).

⚠️ reviewer 참고:
- `EndpointFields`를 uncontrolled → controlled로 바꿨다. 저장은 그대로 FormData가 읽는다.
- 좌표 컬럼을 DOUBLE PRECISION이 아니라 **TEXT**로 둔 이유는 `rawUpsertAcademySettings`의 컬럼 자동 추가 fallback이 TEXT로 만들기 때문(타입 갈림 방지). 파일 주석에 근거 기록.

### 구현 기록 2026-07-26 — 셔틀 명단 대상자 필터 공용화 (조회·표시만 · DB 무변경)

📝 구현: 셔틀 대상자 판정 기준을 공용 모듈 1곳으로 모으고, 통합 명단에 빠져 있던 `WHERE` 절을 복구. 미탑승은 숨김+토글, 기사님 CSV는 탑승자만.

| 파일 경로 | 변경 내용 | 신규/수정 |
|----------|----------|----------|
| `src/lib/seasonal/shuttleEligibility.ts` | 기준 단일 출처: `CLOSED_SHUTTLE_STATUSES` / `CANCELLED_OFFERING_STATUS` / `isRidingShuttleStatus` / `seasonalShuttleEligibilitySql` | 신규 |
| `src/lib/seasonal/shuttle-roster.ts` | `WHERE` 절 신설(시즌+신청서+수강항목+개설반), `ride` 판정에 REJECTED 반영, `seasonId?` 인자 추가 | 수정 |
| `src/lib/shuttle/service.ts` | 로컬 상수 삭제 → 공용 모듈 import, 미배정 조회에 **개설 취소 반 제외** 추가 | 수정 |
| `src/lib/shuttle/parent.ts` | 인라인 `["CANCELLED","REJECTED"]` 3곳 → 공용 상수 (동작 동일) | 수정 |
| `src/lib/seasonal/shuttle-optimize.ts` | 필터 승계 주석, 하원 기준 종료시각 `find` → **최댓값** | 수정 |
| `src/app/admin/seasonal/shuttle/ShuttleRosterClient.tsx` | 미탑승 기본 숨김 + `미탑승 N명 보기` 토글, 회색/뱃지 구분, **CSV 탑승자만** | 수정 |
| `tests/seasonal-shuttle-roster-filter.test.mjs` | 회귀 15건 (취소 신청·취소 반·미탑승·LEFT JOIN 가드·CSV·배차) | 신규 |
| `tests/shuttle-unassigned-cancelled-filter.test.mjs` | 공용화·개설취소 검사 추가 | 수정 |
| `tests/parent-shuttle-overview.test.mjs` | 공용 상수 반영 + `NOT_MERGED_STUDENT`로 이미 깨져 있던 단언 복구 | 수정 |

- **실데이터 검증(SELECT만)**: 명단 **20 → 18명**(탑승 16 / 미탑승 2). 제외 2명은 나우준·문근우(신청서·수강항목·개설반 전부 CANCELLED). **정상 탑승자 16명 + 미탑승 2명(김도운·양시우) 전원 유지**. CSV 대상 16명. 기존 노선 화면은 개설취소 필터 추가 전후 **16 → 16 유지**.
- **설계 변경 1건(PM 지시와 다름·의도적)**: 시즌 필터 기본값을 `a."seasonId" = $1` 고정이 아니라 **`s.status <> 'ARCHIVED'`**(+ 선택 인자 `seasonId`)로 했다. 다음 방학 시즌을 미리 만들어 두는 순간 '가장 최근 시즌' 기준이 운영 중인 이번 시즌 명단을 통째로 지워버린다. 현 데이터에서는 시즌이 1개라 결과 동일(18명).
- **DB 무변경.** 조회·표시 로직만. 커밋·푸시 안 함.

💡 tester 참고:
- 테스트: `node --test tests/seasonal-shuttle-roster-filter.test.mjs tests/shuttle-unassigned-cancelled-filter.test.mjs tests/parent-shuttle-overview.test.mjs` (전건 통과), `npx.cmd tsc --noEmit` (0건)
- 화면: `/admin/seasonal/shuttle` → 기본 16행, 나우준·문근우 없음 → `미탑승 2명 보기` 체크 시 김도운·양시우가 회색 행으로 추가 → `기사님용 내보내기 (탑승 16명)` CSV에 미탑승 없음
- 주의할 입력: 검색어를 넣은 상태로 내보내면 **검색 결과 중 탑승자만** 나간다(의도). 미탑승→탑승 되돌리기 버튼이 여전히 동작해야 한다.

⚠️ reviewer 참고: `seasonalShuttleEligibilitySql`의 LEFT JOIN `IS NULL OR` 가드와, 시즌 기본값을 ARCHIVED 제외로 둔 판단.

### 구현 기록 2026-07-26 — 자동 배차 타입 오류 + 대상자 필터 누락 수정 (조회만 · DB 무변경)

📝 구현: 배포를 막던 타입 오류를 고치고, 날짜별 자동 배차 SQL이 공용 대상자 기준을 쓰도록 되돌렸다.

| 파일 경로 | 변경 내용 | 신규/수정 |
|----------|----------|----------|
| `src/lib/seasonal/shuttle-optimize.ts` | `academy` → `academy: ACADEMY`(2곳, TS2552 해소). 두 쿼리에 `a`/`it`/`o` JOIN 추가 후 공용 조각 적용, 손으로 쓴 `r.status <> 'CANCELLED'` 제거. 하원 종료시각 `riders[0]` → **최댓값**, 등원 시작시각 → **최솟값** | 수정 |
| `src/lib/seasonal/shuttleEligibility.ts` | `seasonalShuttleEligibilitySql`에 **선택 인자 `shuttleRequest`** 추가(주면 `r.status NOT IN (CANCELLED,REJECTED)`). 기존 3개 호출부는 인자를 안 주므로 동작 불변 | 수정 |
| `tests/seasonal-shuttle-roster-filter.test.mjs` | 옛 구조를 보던 배차 테스트 2건을 새 구조 기준 6건으로 교체(공용 조각 2회 사용·별칭 JOIN·손수 비교 금지·선택 인자·시각 최댓값·날짜 한정) | 수정 |

- **문제 2의 본질**: 날짜별 좌석(`SpecialProgramEnrollmentDate`) 기준으로 SQL을 새로 쓰면서 공용 모듈(`4c87468`)을 안 썼다. 셔틀 상태 1개만 보고 신청서·수강항목·**개설 취소 반**·`REJECTED`가 전부 샜다. → `errors.md`에 "4회 반복" 패턴으로 기록.
- **JOIN 추가**: 새 쿼리에 공용 조각이 요구하는 별칭이 없어서 `SpecialProgramApplication a` / `SpecialProgramApplicationItem it` / `SpecialProgramOffering o`를 INNER JOIN으로 붙였다. 두 컬럼 모두 NOT NULL FK라 정상 행이 탈락하지 않는다(실측으로 확인). **공용 조각 자체는 수정하지 않고 인자만 추가**했으므로 기존 3개 화면 무영향.
- **실데이터 검증(SELECT만)**: 15개 배차일 전부 수정 전후 **인원 동일**(정상 탑승자 1명도 안 빠짐). 전체 대상 **16명 유지**. **나우준·문근우 없음**(둘 다 `EnrollmentDate` 0건이라 지금은 우연히 안 나오지만, 신청서/항목/개설반이 전부 CANCELLED라 이제는 필터로도 확실히 차단). 요일 필터 정상 — 7/27(월) 9명 전원 월요일반, 화·목반 학생 미포함.
- **DB 무변경.** 자동 배차 실행 안 함. 커밋·푸시 안 함.

💡 tester 참고:
- 테스트: `node --test tests/seasonal-shuttle-roster-filter.test.mjs tests/shuttle-unassigned-cancelled-filter.test.mjs tests/parent-shuttle-overview.test.mjs` → **29건 전건 통과**. `npx.cmd tsc --noEmit` → **0건**.
- 화면: `/admin/seasonal/dispatch` → 날짜 드롭다운에 7/27~8/19 15일, 월 9명 / 화·목 11명 / 수 9명 / 금 4명. 나우준·문근우·김도운·양시우는 어느 날짜에도 안 나와야 정상.
- 주의할 입력: 하원(DROPOFF) 방향. 같은 날 시간대가 다른 반이 생기면 **가장 늦게 끝나는 반** 기준으로 시각이 잡혀야 한다(현재 데이터는 전 일자 09:30~10:50 단일 시간대라 육안 확인 불가).

⚠️ reviewer 참고:
- eslint 잔여 8건은 전부 기존 `$queryRawUnsafe<any[]>` 라인이다(PgBouncer 관례). 이번 변경으로 **신규 0건**.
- `shuttleRequest`를 필수가 아닌 **선택** 인자로 둔 판단: 통합 명단은 '미탑승 → 다시 탑승' 되돌리기 때문에 `r.status`를 SQL에서 거르면 안 된다.

### 구현 기록 2026-07-26 — 셔틀 확정 명단 기반 구축 0~2단계 (DDL 적용 · 확정본 0행 · 화면 결과 불변)

📝 구현: 셔틀 대상자를 읽는 **출구를 게이트웨이 1개로 통합**. 확정 명단 테이블을 만들고(빈 상태), 소비처 4곳이 원본 조인을 버리고 게이트웨이만 부르게 했다. 확정본이 없으므로 전부 폴백으로 동작 = **오늘 화면과 동일**.

| 파일 경로 | 변경 내용 | 신규/수정 |
|----------|----------|----------|
| `prisma/sql/add_seasonal_shuttle_roster.sql` | 멱등 DDL: `SeasonalShuttleRoster`(46컬럼·FK 0·UNIQUE 1·INDEX 2) + `AcademySettings.shuttleRosterConfirmedMode`(BOOLEAN) | 신규 |
| `prisma/sql/verify_seasonal_shuttle_roster.sql` | 적용 확인 + 기준선(18/16/2, 미배정 16, 날짜별 인원) 조회 | 신규 |
| `prisma/schema.prisma` | `SeasonalShuttleRoster` 모델 + 킬 스위치 필드 | 수정 |
| `src/lib/seasonal/shuttleRoster.ts` | **게이트웨이**. 조회 export 2개 + 폴백(내부) + 확정/수정/soft remove(ADMIN 전용) | 신규 |
| `src/lib/seasonal/shuttleEligibility.ts` | `ridingShuttleStatusSql(alias)` 추가(SQL에서도 상수 목록을 쓰게) | 수정 |
| `src/lib/seasonal/shuttle-roster.ts` | 통합 명단 — 원본 SQL 삭제 → 게이트웨이 호출 | 수정 |
| `src/lib/shuttle/service.ts` | 노선 미배정 — `specialProgramShuttleRequest.findMany` 삭제 → 게이트웨이 + 배정여부 별도 조회 | 수정 |
| `src/lib/seasonal/shuttle-optimize.ts` | 자동 배차 — 대상자 SQL 2개 삭제 → `getConfirmedShuttleRosterForDate` 1회 | 수정 |
| `src/lib/shuttle/parent.ts` | 학부모 — 원본 findMany 삭제 → 게이트웨이 + 승객 별도 조회 | 수정 |
| `src/lib/queries.ts` | 킬 스위치 읽기 매핑 1줄(표시용) | 수정 |
| `tests/seasonal-shuttle-roster-gateway.test.mjs` | 게이트웨이 회귀 18건(확정본 있음/없음 양쪽·권한·FK·멱등·soft delete) | 신규 |
| `tests/seasonal-shuttle-roster-filter.test.mjs` / `shuttle-unassigned-cancelled-filter.test.mjs` / `parent-shuttle-overview.test.mjs` | 새 구조 기준으로 갱신 | 수정 |

- **DDL 실제 적용함**(추가 전용·2회 실행 결과 동일). **데이터 변경 0** — 확정본 0행, 킬 스위치 NULL(꺼짐), 원본 20건/좌석 189건/노선 0건 그대로.
- **교체 전후 실측 동일(SELECT만)**: 통합 명단 **18(탑승16·미탑승2)**, 명단 정렬 문자열까지 완전 일치, 미배정 **16**, 날짜별 **월9·화11·수9·목11·금4**(15일 전부), 날짜×이름 137행 집합 차이 **0**, 학부모 대상 **1건** 동일. 나우준·문근우·김도운·양시우는 어느 날짜에도 없음.
- **설계 변경 3건(의도적)**: ① 스냅샷 컬럼 3개 추가 — `pickupConfirmedAt`/`dropoffConfirmedAt`(없으면 노선 편성의 `canAssign`이 죽어 전원 배차 불가), `studentIdSnapshot`(학부모 화면이 자녀와 잇는 유일한 열쇠), `requestCreatedAtSnapshot`(미배정 목록 정렬 보존). ② 킬 스위치를 TEXT→**BOOLEAN**, 기본 **꺼짐**(PM 지시). 저장 화면 연동(`ALLOWED_SETTINGS_COLUMNS`)은 `admin.ts` 동시 작업 중이라 **3단계로 이월**. ③ 게이트웨이가 그날 기준 시각을 `riders[0]`이 아니라 **최솟값/최댓값**으로 계산(현재 데이터는 단일 시간대라 결과 동일, 실측 확인).
- ⚠️ **정렬 1건은 물리적으로 재현 불가**: 미배정 목록 상위 9명은 `createdAt`이 **완전히 같아**(2026-07-21 일괄 등록) 기존 정렬이 원래 무작위였다(행을 한 번 수정하면 순서가 또 바뀜). 동점 시 **이름순**으로 고정했다. 나머지 7명 위치는 그대로.

💡 tester 참고:
- 테스트: `node --test tests/seasonal-shuttle-roster-gateway.test.mjs tests/seasonal-shuttle-roster-filter.test.mjs tests/shuttle-unassigned-cancelled-filter.test.mjs tests/parent-shuttle-overview.test.mjs` → **46 pass / 4 fail**. `npx.cmd tsc --noEmit` → **0건**.
- ⚠️ 실패 4건은 **내 변경과 무관**하다. 전부 `ShuttleRosterClient.tsx`(다른 개발자 편집 중)에서 미탑승 토글·CSV 탑승자 필터·파일명이 사라져서 난다. HEAD엔 10곳 있는데 워킹트리엔 0곳.
- 화면: `/admin/seasonal/shuttle` 18행(탑승16), `/admin/shuttle` 미배정 16명, `/admin/seasonal/dispatch` 날짜별 9·11·9·11·4. **셋 다 오늘과 같아야 정상.** 확정 버튼은 아직 없다(3단계).
- 주의: 킬 스위치가 기본 꺼짐이라 확정본을 넣어도 무시된다. 3단계에서 확정 버튼이 켠다.

⚠️ reviewer 참고:
- `service.ts`에서 `routePassengers.none`(중첩 조건)을 **별도 조회 + Set 차집합**으로 분리한 부분. 노선 0건이라 실측 검증이 불가능하다.
- `parent.ts`의 `conversionStatus='COMPLETED'` 조건이 게이트웨이 SQL의 `CASE WHEN`으로 옮겨간 부분(확정 후 전환되면 스냅샷이 낡는다 → 4단계 변동 감지가 잡아야 함).
- eslint: 내 파일 신규 **0건**, 오히려 기존 `any[]` **3줄 감소**.

## 수정 요청
| 요청자 | 대상 | 문제 | 상태 |
|---|---|---|---|
| developer | `src/lib/seasonal/shuttle-optimize.ts` | (해소) T맵 커밋 `5c82ac0`이 공용 대상자 필터를 다시 삭제 — 같은 사고 5회째. 게이트웨이 교체로 자동 해소 | 완료 |
| developer | `src/app/admin/seasonal/shuttle/ShuttleRosterClient.tsx` | **미탑승 기본 숨김·CSV 탑승자만·파일명이 워킹트리에서 사라짐**(HEAD 10곳 → 0곳). 기사님 CSV에 미탑승자가 실릴 수 있음. 담당자 확인 필요 | 대기 |
| developer | `prisma/schema.prisma` · `shuttle-roster.ts` | 동시 편집으로 내 변경이 2회 덮였다. 병렬 작업 시 같은 파일 배정 금지 필요 | 보고 |

## 작업 로그 (최근 10건)
- 2026-08-27: 정규 차량 배차 월 선택·월별 저장 노선 삭제를 보완하고, 잘못 들어간 8월 228건을 복구한 뒤 실제 9월 228건을 재이관했다. 8→9월 변동 11명은 문자 미리보기 승인 대기이며 발송 0건.
- 2026-08-26: 랠리즈 학생 검색·상세·재원상태 변경 경로를 확인하고 시트 성공 전 완료 기록 차단, 대상 상태·수강반 재확인 문구를 구현했다. 실제 학생 변경 없음.
- 2026-08-26: 구글 시트 휴원·퇴원 자동 반영 어댑터와 재조회 검증을 구현했다. 테스트 8건 통과. 서비스 계정의 대상 시트 접근은 403으로 차단되어 공유 권한 추가 대기.
- 2026-08-26: 승인 미리보기와 `시트 확인 → 랠리즈 확인 → 홈페이지 최종 반영` 순서 가드를 추가했다. 휴원·퇴원만 홈페이지 어댑터 지원, 나머지는 확인보류. 운영 데이터 미변경.
- 2026-08-26: 월 청구 스킬을 만들고 3중 동기화 입력함·원장·중복 방지를 구현했다. 타입 검사·신규 린트·단위 테스트 4건 통과, 운영 DB와 외부 시스템은 미변경.
- 2026-07-26: 명단을 코트 전체(형제 반 합산) 기준으로 통합(`15a703e`).
- 2026-07-26: 기존회원 판정에 ACTIVE 재원 + 특강 제외 조건 추가(`3b87ae8`).
- 2026-07-26: 셔틀 미배정 목록 취소자 제외(`b2dfbaf`) + 누락 6명 반영.
- 2026-07-26: 셔틀 희망/확정시간 분리 + 표시 타임존 버그 수정(`a1db994`).
- 2026-07-26: 형제할인 10% 도입 및 소급 2명 적용(`437d267`).
- 2026-07-26: 교사 앱 청구 0건 복구, 384행 노출(`471102c`).
- 2026-07-26: 정규반 청구 금액 4중 버그 수정(`4de93e8`) + 8월 재계산 19,709,000원.
- 2026-07-26: 납부기한을 약관 기준으로 통일(`0ab7688`), 8/1 일괄 연체 137건 방지.
- 2026-07-26: 퇴원 판정 결함 수정(`9de8d84`) + 재원 상태 39명 교정(148→141).
- 2026-07-26: 약관 초안 자동 퇴원 조항 확정 반영(doc-writer) — 남은 확인 항목 시행일 1건.
- 2026-07-26: 중복 학생 병합 스키마 적용(추가 전용) + 8쌍 DRY-RUN 완료. 8월 청구 138건/19,779,000원 지문 불변, 실제 병합은 미실행.
- 2026-07-26: 학생 조회 54곳에 병합 필터 추가(조회 전용). 필터 전후 12개 조회 건수 동일, 소스 전수 가드 테스트 신설. 병합은 여전히 미실행.
- 2026-07-26: 셔틀 명단 대상자 필터 공용화(`shuttleEligibility.ts`). 통합 명단 WHERE 절 복구로 20→18명(탑승16/미탑승2), 노선 화면에 개설취소 반 제외 추가(16→16 유지), 미탑승 숨김+토글, 기사님 CSV 탑승자만. DB 무변경.
- 2026-07-26: 셔틀 확정 명단 전환 설계(planner-architect, 승인 대기). 신규 `SeasonalShuttleRoster` 1개 + 게이트웨이 1개 + 소스 전수 가드. 노선 0건이라 전환 위험 0, 날짜별 인원 월9·화11·수9·목11·금4 실측. 코드/DB 무변경.
- 2026-07-26: 셔틀 노선 출발지·도착지 "학원으로 채우기" 추가. 학원 좌표 정본을 env → DB(`AcademySettings` 4컬럼)로 승격(env는 fallback), 자동배치 409 위험 해소. 좌표 37.6145054/127.1563116 카카오·네이버 교차검증.

- 2026-07-26: 자동 배차 타입 오류(TS2552) 수정 + 날짜별 배차 SQL에 공용 대상자 기준 재적용(필터 누락 4회째). JOIN 3개 추가, 배차일 15일 전부 인원 불변·16명 유지, 나우준·문근우 차단. 테스트 29건 통과, tsc 0건. DB 무변경.


- 2026-07-26: 셔틀 확정 명단 기반 구축 0~2단계. `SeasonalShuttleRoster`(46컬럼·FK 0) DDL 적용(확정본 0행·데이터 무변경), 게이트웨이 `shuttleRoster.ts` 신설(조회 export 2개·폴백 내부), 소비처 4곳 원본 조인 제거. 실측 전후 동일: 명단 18(16/2)·미배정 16·날짜별 월9화11수9목11금4·137행 집합차 0. tsc 0건, 테스트 46 pass(4 fail은 타 작업 파일).
## PM 체크
- scratchpad 작업 로그 10건 이내 · 100줄 이내 유지.
- 이번 작업 범위 밖 변경 파일은 스테이징하지 않음.
- 롤백 스냅샷 8종: `.tmp/rollback-2026-07-26/` (before / students / shuttle / sibling / august-billing / withdrawal / enrollment-status)
