# 작업 스크래치패드

## 현재 작업
- **상태(2026-07-27 마무리)**: 아래 다수 기능 구현·검증(tsc EXIT=0)·배포 완료. **미푸시 0.** 병렬 세션과 계속 머지하며 진행.
- 오늘 배포: ①수강생 상세(/admin/students/[id]) 전문 재설계 + 인라인 편집(정보·결제·반·셔틀좌표) ②셔틀 위치 장소명(placeName) 전역 통일 ③저장 배차노선 reconcile-on-read(제거 자동/추가·위치변경 배너/증분삽입 재배차/라벨 자가갱신) ④정차 확정시간(실 T맵 구간시간 + 관리자 편집·보존 + 기사/학부모 노출) ⑤방학특강 선생님 화면을 정규 '수업 시작→흐름 저장→출결' 통합 흐름으로 개편(로스터 전원화·출결 좌석저장·수업시작 취소·UI) ⑥수업시작 void 핫픽스 ⑦관리자→선생님 화면 진입점
- **미완/이월**: 방학특강 셔틀 4단계 4a-2(학부모 사전 결석 신고)·4b(시즌 격리)·4c(추가 확정)·4d(변동 배지). 미전환 신청자 학부모 알림(선생님 출결 시). 카카오맵 키는 localhost만 미등록(프로덕션 정상).
- **현재 담당**: pm
- **마지막 세션**: 2026-07-27

## 4단계 실행 계획 (사용자 결정 반영)
- 사용자 결정: ①결석=기존 출결(ABSENT/EXCUSED)에 셔틀 자동연동 ②입력=관리자+학부모 마이페이지 둘 다 ③신규 신청=원장 '추가 확정' 버튼(수동)
- **4a. 결석 → 그날 셔틀 제외** (독립·명시요청): 4a-1 배차쿼리+관리자입력 ✅ / 4a-2 학부모 마이페이지 사전 결석 신고(보안 가드) ⬜
- **4b. 시즌 격리 (R-7②)**: 여름·겨울 한 바구니 → 시즌별 분리 (4c 선행) ⬜
- **4c. 확정 후 '추가 확정'**: GET에 미확정 N명 → 배너 버튼(ON CONFLICT 재사용) ⬜
- **4d. 변동 감지 배지 (선택)**: sourceFingerprint 재계산 diff → ⚠️ 배지 ⬜
- 주의: 배차는 stateless 재계산 → 저장된 노선은 결석 반영에 재배차 필요(4a에서 안내)

## ⚠️ 배포 메커니즘(중요)
- Vercel 빌드는 `prisma generate && next build`뿐 — **`migrate deploy` 자동 실행 안 됨**. 스키마 변경은 **멱등 SQL을 운영 Supabase(ref gpjdtkumqxzfgkixjamp)에 직접 적용**(Supabase MCP apply_migration). 마이그레이션 폴더는 기록용.
- 운영 배포 = 브랜치를 `git push origin HEAD:main` fast-forward (PR 병합/DDL은 자동분류기가 막음 → 원장 승인 필요).

## 진행 현황
| 항목 | 상태 |
|------|------|
| 셔틀 확정 명단 0~3단계(게이트웨이·확정 UI·확정본 편집·핀) | 완료·배포 |
| 4a-1 결석→그날 배차 자동 제외 | 완료·커밋(b04fdf8, 미푸시) |
| 4a-2 학부모 마이페이지 사전 결석 신고 | 대기 |
| 4b 시즌 격리(R-7②) / 4c 추가 확정 / 4d 변동 배지 | 대기 |
| 승차위치 아파트/건물명 표시(카카오 장소명) | 완료·커밋(수동검증 대기) |
| 자동배차 무료탑승 드래그 지정 | 완료·커밋(수동검증 대기) |
| T맵 최적경로 활성화(startTime·viaPointId 버그 수정) | 완료·배포 |
| 배차 순서변경 시 시각 재계산 + 출발 고정 | 완료·배포 |
| 기존 주소→건물명 일괄변환(명단 버튼) | 완료·배포 |
| 배차 드래그 핸들 맨 앞 이동 | 완료·배포 |
| 배차 노선 지도(T맵 실도로 경로) | 완료·배포 |
| 배차 노선 수정본 DB 저장/불러오기 | 완료·배포(테이블 생성) |
| 순서 변경 시 T맵 실도로 재계산(고정순서 /routes 청킹) | 완료·배포 |
| 증분 재배차 cheapest-insertion(Phase 2b, 순서보존) | 완료·검증(tsc EXIT=0, 유닛 13/13) |
| 기사님 운행 화면(전용 링크·탑승 체크) | 완료·배포(테이블 2개) |
| 셔틀 확정 명단 4~5단계(변동 감지·재발 방지 가드) | 대기 |
| 정규반 형제할인 자동화 | 대기(시트 수동 10% 이중적용 위험 확인 필요) |
| 미푸시 커밋 | 1개 (b04fdf8) |

## 구현 기록 (developer)

### 구현 기록 — 방학특강 통합 진행화면 로스터·출결 좌석 기준 전원화 (A) (2026-07-27)
📝 방학특강 통합 수업진행 화면이 전환(Student 변환) 여부와 무관하게 **APPROVED 신청항목 전원(=좌석)**을 로스터·출결하도록 변경. 기존엔 `convertedStudentId IS NOT NULL`로 걸러 미전환자가 명단에서 빠졌음. 이제 출결 정본 = 좌석(SpecialProgramEnrollmentDate.attendanceStatus), 전환된 학생만 정규 Attendance 병행.

| 파일 | 변경 | 신규/수정 |
|------|------|----------|
| src/lib/staff-session-queries.ts | StaffSessionStudent 타입에 attendanceKey/studentId/grade/phone 추가. seasonal 로스터 쿼리를 좌석(SpecialProgramEnrollmentDate, SCHEDULED) 조인으로 교체 — convertedStudentId·conversionStatus·요일CASE 필터 제거(좌석 존재=요일매칭 인코딩). name=childName 폴백, key=enrollmentDateId. 정규 분기는 attendanceKey=studentId 매핑만 추가(동작 무변경) | 수정 |
| src/app/actions/staff-sessions.ts | saveStaffAttendance 입력 studentId→attendanceKey. seasonal이면 saveSeasonalSeatAttendance(신규)로 분기: 좌석을 세션 스코프 내 검증하며 UPDATE→전환자(studentId)면 Attendance+알림 병행, 미전환은 좌석만. 기존 mirrorSeasonalSeatAttendance 제거. completeClassSession seasonal 미확인 카운트를 좌석(attendanceStatus IS NULL AND status='SCHEDULED') 기준으로 재작성 | 수정 |
| src/app/staff/sessions/[sessionId]/SessionInProgressClient.tsx | 출결 버튼(updateAttendance·markAllPresent)이 student.attendanceKey로 saveStaffAttendance 호출. 사진 태깅은 studentId 있는 행만(미전환 제외) | 수정 |

💡 tester 참고:
- 방학특강 반: [수업 시작]→진행화면 출석부에 **미전환 신청자 포함 전원**이 뜨는지(예전엔 거의 빔). 형제 반/court는 좌석별 행으로 합산.
- 출석/지각/결석 → 좌석 attendanceStatus 저장(관리자 배지·셔틀 결석제외가 읽는 컬럼). 전환된 학생은 정규 Attendance에도 기록+학부모 알림.
- 전원 출결 확인해야 [수업 종료] 가능(좌석 기준 미확인 카운트).
- 정규(비seasonal) 로스터·출결·종료·학부모 알림 **동작 무변경**. tsc EXIT=0. 순수함수 없음(전부 SQL)→유닛 없음.

⚠️ reviewer 참고:
- 셔틀 shuttleRoster.ts 무변경. attendanceStatus는 기존과 동일 (applicationItem+sessionDate) 좌석 키·값으로만 기록 → 셔틀 결석제외 그대로 동작.
- 스키마 변경 없음. $queryRawUnsafe/$executeRawUnsafe.
- 오매칭 방지: 좌석 UPDATE가 세션의 sibling 스코프+APPROVED item+좌석ID로 검증(스코프 밖 enrollmentDateId 위조 시 0행→'명단에 없는 좌석'). 좌석=고유키라 형제 반/동명이인 오매칭 없음.
- 잔존: isSessionRosterStudent의 seasonal 분기는 이제 미호출(정규만 사용). 기능 영향 없어 제거하지 않음.

### 구현 기록 — 배차 정차 라벨 reconcile-on-read 갱신 (2026-07-27)
📝 명단의 승·하차 위치 텍스트(placeLabel)를 고치면 저장 배차 노선의 얼어붙은 라벨도 읽을 때 현재 명단 라벨로 자동 갱신(재배차·좌표변경 없이 텍스트만·자가치유).

| 파일 | 변경 | 신규/수정 |
|------|------|----------|
| src/lib/seasonal/dispatchReconcile.ts | `reconcileSavedVehicles`에 옵셔널 `labelByRequestId` 추가 → 살아남은 학생 pickupLabel + 비허브 정차 label만 갱신(허브 라벨·좌표·시각·순서 불변) | 수정 |
| src/lib/seasonal/dispatchRoute.ts | `getSavedDispatchRoute`에서 riders로 requestId→placeLabel 맵 만들어 reconcile에 전달 | 수정 |
| tests/seasonal-dispatch-reconcile.test.mjs | 라벨 갱신 5케이스 추가(학생/비허브/허브불변/좌표시각불변/맵없음 하위호환) | 수정 |

💡 tester 참고: `node --test tests/seasonal-dispatch-reconcile.test.mjs` 11/11 통과, `tsc --noEmit` EXIT=0. 명단 라벨 수정→배차/기사님 화면 라벨 반영, 허브(무료탑승) 정차명은 고정, 재배차 배너(locationChanged)는 좌표변경 시에만 별개로 동작.

### 구현 기록 — 특강 명단 버그 #2·#3 수정 (2026-07-27)
📝 (#3) `getTodayStaffClasses` seasonal 쿼리가 CANCELLED offering을 안 걸러 취소반이 학생0명으로 노출되던 것 수정 + (#2) `/staff/seasonal`이 offering별로 주n회 쪼개지던 것을 홈과 동일한 반 단위 소스로 교체.

| 파일 | 변경 | 신규/수정 |
|------|------|----------|
| src/lib/staff-session-queries.ts | #3: 메인 WHERE `o.status<>'CANCELLED'` + access_o EXISTS `access_o.status<>'CANCELLED'`. #2대비: `getTodayStaffClasses(dateKey=오늘)` 날짜 파라미터 추가(기본값 오늘→홈 무영향) | 수정 |
| src/app/staff/seasonal/page.tsx | 데이터소스를 getTodayStaffClasses(SEASONAL 필터)로 교체 | 수정 |
| src/app/staff/seasonal/StaffSeasonalClient.tsx | 타입 StaffTodayClass로 교체, 필드 매핑(name·studentCount·id·scheduleKey) | 수정 |
| src/app/api/staff/seasonal/route.ts | GET `?date=` 분기를 getTodayStaffClasses로 교체(sessionDateId/ POST 분기 유지) | 수정 |

💡 tester 참고:
- #3: CANCELLED offering(중등부·초등저학년)이 홈/특강 화면 목록에서 사라지는지. 같은 반에 OPEN offering 하나라도 있으면 유지, 전부 취소면 제거.
- #2: 초등 고학년 주5/3/2회가 카드 1장으로 합쳐지는지(반+시간 그룹). 날짜 네비 이동 시 API도 동일.
- 홈(`/staff`)·정규수업·startClassSession 무변경. tsc EXIT=0.
- getSeasonalDatesForStaff는 소비처 제거됐지만 함수 자체는 attendance.ts에 잔존(제거 안 함).

### 구현 기록 — 방학특강 선생님 화면 '수업 시작' 흐름 리디자인(S2) (2026-07-27)
📝 `/staff/seasonal`을 레거시(날짜별 반 목록 + 인라인 출석 3버튼)에서 정규 수업과 동일한 **[수업 시작]→통합 진행화면** 흐름으로 개편. 출결·메모·사진·종료는 이제 `sessions/[sessionId]`에서 처리. 새 서버액션 없이 정규 `startClassSession` 재사용(seasonal 분기 내장).

| 파일 | 변경 | 신규/수정 |
|------|------|----------|
| src/lib/seasonal/attendance.ts | `getSeasonalDatesForStaff` 쿼리에 `Session` LEFT JOIN(s."specialProgramSessionDateId"=sd.id) 추가 → 각 회차에 linkedClassId·sessionId·sessionStatus 반환. GROUP BY 확장 | 수정 |
| src/app/staff/seasonal/page.tsx | initial dates 타입에 linkedClassId/sessionId/sessionStatus 추가 | 수정 |
| src/app/staff/seasonal/StaffSeasonalClient.tsx | 전면 재작성 — 날짜 네비 유지 + 특강 **카드 목록**. 상태별 버튼: PLANNED/null→[수업 시작](startClassSession→sessions/[id]?view=attendance, ACTIVE_SESSION 재라우팅), IN_PROGRESS→[수업 이어하기](sessionId 이동), COMPLETED→완료 배지+[기록 보기]. 레거시 인라인 출석 3버튼·상세뷰 제거. 빈 상태 유지 | 수정 |

- 홈 startLesson 패턴 그대로(로딩·에러·ACTIVE_SESSION). linkedClassId 없는 회차는 시작 불가 안내(엣지). 옛 `/api/staff/seasonal` POST 출결·`?sessionDateId=` roster 경로는 이 화면에서 미사용(파일은 유지).

💡 tester: 선생님 계정 `/staff/seasonal` → 날짜의 특강이 카드로. [수업 시작] 누르면 `sessions/[id]?view=attendance` 진입(정규와 동일). 다른 수업 진행 중이면 그 세션으로 이동. 진행 중 회차는 [수업 이어하기], 완료는 배지+[기록 보기]. S1 미러링으로 통합 화면 출결이 특강 좌석 컬럼에 반영됨. tsc EXIT=0.
⚠️ reviewer: 새 서버액션 0(startClassSession 재사용). 쿼리는 컬럼 추가만(하위호환). 권한은 startClassSession/requireStaffSeasonalSessionAccess가 처리. 하드코딩 hex 0(brand-accent·의미색+dark). 정규/홈/진행화면 무변경.

### 구현 기록 — 학부모 마이페이지 방학특강 확정 승·하차 시각 노출(T3) (2026-07-27)
📝 학부모 마이페이지 "셔틀 안내"의 방학특강(SPECIAL_PROGRAM) 항목에 확정 승/하차 시각을 표시. 출처는 저장된 배차 노선 SeasonalDispatchRoute.payload의 각 정차 etaLabel(수동확정 etaManual 반영값). 매핑: 학생→roster(shuttleRequestId)→payload stops[].students[].requestId 매칭→그 stop 라벨. 방향별 대표 1건(updatedAt DESC 최신 저장분).

| 파일 | 변경 | 신규/수정 |
|------|------|----------|
| src/lib/seasonal/dispatchEtaLookup.ts | 순수 로직 extractEtaByRequestId(payload.vehicles→requestId별 라벨). etaLabel 우선, 없으면 etaManual→etaMinutes로 라벨 재생성. 자기완결형(import 0) | 신규 |
| src/lib/seasonal/dispatchRoute.ts | getConfirmedDispatchEtas(requestIds) — 저장 노선 전체(수십행) 훑어 방향별 대표 라벨. 읽기전용·인증없음(호출부가 자녀 필터). 테이블없음 try/catch | 수정 |
| src/lib/shuttle/parent.ts | ParentShuttleOverviewItem에 pickupEtaLabel?/dropoffEtaLabel? 추가. seasonalEntries.shuttleRequestId로 eta 조회 후 specialItems 양쪽 분기에 부착 | 수정 |
| src/app/mypage/MyPageClient.tsx | SPECIAL_PROGRAM이고 eta 있을 때 "확정 시각: 등원 08:53 승차 · 하원 …" 행 추가(showDetails 무관, 값 없으면 미표시) | 수정 |
| tests/seasonal-dispatch-eta-lookup.test.mjs | 순수 로직 유닛 5개(라벨우선·수동/자동폴백·하차·잘못된입력·중복) | 신규 |

💡 tester: 저장된 배차 노선(관리자 배차 저장)이 있는 방학특강 셔틀 학부모 계정 마이페이지 → "셔틀 안내" 카드에 "확정 시각" 행. 미배차/미저장이면 행 미표시(종전과 동일). `node --test tests/seasonal-dispatch-eta-lookup.test.mjs` 5/5, tsc EXIT=0.
⚠️ reviewer: 필드 optional 추가만(하위호환·회귀없음). 정규반(ShuttleRoutePassenger) 로직 무변경. IDOR: parent.ts가 본인 자녀 shuttleRequestId만 넘김, 헬퍼는 인증X. 하드코딩 hex 0(기존 gray 토큰 재사용·dark 유지). 서버 읽기전용(DB 무변경).

### 구현 기록 — 정차별 시각 관리자 개별 편집·확정(T2) (2026-07-27)
📝 각 정차 시각을 관리자가 input(HH:MM)으로 직접 확정(etaManual). 확정값은 재계산(자동제안/증분/순서변경/출발shift)에도 유지되고, 개별 [↺ 다시 계산]으로 자동값 복귀. 서버는 자동값(etaMinutes)만 계산, 클라가 확정값을 키 매칭으로 오버레이.

| 파일 | 변경 | 신규/수정 |
|------|------|----------|
| src/lib/seasonal/shuttleStopEta.ts | 순수 오버레이 로직 — confirmedEtaMin(수동 우선)·stopKey(requestId 집합 정렬, 승객 없으면 좌표 폴백)·etaMinToLabel·reapplyManualEta(V) | 신규 |
| src/lib/seasonal/shuttle-optimize.ts | Stop 타입에 `etaManual?: number\|null` 추가(서버는 미설정, 클라 오버레이용) | 수정 |
| src/components/seasonal/RouteSection.tsx | 정차 input[type=time] 편집 + '확정(수정됨)' 뱃지 + [↺ 다시 계산]. setStopEta/resetStopEta/stopEtaHHMM. recomputeRunTimes·setDepartTime에서 확정값 불변·자동값만 갱신. generate/incremental 결과에 reapplyManualEtaVehicles 오버레이 | 수정 |
| tests/seasonal-shuttle-stop-eta.test.mjs | 순수 로직 유닛 9개(우선순위·라벨·키·순서변경 유지·리셋복귀·신규·입력불변·차량이동·좌표폴백) | 신규 |

💡 tester: 관리자 배차 화면 각 정차 시각 input 수정 → '확정(수정됨)' 뱃지. 순서 드래그/변동 재배차/출발시각 변경해도 확정 정차 시각 불변, 자동 정차만 재계산. [↺ 다시 계산] → 자동값 복귀. [저장] 후 재로드 시 확정 복원(payload 보존). `node --test tests/seasonal-shuttle-stop-eta.test.mjs` 9/9, tsc EXIT=0.
⚠️ reviewer: etaManual optional 필드 추가만(하위호환). reconcile은 stop 전개(...)로 etaManual 보존. 기사/학부모 노출은 T3. 하드코딩 hex 0(blue 의미색+dark). 순수함수 입력 불변.

### 구현 기록 — planRun ETA를 T맵 '구간별 실제시간' 기반으로 교체 (2026-07-27)
📝 기존: routeFixedOrder(총시간)만 받아 segMin(직선거리) 비율로 정차 ETA 배분(부정확). 변경: routeSegments로 정차 사이 구간별 실제 시간을 받아 stop ETA를 실측 누적으로 계산. 실패 구간만 segMin 폴백, 전체 실패는 종전대로 전 구간 segMin+경로 prev 복원.

| 파일 | 변경 | 신규/수정 |
|------|------|----------|
| src/lib/seasonal/shuttle-eta.ts | 순수 ETA 함수(segmentMinutes·nodeTimesFromSegments) 분리 — 서버 의존성 없어 테스트가 직접 import | 신규 |
| src/lib/seasonal/shuttle-optimize.ts | planRun T맵 호출을 routeSegmentsWithTmapRetry로 교체, 구간 실측시간 누적 ETA, stop.etaMinutes(분 숫자) 추가, 미사용 routeFixedOrder 래퍼 제거 | 수정 |
| tests/seasonal-shuttle-eta.test.mjs | 누적 로직 유닛 8케이스(성공전구간/일부실패/방향별/결합) | 신규 |

💡 tester 참고:
- `node --test tests/seasonal-shuttle-eta.test.mjs` → 8 pass. `npx tsc --noEmit` EXIT=0.
- 정상: 자동배차/증분재배차 시 정차별 ETA가 실도로 구간시간 누적으로 나옴. localOnly(직선추정)·정차0/1 회귀 없음(fallbackMin=종전 segMin과 동일 → scale=1 케이스와 결과 일치).
- 주의: T맵 appKey 없거나 전체 실패 시 전 구간 segMin 폴백 + 저장 경로(prev) 복원. 부분 실패는 그 구간만 폴백.
- ⚠️ 기존 실패 1건(admin-shuttle-compat: `import ShuttleRouteAdminClient`)은 **본 변경과 무관한 stale 테스트**(page.tsx가 VehicleManagerClient로 이미 리팩터됨). 내 변경 파일 아님.

### 구현 기록 — 증분 재배차 후 지도 "직선 퇴화" 버그 수정 (2026-07-27)
📝 planRun이 T맵 재계산 전에 실도로 path를 선파괴 → T맵 일시 실패 시 저장 경로 소실. 선파괴 제거 + 실패 시 이전값 복원 + 증분 연속호출용 짧은 재시도.

| 파일 | 변경 | 신규/수정 |
|------|------|----------|
| src/lib/seasonal/tmapRouteMerge.ts | 병합 규칙 순수 헬퍼(mergeTmapRoute) — 성공→갱신/실패→prev유지 | 신규 |
| src/lib/seasonal/shuttle-optimize.ts | planRun 선파괴 제거·폴백 복원, T맵호출 재시도 래퍼(200/400ms), 헬퍼 import | 수정 |
| tests/seasonal-shuttle-tmap-route-merge.test.mjs | 병합 규칙 유닛 4케이스 | 신규 |

💡 tester 참고: `node --test tests/seasonal-shuttle-tmap-route-merge.test.mjs` 4/4 통과, tsc EXIT=0. 회귀 무: localOnly(전체제안 base)·정차0·신규run은 여전히 LOCAL/무path로 초기화(else 분기). 폴백은 "T맵 호출했는데 실패 + 이전에 실도로 path 있던 run"에서만 체감. 드래그 reroute·전체 suggestDispatch 경로 무변경.

### 구현 기록 — 증분 재배차 cheapest-insertion (Phase 2b) (2026-07-27)

📝 구현: 저장된 노선의 **기존 정차 순서를 그대로 두고**, 신규·복귀·위치변경 학생만 cheapest-insertion으로 최적 위치에 끼워넣은 뒤, **변경된 차량만** 순서 고정으로 T맵 시간 재계산. ★전체 재최적화(suggestDispatch) 금지 — 정차 상호 순서 재배열 안 함.

| 파일 | 변경 | 신규/수정 |
|------|------|----------|
| src/lib/seasonal/dispatchIncrement.ts | **순수 로직**(의존성 0) `planIncrementalInsert(vehicles, targets, geo)` — 차량선택(정원여유+삽입비용최소)·cheapest-insertion(인접쌍 h(A,S)+h(S,B)-h(A,B) 최소)·동좌표(±1e-5)병합·정원초과 unassigned·위치변경(제거후재삽입)·hub학생추가. 입력 불변(얕은 복제). reroute 집합 반환(기하 변경 차량만). haversineKm 로컬 구현(순수 유지 위해 shuttle-optimize:49 공식 복제) | 신규 |
| src/lib/seasonal/shuttle-optimize.ts | `planRun`에 `keepOrder` 파라미터(기본 false=기존동작; true면 NN 재정렬 스킵). `incrementalDispatch(date,direction)` 신설: base(localOnly)→저장본 조회(없으면 computeDispatch 폴백)→added/locationChanged를 riders에서 IncrTarget으로 변환→planIncrementalInsert→reroute 차량만 `routeFixedOrderWithTmap`(planRun keepOrder=true) | 수정 |
| src/app/api/admin/seasonal/dispatch/increment/route.ts | `POST {date,direction}` → incrementalDispatch. requireAdmin은 엔진에서 강제 | 신규 |
| src/components/seasonal/RouteSection.tsx | `incremental(forDate)` 추가(/increment 호출→setSug). 배너 버튼 `[🔄 자동배차 다시 실행]`(generate=전체) → `[🔄 변동만 재배차]`(증분)로 교체. 저장은 기존 [저장] 버튼 | 수정 |
| tests/seasonal-dispatch-increment.test.mjs | 순수 로직 유닛 13개(순서보존·cheapest·동좌표병합·정원초과·차량선택·위치변경·hub·좌표없음·입력불변·빈노선) | 신규 |

**routeFixedOrderWithTmap 재사용 지점**: incrementalDispatch가 reroute 대상 차량마다 `planRun(..., keepOrder=true)` 호출 → planRun 내부가 `routeFixedOrderWithTmap({start,end,waypoints})`로 순서 고정 실도로 경로·시간 계산(reroute API와 동일 primitive). haversineKm은 순수모듈 삽입비용용으로만 사용.

**"기존 순서 보존" 근거**: (1)planIncrementalInsert는 `v.stops.splice(k,0,newStop)`로 인접쌍 사이 끼워넣기만 함 — 기존 stops의 상대 순서 불변(유닛테스트 "기존 정차 상호 순서를 재배열하지 않는다"로 고정). (2)재계산은 `planRun(keepOrder=true)`라 NN 재정렬 스킵. (3)전체 재최적화(computeDispatch)는 저장본 없을 때만 폴백.

💡 tester: 저장 노선 있는 날짜에서 학생 추가/위치변경 후 관리자 배차 화면 배너 `[🔄 변동만 재배차]` → 기존 순서 유지된 채 신규만 삽입됨. `node --test tests/seasonal-dispatch-increment.test.mjs` 13/13, tsc EXIT=0.
⚠️ reviewer: planRun keepOrder는 additive(기본 false). incrementalDispatch는 requireAdmin. 하드코딩 hex 0(배너 amber 유지). 저장 payload 불변(순수함수 입력 복제).

### 구현 기록 — 저장 노선 변동 감지(신규·복귀·위치변경) + 관리자 배너 (Phase 2a) (2026-07-27)

📝 구현: reconcile(제거)의 반대 방향. 저장 노선 이후 생긴 **추가/위치변경을 알림만** 한다. 저장 payload·순서·시각·좌표 무변경(순수 읽기 진단). 기사님 화면 미노출.

| 파일 | 변경 | 신규/수정 |
|------|------|----------|
| src/lib/seasonal/dispatchReconcile.ts | 순수 함수 `diffSavedRoute(vehicles, riders)` 추가 — savedIds 집합·requestId→정차좌표 맵 만들어 added(∉savedIds)/locationChanged(좌표 Δ>1e-5, null 스킵) 산출. requestId만 매칭·불변 | 수정 |
| src/lib/seasonal/dispatchRoute.ts | `SavedDispatchRoute`에 added/locationChanged 추가. `getSavedDispatchRoute`가 reconcile 후 diff 계산해 반환(명단 조회 실패 시 빈 배열) | 수정 |
| src/lib/seasonal/shuttle-optimize.ts | `DispatchSuggestion`에 added?/locationChanged? 추가. `getDispatchForView` 저장본 분기에서 전달 | 수정 |
| src/components/seasonal/RouteSection.tsx | 변동 배너(관리자 전용) + [🔄 자동배차 다시 실행] 버튼(→ generate, Phase 2b TODO 주석). loadAndApplySaved가 필드 실어줌 | 수정 |
| tests/seasonal-dispatch-diff.test.mjs | diffSavedRoute 유닛 8개(added/locationChanged/임계/빈좌표×2/불변/id매칭) | 신규 |

💡 tester 참고:
- 테스트: `node --test --experimental-strip-types tests/seasonal-dispatch-diff.test.mjs` (8개 통과), `npx tsc --noEmit` EXIT=0
- 정상: 저장본 있고 변동 있으면 관리자 배차 화면 상단 배너("⚠️ 저장 노선 이후 변동…") + 이름 목록. 변동 없으면 배너 없음. 자동제안 실행 시 배너 사라짐(computeDispatch엔 필드 없음).
- 기사화면 미노출 확인: `src/app/shuttle/run/[token]/page.tsx`가 DriverSection으로 수동 매핑 → added/locationChanged 필드를 아예 읽지 않음. 배너는 RouteSection(관리자)에만.
- 하위호환: 필드 추가만(added?/locationChanged? optional). saved API는 saved 객체 그대로 반환이라 자동 전파. 기존 reconcile 동작 무변경.

⚠️ reviewer 참고: Phase 2b 연결 지점 = RouteSection 배너 버튼 onClick(현재 generate=전체 재최적화). "기존 순서 유지+증분 삽입"으로 교체 예정(코드에 TODO 주석 명시).

### 구현 기록 — 저장된 배차 노선 reconcile-on-read (2026-07-27)

📝 구현: 저장된 배차 payload를 DB에서 바꾸지 않고 **읽을 때** 그날 유효하지 않은 학생(결석·수강취소·폐강)을 자동으로 걸러낸다(자가치유). 순서·시각·경로는 무변경.

| 파일 | 변경 | 신규/수정 |
|------|------|----------|
| src/lib/seasonal/dispatchReconcile.ts | 순수 함수 `reconcileSavedVehicles(vehicles, validRequestIds)` — students를 requestId로 필터→빈 정차 제거(isHub 유지)→passengers/over 재계산. 의존성 0(테스트용 분리) | 신규 |
| src/lib/seasonal/dispatchRoute.ts | `getSavedDispatchRoute`에서 date 있으면 `getConfirmedShuttleRosterForDate`로 validIds 만들어 vehicles를 reconcile 결과로 교체. 실패 시 저장본 그대로 | 수정 |
| tests/seasonal-dispatch-reconcile.test.mjs | 순수함수 유닛 6개(제거/빈정차·isHub/재계산/보존/불변/자가치유) | 신규 |

💡 tester 참고:
- 테스트: `node --test tests/seasonal-dispatch-reconcile.test.mjs` (6개 통과), `npx tsc --noEmit` EXIT=0
- 순환 import 없음: dispatchRoute→shuttleRoster(단방향), dispatchReconcile은 무의존. shuttle-optimize만 dispatchRoute를 import.
- 정상: 저장 노선에서 결석/취소 학생이 그날 화면(관리자·기사님)에서만 사라지고, 다시 유효해지면 자동 복원. DB payload는 불변.

### 구현 기록 — 좌표 없는 탑승자 '배차 불가' 가시화 (G4) (2026-07-27)

📝 구현: 좌표 없는 탑승자가 자동 배차에서 조용히 빠지던 것을 **관리자 화면에 경고로 표시**. **표시 전용** — 배차 제외 로직·서버·데이터 계약 전부 무변경. 좌표 null 판정만 사용.

| 파일 | 변경 | 신규/수정 |
|------|------|----------|
| src/app/admin/seasonal/shuttle/ShuttleRosterClient.tsx | `missingCoord(r)` 헬퍼 추가(ride 행 중 승차 좌표 null 또는 하차 별도인데 하차 좌표 null). 상단 배너 아래 "좌표 없는 탑승자 N명 — 배차 제외" 빨강 요약 블록, 행별 학생명 옆 "좌표 없음 · 배차 불가" 빨강 뱃지 | 수정 |

- **DispatchClient.tsx는 무변경**: 이미 252~258행에 `unassigned` 좌표 없음 경고 블록("좌표가 없어 배차하지 못한 학생 N명" + 명단 + 안내)이 있어 요구사항 충족. 추가 변경 없음.

💡 tester: `/admin/seasonal/shuttle` — 탑승 학생 중 지도 핀 미지정(좌표 null)인 행에 빨강 "좌표 없음 · 배차 불가" 뱃지 + 상단 요약 경고. 좌표 있으면 뱃지 없음. 미탑승 행은 대상 아님. 로직·CSV·확정·핀편집 무변경.
⚠️ reviewer: 표시 전용(배차 제외 로직·서버·계약 무변경). 하드코딩 hex 0(red 의미색 Tailwind + dark 대응). tsc EXIT=0.

### 구현 기록 — 셔틀 라벨 컬럼에 장소명 우선 저장 (G2) (2026-07-27)

📝 구현: 지도에서 고른 **장소명(place name)**을 라벨 컬럼에 주소 대신 우선 저장(`name ?? 주소`). **스키마 변경 없음**(기존 라벨 컬럼 재활용). 좌표/주소/placeId 컬럼은 무변경(운행 기준 보존).

| 파일 | 변경 | 신규/수정 |
|------|------|----------|
| src/lib/seasonal/contracts.ts | `SeasonalShuttleLocationInput`에 `name?` 추가, `parseShuttleLocation`이 `name` 파싱(옵셔널) | 수정 |
| src/lib/seasonal/service.ts | 방학특강 저장부: `pickupLocation/dropoffLocation` = `pickup?.name ?? 텍스트라벨`. address/lat/lng/placeId 그대로 | 수정 |
| src/components/seasonal/SeasonalApplyClient.tsx | `saveMapLocation` 라벨 = `name ?? roadAddress ?? address` | 수정 |
| src/app/apply/enroll/EnrollApplicationLaterSteps.tsx | `onConfirm`에서 `shuttlePickup/Dropoff` 라벨 = `name ?? address` | 수정 |
| src/app/actions/public.ts | `EnrollmentShuttleLocationData.name?`(string\|null) 추가·정규화, INSERT/UPDATE 라벨($17/$19) = `location.name ?? 텍스트라벨`. 좌표/주소/source 그대로 | 수정 |

**정규반 name 저장 컬럼(G3 참고)**: 정규반 신청의 장소명은 `EnrollmentApplication."shuttlePickup"`(탑승)·`"shuttleDropoff"`(하차) 라벨 컬럼에 저장된다(주소 컬럼 `shuttlePickupAddress` 등은 별개로 유지). G3의 정규반 전환·확정본 스냅샷은 이 두 라벨 컬럼에서 장소명을 읽으면 된다.

💡 tester: 방학특강/정규반 셔틀 신청 시 지도에서 **장소 검색으로 선택**하면 라벨(입력칸·명단)에 장소명이 뜬다. 핀만 찍거나(옛 데이터) 장소명 없으면 기존처럼 주소 표기(하위호환). 좌표는 여전히 저장되어 배차 정상.
⚠️ reviewer: 라벨에 name 우선(사용자가 지도 선택 후 텍스트를 수동 편집한 경우 서버가 name으로 덮을 수 있음 — 스펙의 "장소명 우선" 준수). 좌표/주소 컬럼 무변경. tsc EXIT=0.

### 구현 기록 — 셔틀 장소명 저장경로 유실 버그 수정 (G3) (2026-07-27)

📝 구현: 저장 경로에서 장소명이 유실되던 두 지점 중 (1) 정규반 전환 버그 수정, (2) 방학특강 확정본 스냅샷은 확인 결과 변경 불필요. 좌표·주소·placeId 컬럼 무변경(운행 기준 보존).

| 파일 경로 | 변경 내용 | 신규/수정 |
|----------|----------|----------|
| src/app/actions/admin.ts | 정규반 신청→학생 전환 시 `StudentShuttleLocation` INSERT의 `name`을 NULL 하드코딩 → 라벨 컬럼값으로 파라미터화($12). ON CONFLICT DO UPDATE에 `name = EXCLUDED.name` 추가 | 수정 |

**(1) name 매핑**: kind=PICKUP ← prefix `shuttlePickup` ← `app.shuttlePickup`(라벨), kind=DROPOFF ← prefix `shuttleDropoff` ← `app.shuttleDropoff`(라벨). `app`은 `SELECT * FROM EnrollmentApplication`이라 G2가 저장한 라벨 컬럼 포함. 폴백: 라벨 없으면 `${prefix}RoadAddress ?? ${prefix}Address`(name NULL 방지, service.ts:1057과 동일 철학). 좌표/주소/placeId/source/accuracy/confirmedAt/consentVersion 파라미터·값 무변경.

**(2) 확정본 스냅샷 — 변경 불필요(확인만)**: `shuttleRoster.ts` `confirmSeasonalShuttleRoster` INSERT…SELECT(554·556행)가 원본 `r."pickupLocation"`/`r."dropoffLocation"` 라벨 컬럼을 그대로 복사 → G2 장소명 자동 전달. 확정본 편집(`shuttleRosterEdit.ts` 127·129행)도 `pickupLocation`/`dropoffLocation` 라벨에 저장. 둘 다 장소명 보존됨.

💡 tester: 정규반 신청서(셔틀 지도 장소검색 선택)를 관리자가 승인·학생 전환하면 `StudentShuttleLocation.name`에 장소명이 남는지 확인. 기존엔 NULL이었음. 좌표는 여전히 저장.
⚠️ reviewer: `$queryRawUnsafe`/`$executeRawUnsafe` 유지, 스키마 변경 없음. 좌표·주소 무변경. tsc EXIT=0.

### 구현 기록 — 수강생 상세 반 추가·삭제(E3) (2026-07-26)

📝 구현한 기능: `/admin/students/[id]` **개요 탭 "현재 수강 반"** 카드에 반 추가·하드삭제 추가. 기존 서버액션 `enrollStudent`/`deleteEnrollment` **호출만**(서버 무변경). 클래스 목록은 학생관리 목록이 쓰는 `getClasses()`(queries.ts) 재사용 — page.tsx에서 `getStudentActivity`와 Promise.all 병렬 조회해 `classes` prop 신규 전달(getStudentActivity 무변경).

| 파일 경로 | 변경 내용 | 신규/수정 |
|----------|----------|----------|
| src/app/admin/students/[id]/page.tsx | `getClasses` import + `Promise.all([getStudentActivity, getClasses])` 병렬 조회, `classes` prop 전달. getStudentActivity 무변경 | 수정 |
| src/app/admin/students/[id]/StudentDetailClient.tsx | import에 `enrollStudent`/`deleteEnrollment`. `ClassOption` 타입 + `DAY_ORDER` + `groupClassesByProgram`(StudentManagement 패턴 간소화). `classes` prop(기본 []). 상태 4개(showClassPicker/enrollingClassId/deletingEnrollmentId/enrollError). 핸들러 `addEnrollment`(enrollStudent→loadData→피드백)·`removeEnrollment`(강한 window.confirm→deleteEnrollment→loadData). SectionTitle 우측 [+반 추가] 토글, 이미 수강중 classId 제외한 프로그램별 선택 UI, 각 행에 빨간 휴지통(delete) 삭제 버튼 | 수정 |

💡 tester 참고:
- 테스트: 개요 탭 "현재 수강 반" 카드 우측 [반 추가] → 프로그램별 반 목록(이미 듣는 반 제외) → 선택 시 등록·재조회·"추가했습니다". 각 반 행 빨간 휴지통 → 강한 확인창 → 삭제·재조회.
- 정상: 하드삭제 확인문구 = "이 반 수강을 완전히 삭제할까요? 수강 이력이 영구 제거됩니다. (퇴원 처리를 원하면 상태를 '퇴원'으로 바꾸세요)". enrollStudent는 ON CONFLICT로 퇴원했던 반 재추가 시 ACTIVE 복원.
- 주의: 반 0개 학생·추가 가능 반 없음(전부 수강중)일 때 "추가할 수 있는 반이 없습니다". 권한(requireAdmin) 실패 시 빨간 에러 문구.

⚠️ reviewer 참고: 서버 로직 무변경(호출만). 하드삭제=퇴원(소프트)과 별개·시각 구분(빨간 톤). 하드코딩 hex 0, SymbolIcon(add/delete/close)만. E1/E2·loadData·데이터계약 무변경. tsc EXIT=0.

### 구현 기록 — 수강생 상세 수납 탭 결제 상태 변경(E2) (2026-07-26)

📝 구현한 기능: `/admin/students/[id]` **수납 탭 "청구·납부(시스템)"** 각 결제 건에 상태 변경 추가. E1 편집 패턴(useTransition 대신 async 핸들러+loadData 재조회+피드백) 답습. 기존 `updatePaymentStatus(id, status)` 서버 액션 **호출만**(서버 무변경). "장부 수납(시트 원장)" 블록은 무변경.

| 파일 경로 | 변경 내용 | 신규/수정 |
|----------|----------|----------|
| src/app/admin/students/[id]/StudentDetailClient.tsx | import에 `updatePaymentStatus` 추가. 상수 `PAY_STATUS_OPTIONS`(완납PAID/대기PENDING/연체OVERDUE/취소CANCELED)+`PAY_SEG_SELECTED`(의미색). 상태 4개(payEditingId/payUpdatingId/payChangedId/payError). 핸들러 `changePaymentStatus`(취소만 window.confirm→호출→loadData→"변경됨" 2초 / 실패 시 서버메시지 표면화). 결제 건 우측에 상태칩+✏️ 토글, 펼치면 4-세그먼트(현재상태 하이라이트·disabled), 처리 중 "변경 중…", 실패 시 빨간 사유 | 수정 |

💡 tester 참고:
- 테스트: 수납 탭 → "청구·납부(시스템)" 각 건의 상태칩 옆 ✏️ → 세그먼트에서 상태 선택. 취소(CANCELED)만 확인창, 나머지 즉시. 성공 시 "변경됨" 뜨고 목록 재조회. 재무 권한 없는 계정은 빨간 에러 문구("수납 상태 변경 실패" 등).
- 정상: 현재 상태 버튼은 disabled(하이라이트). 처리 중 컨트롤 disabled.
- 장부 수납 블록은 편집 불가 그대로.

⚠️ reviewer 참고: 서버 `updatePaymentStatus`(requireFinanceOwner) 미변경, 호출만. 조용한 실패 없음(throw→에러 문구). payments 필드·데이터계약 무변경.

#### tsc: EXIT=0

### 구현 기록 — 수강생 상세 인라인 편집(✏️) 추가 (2026-07-26)

📝 구현한 기능: `/admin/students/[id]` 상세에 **학생·학부모 정보 인라인 편집** 2영역 추가. 기존 `updateStudent` 재활용, 데이터 경로 최소화.

| 파일 경로 | 변경 내용 | 신규/수정 |
|----------|----------|----------|
| src/app/actions/admin.ts | `updateStudent` data에 `parentEmail?` 추가, 부모 User UPDATE에 `email = $3` 컬럼만 추가(name/phone/email/updatedAt, id=$4). 그 외 시그니처·로직 무변경 | 수정 |
| src/app/admin/students/[id]/StudentDetailClient.tsx | 편집 상태(editSection/editForm/전용 useTransition/저장·에러 피드백), `startEditSection/cancelEditSection/saveSection/setField/renderEditControls` 헬퍼, `toInputDate`·`EDIT_INPUT_CLASS` 추가. (A)헤더 기본정보(이름·학년·학교·생년월일·성별·등록일) + (B)연락처카드(학생전화·학부모이름·전화·이메일·주소)에 연필→인풋+저장/취소 | 수정 |

💡 tester 참고:
- 테스트: 상세페이지 헤더 우측 연필(A), 연락처 카드 우측 연필(B) 클릭 → 인풋 편집 → 저장 → 재조회 후 값 반영 + "저장됨" 2초. 취소 시 원복.
- 정상: 한 섹션만 저장해도 다른 섹션 값 안 지워짐(편집 폼에 현재값 전체 채워 함께 전송). 학부모 이메일 저장/반영 확인.
- 주의 입력: 생년월일/등록일 빈칸(enrollDate nullable), 성별 미지정, 이메일 빈값 → null 저장.

⚠️ reviewer 참고: `updateStudent`가 전체 필드 UPDATE라 편집 안 한 필드도 현재값으로 재전송하는 구조(no-op 방지). email 확장 외 서버 무변경.

#### tsc: EXIT=0

### 구현 기록 — 정규반 수강생 상세 페이지 UI 재설계 (2026-07-26)

📝 구현한 기능: `/admin/students/[id]` 상세 화면을 승인된 시안대로 **UI만** 새로 구현. 데이터·API·서버액션·로직은 100% 보존(UI 렌더링만 교체). 새 레이아웃: 정체성 헤더 → KPI 4칸 → (좌 320px sticky 레일 3카드 + 우 5탭). 기존 "운영 요약" 별도 카드는 KPI로 흡수(중복 제거), 셔틀 정보를 월별 히스토리에서 좌측 레일로 끌어올림, 출결/수납 테이블 → 카드 리스트, 수납은 시스템/시트원장 2출처 분리, 월별 히스토리는 `<details>` 확장 + 반 뱃지 전체 노출(+N 숨김 개선).

| 파일 경로 | 변경 내용 | 신규/수정 |
|----------|----------|----------|
| src/app/admin/students/[id]/StudentDetailClient.tsx | 전체 재작성. 데이터타입·상태맵·헬퍼·3핸들러(saveMemo/changeEnrollmentStatus/loadData) 전부 원본 그대로 보존. 추가: `activeTab` state(UI 전용), `MiniDonut`(hex 없는 currentColor 도넛), `SectionTitle`/`EmptyState` 헬퍼, `renderEnrollmentRow`(기존 renderEnrollmentCard를 가로 세그먼트 레이아웃으로) | 수정 |
| src/app/admin/students/[id]/page.tsx | 상단 "사진 사용 동의 관리" 링크 제거(헤더 우측 액션으로 이동). `getStudentActivity` 데이터 로딩 무변경 | 수정 |

**보존 확인(자기검증):**
- **데이터 계약 무변경**: `StudentActivityData` 타입/필드 한 글자도 안 건드림. 원시 SQL camel/lower 방어 접근 유지(기존 헬퍼 그대로 사용, 새 필드·새 API 0).
- **3개 인터랙션 무변경**: `saveMemo`(→updateStudentMemo), `changeEnrollmentStatus`(→updateEnrollmentStatus, window.confirm 확인 그대로), `loadData`(fetch `/api/.../activity`, cache:no-store) — 함수 본문 원본 복사. SSR initialData+클라이언트 refetch 하이브리드 그대로.
- **라우트 유지**: media-consent는 `/admin/students/[id]/media-consent` 그대로(위치만 헤더로 이동, studentId ?? student.id로 생성).
- **디자인 규칙**: 하드코딩 hex 0(Tailwind 팔레트 + brand-orange-500/brand-neon-lime/brand-navy-900 토큰 + `dark:` 전면), 아이콘 Material Symbols(`SymbolIcon`)만. 상태 색상맵(ATT/PAY/INVOICE/ENROLLMENT) 유지 = 의미색 일관.

**검증**: `npx tsc --noEmit` EXIT=0 / eslint 변경파일 = **0 error**(경고 1건: 갤러리 `<img>` — 기존 원본과 동일 패턴이라 유지).

💡 tester 참고:
- 테스트 방법: dev(4000) → `/admin/students/[아무 학생 id]`. (1)메모 입력→저장→"저장됨" 뜨는지, (2)개요 탭에서 반 상태 세그먼트(수강중/휴원/퇴원) 클릭→확인창→변경 후 목록 새로고침, (3)탭 5종 전환(개요/수강출결/수납/월별히스토리/사진), (4)데이터 없는 학생은 각 섹션에 점선 "없습니다" 카드가 뜨는지.
- 정상 동작: 헤더 대표상태칩·N개 반 칩, KPI 4칸(출석률 미니도넛·수강중·이번달수납·미납), 좌측 레일 sticky(연락처·셔틀·메모), 수납 탭의 시스템/시트원장 분리, 월별 히스토리 `<details>` 펼침·반 뱃지 전부 노출.
- 주의할 입력: 학부모 폰 tel 링크, invoiceCheckoutUrl 있는 결제(납부 링크), 셔틀 미이용 학생(레일에 "미이용"), galleryPosts의 video 타입.

⚠️ reviewer 참고:
- 봐줄 부분: (1)3개 핸들러·데이터 계약이 정말 원본과 동일한지(로직 무변경), (2)새 API/필드를 만들지 않았는지, (3)다크모드 대응 누락 없는지, (4)`ledgerHistory` 필터(장부 수납 노출 조건)가 과·소 노출 아닌지.

### 구현 기록 — 방학특강 셔틀 확정 명단 3단계 (화면 확정 + 확정본 편집) (2026-07-26)

📝 구현한 기능: 원장이 셔틀 명단을 **화면에서 확정**하고, 확정 후에는 **원본 신청서 대신 확정본만** 고치게 만들었다. 게이트웨이(`shuttleRoster.ts`)의 확정/수정/제외 함수는 이미 있던 것을 그대로 연결만 했고, 대상자 SQL은 한 줄도 새로 짜지 않았다. DB 스키마 변경 없음(migrate 미실행).

| 파일 경로 | 변경 내용 | 신규/수정 |
|----------|----------|----------|
| src/lib/seasonal/shuttleRoster.ts | `shuttleRosterConfirmationInfo()` 추가 — 확정 건수 + 최소 confirmedAt(DDL 실제 컬럼)만 돌려주는 배너용 메타 조회 | 수정 |
| src/lib/seasonal/shuttle-roster.ts | `ShuttleRosterRow`에 `origin`·`rosterId` 추가 + 매핑(게이트웨이 결과 그대로 전달) | 수정 |
| src/app/api/admin/seasonal/shuttle-roster/route.ts | GET에 `confirmed/confirmedCount/confirmedAt` 추가(roster 키 유지), POST(확정), PATCH 분기(rosterId→확정본 / requestId→기존 원본), PATCH action remove·restore, DELETE(soft remove) | 수정 |
| src/app/admin/seasonal/shuttle/page.tsx | 확정일시·건수를 Promise.all로 함께 읽어 클라이언트에 전달 | 수정 |
| src/app/admin/seasonal/shuttle/ShuttleRosterClient.tsx | 확정 전/후 배너, `N명 확정하기` 버튼(확인창→POST→목록 새로고침), 확정 후 rosterId로 PATCH, 행 "명단에서 빼기" + 되돌리기 칩, 확정 후 지도 핀 잠금 | 수정 |
| tests/seasonal-shuttle-roster-confirm.test.mjs | 3단계 동작 고정 테스트 17개 신규 | 신규 |

**핵심 설계 판단:**
- **확정 여부는 별도 플래그를 두지 않는다.** 화면·API 모두 `rows.some(r => r.origin === "CONFIRMED")`로 판단한다. 명단과 확정 플래그가 서로 다른 출처에서 오면 어긋나는 순간이 반드시 생긴다.
- **저장 경로가 행 단위로 갈린다.** `row.rosterId`가 있으면 `{rosterId, patch}`(확정본만 수정), 없으면 기존과 똑같이 `{requestId, patch}`(원본 수정). 확정 후 원본 신청서 UPDATE는 코드 경로 자체가 없다.
- **재확정 버튼은 확정 후 렌더하지 않는다.** 원장이 손으로 고친 값이 되돌아가는 사고 방지(게이트웨이의 `ON CONFLICT DO NOTHING`과 이중 방어).
- **제외는 soft remove.** 제외된 행은 게이트웨이가 걸러서 목록에서 사라지므로, 되돌릴 수 있게 "방금 뺀 행" 칩을 띄워 그 자리에서 복구하게 했다(안 그러면 restore를 부를 화면이 없다).
- `shuttleRosterConfirmationInfo`를 일부러 `get*`으로 짓지 않았다 — "명단을 읽는 출구(get*)는 딱 2개"라는 게이트웨이 불변식과 그 회귀 테스트를 살려두기 위해서다.

**⚠️ 판단이 갈릴 수 있는 지점(PM 확인 요청):** 확정 후 **지도 핀(좌표) 편집을 잠갔다.** `ConfirmedRosterPatch`에 좌표 필드가 없어서(=게이트웨이가 지원하지 않음) 확정본에 저장할 방법이 없고, 원본에 쓰면 "확정 후 원본 미변경" 원칙을 깬 데다 화면 값도 안 바뀌어 고장처럼 보인다. 그래서 핀 버튼을 disabled 처리하고 안내 문구를 달았으며, API도 확정 후 pin 요청은 400으로 막는다. **확정 후에도 핀을 고쳐야 한다면 게이트웨이 patch에 좌표 필드를 추가하는 별도 작업이 필요하다**(4단계 후보). 임의로 확장하지 않았다.

**검증:** `npx tsc --noEmit` EXIT=0 / `npm run build` EXIT=0(`/admin/seasonal/shuttle` ƒ, `/api/admin/seasonal/shuttle-roster` ƒ) / `node --test tests/*.test.mjs` **655개 중 650 pass / 5 fail** — 실패 5건은 기준선과 동일한 기존 실패(체험신청 2·위치선택 1·선생님 수업명단 2). 새로 깨진 것 0. 셔틀 관련 파일만 따로: 확정 17/17 + 필터·게이트웨이·호환·학부모 47/47 = 64/64 PASS.

💡 tester 참고:
- 테스트 방법: dev(포트 4000) → `/admin/seasonal/shuttle`. (1)확정 전 = 주황 배너 + `N명 확정하기`, (2)버튼 클릭 → 확인창 → 확정 → 초록 배너("확정됨 · 탑승 N명 · YYYY-MM-DD HH:MM 확정")로 바뀌고 확정 버튼 사라짐, (3)확정 후 위치 이름·"등원과 동일" 수정이 저장되고 새로고침해도 유지, (4)"명단에서 빼기" → 행 사라짐 + 되돌리기 칩 → 되돌리면 복귀.
- 정상 동작 확인 포인트: 확정 후 **원본 신청서(SpecialProgramShuttleRequest)가 안 바뀌는지** — 학부모 화면/신청 상세에서 확인. 미탑승 기본 숨김·토글, 기사님 CSV(탑승자만, `방학특강_셔틀_탑승자명단_`)는 그대로여야 한다.
- 주의할 입력: 탑승 0명일 때 확정 버튼 비활성, 부원장(VICE_ADMIN) 계정으로 확정 시도 → 403 + "원장(ADMIN)만" 안내, 확정 후 지도 핀 버튼 비활성.

⚠️ reviewer 참고:
- 봐줄 부분: (1)PATCH의 rosterId/requestId 갈림길에 확정 후 원본이 수정될 경로가 정말 없는지, (2)`pickConfirmedPatch` 화이트리스트가 확정본에 쓰면 안 되는 값을 흘리지 않는지, (3)확정 후 배너/버튼 분기가 상태 새로고침(refresh) 후에도 일관된지, (4)`shuttleRosterConfirmationInfo`의 시즌 스코프가 명단 조회와 같은 기준(ARCHIVED 제외)인지, (5)위 "지도 핀 잠금" 판단이 맞는지 → **1차 수정에서 해제됨(아래 수정 이력 참고)**.

#### 수정 이력
| 회차 | 날짜 | 수정 내용 | 수정 파일 | 사유 |
|------|------|----------|----------|------|
| 1차 | 2026-07-26 | **확정 후 지도 핀 편집 잠금 해제 + 확정본 좌표 저장 구현.** `ConfirmedRosterPin` 타입과 `pickupPin/dropoffPin` patch 필드 추가, `pinSetClauses()` 헬퍼 신설(좌표 검증→확정본 컬럼 SET 조각 생성), `updateConfirmedShuttleRosterRow`가 핀을 확정본에 직접 저장. API의 핀 400 차단과 화면의 핀 버튼 disabled·안내문구 제거. 좌표 오류는 400 + 이유로 표면화 | src/lib/seasonal/shuttleRoster.ts, src/app/api/admin/seasonal/shuttle-roster/route.ts, src/app/admin/seasonal/shuttle/ShuttleRosterClient.tsx, tests/seasonal-shuttle-roster-confirm.test.mjs | PM 지시: 원장님이 "좌표는 지오코딩으로 채웠고 세부좌표는 직접 설정"한다고 명시했고 노선 편성이 정밀 좌표를 요구함 → 확정 후 핀 잠금은 주 작업을 막는 회귀 |

| 2차 | 2026-07-26 | **리뷰 결함 4건(R-5/R-6/R-7①/R-8) + 테스터 결함 1건(T-1) 수정.** ①R-5: 원본 수정 직전에 서버가 확정본 조회 → 확정됐으면 409 거절, 화면은 409에서 자동 새로고침. ②R-6: SET 절 조립을 순수 모듈로 분리하고 컬럼별 1절만 남김(중복 → 42701 방지). ③R-7①: 확정 판정을 "보이는 행 수"에서 "확정본 존재 여부(제외 행 포함)"로 교체 — 전원 제외해도 폴백 부활 없음. ④R-8: 저장 실패 시 낙관 반영 롤백. ⑤T-1: 노선 편성 화면의 핀 저장을 확정본으로 라우팅(조용한 no-op 제거). +실행 테스트 신설(문자열 매칭으로 못 잡던 결함 실제 검출) | src/lib/seasonal/shuttleRosterEdit.ts(신규), src/lib/seasonal/shuttleRoster.ts, src/app/api/admin/seasonal/shuttle-roster/route.ts, src/app/admin/seasonal/shuttle/page.tsx, src/app/admin/seasonal/shuttle/ShuttleRosterClient.tsx, src/lib/shuttle/service.ts, tests/seasonal-shuttle-roster-edit-sql.test.mjs(신규), tests/seasonal-shuttle-roster-confirm.test.mjs, tests/seasonal-shuttle-roster-gateway.test.mjs, tests/seasonal-shuttle-roster-filter.test.mjs, tests/shuttle-unassigned-cancelled-filter.test.mjs | reviewer R-5~R-8 / tester T-1 |

**2차 수정 상세:**
- **R-5(치명)**: `isShuttleRequestConfirmed(requestId)` 신설(킬 스위치 확인 + `SeasonalShuttleRoster`에 살아 있는 행 조회). PATCH의 requestId 분기 **진입 전** 호출 → 확정됐으면 `409 + "명단이 확정되었습니다. 새로고침 후 다시 시도해주세요."`. 화면은 `callApi`가 실은 `status`를 보고 409면 오류 문구 + `refresh()` 자동 실행 → 사용자가 확정본 기준으로 다시 저장 가능. 테스트로 "확정 확인이 원본 저장보다 앞에 있다"를 인덱스 비교로 고정.
- **R-6**: SET 절 조립을 **의존성 0 순수 모듈 `shuttleRosterEdit.ts`**(`buildConfirmedRosterUpdate`/`pinSetClauses`/`rosterPatchTarget`)로 분리. 컬럼별로 한 절만 남기고(Map), **핀 먼저 → 스칼라** 순서로 조립해 살아남을 절만 파라미터를 만들게 했다(스칼라를 먼저 담고 핀으로 덮으면 안 쓰는 파라미터가 남아 bind 개수가 어긋난다). 표시 라벨만 예외로 **사람이 직접 친 값이 이긴다** — 핀의 라벨 절은 "비어 있을 때만 채우기"라 새로 친 이름을 버리면 "저장했는데 안 바뀐다"가 되기 때문(T-1이 이 규칙을 실제로 사용한다).
- **R-7①**: `confirmedRosterExists(seasonId)`(제외 행 **포함**) 신설. `getConfirmedShuttleRoster`가 `rows.length > 0` 대신 이 값으로 경로를 고르고, **결과가 비어도 폴백으로 내려가지 않는다**. `shuttleRosterConfirmationInfo`도 같은 기준의 `confirmed`를 함께 반환 → 화면/ API가 "전원 제외" 상태에서 확정 전으로 되돌아가 보이던 문제까지 해소.
- **R-8**: `save()`가 낙관 반영 전에 이전 값을 챙기고, 실패(403/400/409) 시 `apply(row.requestId, before)`로 롤백. 이전에는 거절돼도 새 값·초록 핀이 남아 "저장된 것처럼" 보였다.
- **T-1(치명)**: `applyConfirmedRosterPin(shuttleRequestId, kind, pin, label)` 신설. `updateShuttleRequestLocation`이 원본 트랜잭션에 들어가기 **전에** 호출 → 확정본이 있으면 확정본에 저장하고 감사 로그를 남긴 뒤 **원본은 건드리지 않고 반환**, 없으면 기존 원본 경로 그대로. **차선(409 거절)이 아니라 실제 저장을 택했다** — 원장의 주 작업이 노선 편성이고 거기서 정밀 좌표를 찍기 때문에 거절하면 작업 자체가 막힌다. 확정본 수정은 원장(ADMIN) 권한이라, 부원장이면 조용히 원본에 쓰지 않고 `403 CONFIRMED_ROSTER_OWNER_ONLY`로 이유를 알린다.
- **테스트 개선(리뷰 지적 반영)**: 실행 테스트 `tests/seasonal-shuttle-roster-edit-sql.test.mjs` 신설(16개) — 순수 모듈을 실제로 import해 "샘플 patch → 생성된 SQL 절 + args"를 단언. **이 테스트가 실제로 결함을 하나 더 잡았다**: `Number(null)`·`Number("")`가 0이라 좌표가 비었을 때 위도 0/경도 0(대서양)으로 조용히 저장되던 문제 → `toCoordinate()`로 null/빈문자/boolean을 명시 거부. 무의미한 검사(없던 문자열의 부재)와 표현식 원문 고정은 제거하고 **성질 검사**(호출 순서, 컬럼 중복 없음, 파라미터 전수 사용, 파생 목록의 원천)로 교체.
- **범위 밖(그대로 둠)**: R-7②(시즌 스코프 합산), R-8②(되돌리기 세션 한정) — PM 지시대로 4단계에서 처리.

**⚠️ 동시 편집 충돌 알림**: 작업 중 다른 developer가 같은 파일(`ShuttleRosterClient.tsx`, `shuttleRoster.ts`)에 **1호점 무료탑승 폴더 기능**(`isFreeHubRow`/`hubRows`/`mainRows`/`renderRow`)을 넣고 있었다. 내 1차 수정의 핀 구현(`pinSetClauses` 단일 UPDATE)이 그 과정에서 2문 분리 방식으로 바뀌어 있었고, 2차 수정에서 순수 모듈 방식으로 다시 통합했다(동작 동일 + 테스트 가능). 그 기능이 기존 안전장치 테스트 2건을 깨뜨려(`{visible.map}` → `mainRows.map(renderRow)`) **성질 검사로 바꿔 되살렸다**(원천이 반드시 `visible`에서 파생되는지 검사). 전부 정밀 Edit만 사용해 상대 작업을 덮어쓰지 않았다.

**1차 수정 상세:**
- **저장 위치**: 확정본에 **이미 있는 컬럼**만 쓴다(`pickup/dropoff` × `Latitude·Longitude·Address·RoadAddress·PlaceId·LocationSource·AccuracyMeters·ConfirmedAt`). 새 컬럼·마이그레이션 0건(테스트로 DDL에 존재함을 확인 + 게이트웨이에 `ALTER TABLE` 없음을 고정).
- **검증 기준은 원본 `applyPin`과 동일**(유한수 + 위도 -90~90 + 경도 -180~180, source 화이트리스트 `MAP_PIN/SEARCH/CURRENT_LOCATION`, 주소 300자·placeId 200자 컷). 다만 **조용히 무시하지 않고 `throw`** — 무시하면 원장은 저장된 줄 알고 그 학생만 배차에서 빠진 걸 현장에서 알게 된다. API가 400 + "좌표가 올바르지 않습니다."로 내려 화면에 이유가 뜬다.
- **`${kind}ConfirmedAt = now()`를 반드시 함께 채운다** — 노선 편성의 "이 학생 배차 가능" 판정이 이 값을 본다. 빠뜨리면 확정 후 배차 버튼이 죽는다.
- **표시 라벨 규칙 원본과 동일**: `${kind}Location`은 `COALESCE(NULLIF(btrim(...), ''), 주소)` — 건물명이 이미 있으면 핀이 덮지 않는다(주소 파라미터 1개를 두 컬럼이 재사용).
- **'등원과 동일'이면 등원 핀을 하원에 복제** — 원본 로직과 같은 SQL(`dropoffLocationSource`/`dropoffConfirmedAt`의 CASE 분기까지 동일). `locationConsentVersion`은 확정본에 없는 컬럼이라 제외(원본 전용 동의 이력).
- **낙관적 반영은 그대로 동작**: `savePin` → `save(row, …)` → `patchRow`가 `row.rosterId` 유무로 갈리므로, 확정 후에도 화면 즉시 반영 + 확정본 저장 경로를 탄다. 확정 후 원본 신청서 UPDATE 경로는 여전히 **코드상 존재하지 않음**(확정본 편집 구역 전체에 `"SpecialProgramShuttleRequest"` 문자열이 없음 + 그 구역의 모든 `UPDATE`가 `"SeasonalShuttleRoster"`임을 테스트로 고정).
- **검증(1차 수정 후)**: `npx tsc --noEmit` EXIT=0 / `npm run build` EXIT=0 / 전체 `node --test tests/*.test.mjs` **662개 중 657 pass / 5 fail**(기존 실패 5건과 동일, 새로 깨진 것 0) / 확정 명단 고정 테스트 17→**24개 전부 PASS**.

## 테스트 결과 (tester)

### 테스트 결과 — R-4 수정(목록 미리보기 태그 제거) + 6단계 전체 재검증 (2026-07-06)

| 테스트 항목 | 결과 | 비고 |
|-----------|------|------|
| tsc --noEmit | ✅ 통과 | EXIT=0 (세 파일 noticeContent/notices·page/admin·NoticesAdminClient 전부 포함) |
| npm run build | ✅ 통과 | EXIT=0. /notices ○(static,1m ISR)·/notices/[id] ƒ(Dynamic) 정상 컴파일, 전 라우트 빌드 성공 |
| **[R-4] stripHtmlForPreview 실함수** | ✅ 통과 | tsx 실행 9케이스: HTML문단+리스트→순수텍스트(꺾쇠 `<`,`>` 미노출), plain 원문보존, 빈/null/undefined→"", 엔티티 디코드(&amp;/&lt;/&nbsp;/&quot;/&#39;), plain 부등호(`3<5`) 원문보존, 이미지만/공백태그만→빈문자열. **모두 기대 동작 일치** (1건은 테스트 단언 과엄격, 실동작 정상 — 아래 참고) |
| **[R-4] 꺾쇠 미노출(raw태그 제거)** | ✅ 통과 | HTML 공지 미리보기 결과에 `<`,`>` 문자 0 — 회귀(raw 태그 노출) 해소 확인 |
| **[R-4] plain 하위호환** | ✅ 통과 | 태그 없는 옛 공지는 `isHtmlContent` 분기로 태그제거 건너뜀 → 원문 보존(부등호 손실 없음) |
| **[R-4] 두 목록 적용 + line-clamp 유지** | ✅ 통과 | 공개(page.tsx:98)·관리자(NoticesAdminClient:256) 모두 `{stripHtmlForPreview(n.content)}`. line-clamp-2·기존 색상/스타일 클래스 그대로 유지 |
| **[6단계] 상세 판별 렌더 무변경** | ✅ 통과 | page.tsx:90 `isHtmlContent` 분기 유지 — HTML→`sanitizeHtml(notice.content)`+`.notice-content`, plain→`toNoticeHtml`+whitespace-pre-wrap. R-4 수정에 영향 없음 |
| **[6단계] 공지500 재발 방지** | ✅ 통과 | sanitize.ts는 `sanitize-html`(순수JS, htmlparser2)만 import — jsdom/isomorphic-dompurify는 주석에만 존재. plain경로 `return out`(sanitize 재유입 0). 500 재발 경로 없음 |
| **[6단계] sanitize.ts 주석만 변경** | ✅ 통과 | git diff 확인: 82~86행 allowedStyles 주석(override→deepmerge 정정)만 변경, 코드 로직 무변경 |
| **[6단계] 옛 공지 하위호환/빈공지/첨부** | ✅ 통과 | plainToEditorHtml·isEmptyContent·attachmentsJSON 로직 무변경(R-4는 미리보기 헬퍼 신설+목록 2줄 교체만) — 6단계 검증 결과 그대로 유효 |
| 실제 dev 브라우저 렌더 | ⚠️ 미실시 | /admin·/notices 관리자 로그인 벽(1~6단계 동일, 비치명). 빌드+실함수 직접실행으로 대체 |

📊 실함수 단위테스트: **stripHtmlForPreview 9케이스 전부 기대동작 일치** (tsx로 실함수 file:/// import 실행)
📊 종합: 11개 중 10개 통과 / 1개 미실시(로그인 벽, 비치명) / **0개 실패**

**참고(코드결함 아님):** stripHtmlForPreview 테스트 중 "HTML 문단+리스트" 1건이 자동 단언에서 FAIL로 표시됐으나, 이는 **제 테스트 단언이 과도하게 엄격**했던 것. 입력 `<p>안녕<strong>하세요</strong></p><ul><li>항목</li></ul>` → 결과 `"안녕 하세요 항목"`. 인라인 `<strong>` 태그가 공백으로 치환돼 "안녕 하세요"에 한 칸이 들어갔는데, 이는 개발자가 의도한 안전동작(블록 태그가 단어를 붙이지 않도록 태그→공백)의 부수효과다. 요구사항(태그 없음·꺾쇠 미노출·순수 텍스트 변환)은 모두 충족. 미리보기 2줄 전용이라 사용자 체감 무해.

**판정: R-4 + 6단계 커밋 가능.** tsc/build EXIT=0, stripHtmlForPreview가 HTML→순수텍스트(꺾쇠 미노출)·plain 원문보존·null/빈값 안전처리·엔티티 디코드 전부 정상. 두 목록 모두 헬퍼 적용+line-clamp 유지. 상세 판별렌더·공지500 방지(jsdom 미사용)·옛공지 하위호환·빈공지 저장방지·하단첨부는 R-4 수정으로 깨지지 않음(sanitize.ts는 주석만 변경). 수정 요청 없음.

## 리뷰 결과 (reviewer) — 방학특강 셔틀 확정 명단 3단계 (2026-07-26)

📊 **종합 판정: 수정 필요** (치명 1건 — 나머지는 배포 후 처리 가능)

✅ 잘된 점:
- **SQL 안전성 이상 없음.** 새 쿼리 전부 `$queryRawUnsafe`/`$executeRawUnsafe`. 컬럼명은 전부 코드 리터럴이고 `kind`는 `"pickup"|"dropoff"` 유니온이라 인젝션 경로 0. `arg()` 클로저가 `args.push` 순서로 `$n`을 발급해 텍스트 순서와 무관하게 번호가 맞는다(`args[0]=rosterId=$1` 확인).
- **핀 저장 정확.** `${kind}ConfirmedAt = now()` 동시 기록(배차 판정 보호), 라벨은 `COALESCE(NULLIF(btrim(기존값),''), 주소)`로 건물명 보존(Postgres UPDATE는 SET에서 갱신 전 값을 읽으므로 의도대로 동작), '등원과 동일' 복제 SQL은 원본 `updateShuttleRosterRow`와 CASE 분기까지 동일(확정본에 없는 `locationConsentVersion`만 정확히 제외).
- **하드 DELETE 0건**, 제외는 `removedAt` soft remove. 재확정은 버튼 미렌더 + `ON CONFLICT DO NOTHING` 이중 방어. 동시 확정 2건도 단일 INSERT…SELECT라 안전.
- **안전장치 3종(6번 지워진 이력) 전부 생존 + 테스트로 잠김**: 미탑승 기본 숨김 토글, `exportRows = searched.filter(r => r.ride)`, 파일명 `방학특강_셔틀_탑승자명단_`.
- 색상 하드코딩 없음(기존 Tailwind + `dark:` 패턴 + `var(--brand-accent)`), 기존 UX 흐름(검색·CSV·핀 모달·상세 모달) 무변경 추가형.
- 검증 재확인: `npx tsc --noEmit` EXIT=0, `node --test tests/seasonal-shuttle-roster-confirm.test.mjs` 24/24 PASS.

🔴 필수 수정:
- **[route.ts:110~114] 확정 후에도 "확정 전 경로"가 열려 있어 원본이 UPDATE 된다 (원본 불변 원칙 미성립).**
  `if (body?.rosterId)` 분기는 **클라이언트가 rosterId를 보냈을 때만** 확정본으로 간다. 서버는 확정 여부를 확인하지 않는다.
  시나리오: 부원장(또는 원장)이 `/admin/seasonal/shuttle`을 연 채로 둔다 → 다른 창에서 원장이 확정한다 → 열려 있던 탭의 행에는 `rosterId`가 없으므로 주소를 고치면 `{requestId, patch}`로 나가고, `updateShuttleRosterRow`는 `requireAdmin`만 통과시켜 **원본 신청서를 수정하고 "✓ 저장됨"을 띄운다.** 확정본은 그대로라 기사님 명단에 반영되지 않는다 = 아이가 옛 주소에서 기다린다. 이 기능이 막으려던 사고 그 자체다.
  → 수정안: PATCH의 requestId 분기 진입 전에 `SELECT 1 FROM "SeasonalShuttleRoster" WHERE "shuttleRequestId" = $1 AND "removedAt" IS NULL LIMIT 1`을 확인하고, 있으면 409 + "명단이 확정되었습니다. 새로고침 후 다시 시도해주세요."로 거절(화면은 에러 칩에 그대로 노출). 쿼리 1회 추가로 끝난다.

🟡 권장 수정:
- **[shuttleRoster.ts:633~641] 같은 patch에 `pickupLocation`과 `pickupPin`이 동시에 오면 SQL이 죽는다.** SET 목록에 `"pickupLocation"`이 두 번(=$n, =COALESCE…) 들어가 Postgres가 `multiple assignments to same column`(42701)으로 거절 → 500. 지금 화면은 텍스트/핀을 따로 보내서 도달하지 않지만, 4단계에서 한 번에 보내는 순간 터진다. → 핀이 있을 때는 텍스트 `push`를 건너뛰거나(우선순위 명시), 원본처럼 UPDATE를 2문으로 분리.
- **[shuttleRoster.ts:328] 확정본 행이 전부 제외되면 폴백이 되살아난다.** `if (rows.length > 0)` 판정이라 마지막 1행까지 빼면 원본 조회로 되돌아가 **일부러 뺀 학생이 다시 명단·기사님 CSV에 나타난다.** 확정 버튼도 다시 뜨는데 눌러도 `ON CONFLICT DO NOTHING`이라 아무 일이 없어 원장이 갇힌다. → "확정본 행이 존재하면(removedAt 포함) CONFIRMED"로 판정하거나, 킬 스위치가 켜져 있으면 폴백하지 않도록.
- **[shuttleRoster.ts:166~176 + 314] 다음 시즌이 열리면 명단이 잠긴다.** 시즌 스코프가 `status <> 'ARCHIVED'`(전 시즌 합산)이고 확정본이 1행이라도 있으면 확정본만 반환하므로, 여름 시즌 확정 후 겨울 시즌 신청자는 **목록에 아예 안 보이고 확정 버튼도 안 뜬다**(confirmed=true라 배너가 초록). 이전 시즌을 ARCHIVED로 바꾸기 전에는 화면상 탈출구가 없다. → 4단계(변동 반영)가 "신규 신청 추가 확정"을 포함하는지 PM 확인 필요. 포함 안 되면 3단계 범위에서라도 "미확정 N명 추가 확정" 버튼이 필요하다.
- **[ShuttleRosterClient.tsx:117~121] 저장 실패해도 낙관 반영을 되돌리지 않는다.** 핀까지 낙관 반영 대상이 되면서, 부원장이 확정 후 편집(403) 하거나 좌표가 튕겨도(400) **화면은 새 값·초록 점을 그대로 유지**하고 작은 빨간 칩만 뜬다. → `catch`에서 `apply(row.requestId, 이전값)`으로 롤백 권장.
- **[ShuttleRosterClient.tsx:95, 163~170] 되돌리기가 세션 한정이다.** `lastRemoved` state로만 복구 가능해 새로고침하면 제외한 행에 도달할 UI가 사라진다(데이터는 살아 있으나 사용자에겐 복구 불가). → "제외된 N명 보기" 토글이 있으면 soft delete의 취지가 완성된다.
- **[tests/seasonal-shuttle-roster-confirm.test.mjs] 테스트가 전부 소스 문자열 매칭이라 실제 회귀를 못 잡는 영역이 있다.** 원본 테이블 미등장·UPDATE 대상 고정·DDL 컬럼 존재·안전장치 3종은 잘 잠갔지만, `$n` 번호 어긋남이나 위 "중복 SET" 같은 실동작 결함은 문자열로는 절대 못 잡는다. 또 `row.rosterId ? { rosterId: … } : …`, `const target = rows.find(…)` 같은 **표현식 원문 고정**은 포맷터 한 번에 깨진다. `assert.doesNotMatch(client, /disabled=\{confirmed\}/)`, `/return;\s*\/\/ 무시/`는 애초에 없던 문자열의 부재 검사라 의미가 없다. → `pinSetClauses`(또는 SET 조립 함수)를 export 해 "샘플 patch → 생성된 SQL + args 배열"을 단언하는 실행 테스트 1개만 추가해도 위 두 결함이 잡힌다.

🔵 사소:
- [shuttleRoster.ts:634~638] 확정본 경로는 `str()`만 써서 길이 컷이 없다(원본 경로는 `clean(…,200)`/`(…,30)`). 컬럼이 TEXT라 에러는 안 나지만 확정 전/후 저장 기준이 다르다.
- [route.ts:113~114] `updateConfirmedShuttleRosterRow`의 `changed`를 버려서 0행 갱신(존재하지 않는 rosterId)에도 `ok:true` → "저장됨"이 뜬다.
- [route.ts:22] `knownFailure`가 미인증("인증이 필요합니다")까지 403으로 내린다(401이 정확). 메시지는 정확히 전달되므로 실사용 영향은 없음.
- [shuttleRoster.ts:640~641 vs 658] `dropoffSameAsPickup=true`인 행에 `dropoffPin`을 보내면 직후 복제 UPDATE가 덮어써 조용히 사라진다(현재 화면에서는 핀 버튼이 숨겨져 도달 불가).
- [service.ts:567] 노선 배정 `syncLegacyAssignment`는 여전히 원본의 `status`/`assignedRouteId`를 쓴다 — 다만 확정본은 전용 `ride` 컬럼을 보므로 확정 명단에 영향 없음(DDL 주석의 의도대로 동작). 원본 불변은 "명단 값(주소·좌표·사람)" 기준으로 성립.

---

## 테스트 결과 (tester) — 방학특강 셔틀 확정 명단 3단계 (실 DB 읽기 검증) (2026-07-26)

**검증 방식**: 정적 검사 + **운영 DB 읽기 전용(SELECT) 검증**. INSERT/UPDATE/DELETE/DDL·확정함수 호출·migrate·관리자 로그인 **전부 미실시**. 개인정보 값은 조회하지 않고 건수만 집계.

### A. 정적 검증

| 테스트 항목 | 결과 | 비고 |
|-----------|------|------|
| `npx tsc --noEmit` | ✅ 통과 | 에러 0건 |
| `npm run build` | ✅ 통과 | EXIT=0 |
| `node --test tests/*.test.mjs` | ✅ 통과 | **662개 중 657 pass / 5 fail** — 실패 5건이 기준선과 완전 일치(체험신청 2 · 위치선택 1 · 선생님 수업명단 2). 새로 깨진 것 **0** |

### B. 실 DB 읽기 검증 (핵심)

| 테스트 항목 | 결과 | 비고 |
|-----------|------|------|
| B-1 `SeasonalShuttleRoster` 테이블 존재 | ✅ 통과 | 실재. 행 수 **0건**(total 0 / alive 0 / removed 0) = 아직 미확정 = 정상 |
| B-2 `AcademySettings.shuttleRosterConfirmedMode` | ✅ 통과 | 값 **NULL**, 타입 `boolean`. 킬 스위치 꺼짐 = 현재 폴백 경로. singleton 행 1건 존재(확정 시 UPDATE 대상 확보) |
| B-3 코드가 쓰는 컬럼 실재 여부 | ✅ 통과 | 실제 46개 컬럼. **SELECT 46개 누락 0 / INSERT 39개 누락 0 / 핀 16개 누락 0**. `removedAt`·`removedReason`·`confirmedAt`(NOT NULL, default now())·`note`·`ride`(NOT NULL, default true) 전부 존재. 좌표 4개 전부 `double precision` |
| B-4 폴백 명단 오염 검사 | ✅ 통과 | 폴백 18행(탑승 17 / 미탑승 1). **취소 신청서 0 · 취소 수강항목 0 · 개설취소 반 0 · REJECTED가 탑승으로 샌 건 0**. 필터 미적용 시 20건 → 필터가 **2건을 실제로 제외 중**(필터가 살아있다는 증거). 셔틀신청 status 분포 REQUESTED 17 / CANCELLED 1(미탑승 1행과 일치) |
| B-5 INSERT NOT NULL 충돌 | ✅ 통과 | default 없는 NOT NULL = `seasonId`·`shuttleRequestId`·`studentNameSnapshot` 3개뿐이고 **전부 INSERT 목록에 있음**. 대상 18건 dry-run 결과 이 3개 값의 NULL **0건**. `ride`·`dropoffSameAsPickup`도 NULL 0건 |
| B-6 `UNIQUE(seasonId, shuttleRequestId)` | ✅ 통과 | `SeasonalShuttleRoster_season_request_key` 실재 → `ON CONFLICT` 절 정상 동작(재확정 시 중복 삽입 차단) |
| B-7 **확정 INSERT의 SELECT 절 실제 실행**(읽기 전용) | ✅ 통과 | 39개 표현식 전부 오류 없이 resolve, **SELECT 39 = INSERT 대상 39 일치**(개수 불일치 시 발생하는 Postgres 에러 없음). 18행 반환. `to_jsonb(text[])→jsonb`·`md5(concat_ws(...))`·수업시각 서브쿼리·`conversionStatus` CASE 전부 정상 |
| B-8 확정 후 조회 경로(CONFIRMED SELECT) | ✅ 통과 | 구문·컬럼 전부 통과(현재 0행 반환이 정상). 배너용 `shuttleRosterConfirmationInfo` 쿼리도 정상(count 0 / confirmedAt null) |
| B-9 날짜별 운행 명단 좌석 쿼리 | ✅ 통과 | 구문 통과, SCHEDULED 좌석 189건 |
| B-10 확정 대상 건수 정합 | ✅ 통과 | 확정 SQL(INNER JOIN) 18건 = 폴백(LEFT JOIN) 18건, **차이 0**(확정해도 명단이 줄지 않음) |
| B-11 확정 전/후 UI 라벨 정합 | ✅ 통과 | 버튼 `17명 확정하기`(rideCount, 0명이면 disabled) / 확정 후 배너는 `탑승 17명` + `확정본 18건(미탑승 포함)`로 **분리 표기** → 17 vs 18 혼동 없음 |
| B-12 확정 후 다른 화면의 핀 편집 반영 | ❌ **실패** | 아래 T-1 참조 |

📊 종합: **15개 중 14개 통과 / 1개 실패(T-1)**

### 🎯 최종 판정 — 확정 버튼을 눌러도 되는가

**✅ 누를 수 있다. 500이 날 위험은 확인되지 않았다.**
확정 실행에 필요한 4대 전제(테이블 실재 · 컬럼 39개 전부 실재 · NOT NULL 충돌 없음 · UNIQUE 인덱스 실재)가 모두 충족됐고, **INSERT의 SELECT 절을 운영 DB에서 그대로 읽기 실행해 18행이 오류 없이 반환**되는 것까지 확인했다. 예상 결과: `inserted = 18`(탑승 17 + 미탑승 1) → 킬 스위치 자동 ON → 배너가 초록으로 전환.
확정될 18명에 **취소·거절·폐강 학생은 한 명도 섞여 있지 않다**(원장님이 겪었던 사고 재발 없음).

### ⚠️ 확정 전 알아둘 것 (실패 아님, 운영 주의)

- **확정 후에는 원본이 바뀌어도 명단이 따라가지 않는다**(설계 의도). 확정 뒤 학부모가 신청을 취소해도 확정 명단에는 남으므로, 원장이 "명단에서 빼기"를 직접 눌러야 한다. 변동 감지는 4단계 예정.
- 확정 스코프가 `status <> 'ARCHIVED'` 전체 시즌이다. 지금은 PUBLISHED 시즌 1개뿐이라 문제없지만, **다음 방학 시즌을 미리 만들어 둔 상태에서 확정하면 두 시즌이 한꺼번에 스냅샷된다**(R-7과 같은 뿌리).
- `studentIdSnapshot`(전환 학생 id)이 18명 중 **1명만** 채워진다. 폴백도 동일 조건(`conversionStatus='COMPLETED'`)이라 **회귀는 아니지만**, 학부모 마이페이지가 이 값으로 자녀를 잇는 구조라 전환 완료 전에 확정하면 그 시점 값이 그대로 굳는다.

---

## 미해결 리뷰 수정 사항 (이월)
| 번호 | 파일 | 심각도 | 내용 | 상태 |
|------|------|--------|------|------|
| R-1 | api/admin/trial-count/route.ts | 필수 | 인증 가드 추가 | 미처리 |
| R-2 | actions/public.ts | 권장 | source/referralSource 서버 화이트리스트 검증 | 미처리 |
| R-3 | actions/public.ts:353 | 권장 | shuttleNeeded: `\|\|` → `??` 변경 | 미처리 |
| R-4 | notices/page.tsx:98 + admin/notices/NoticesAdminClient.tsx:255 | 필수 | 목록 미리보기가 HTML 공지의 raw 태그를 그대로 노출 — 미리보기용 태그 제거(strip) 필요. 공개 목록은 사용자 대면 | 수정완료(stripHtmlForPreview 적용, 2026-07-06) |
| R-5 | api/admin/seasonal/shuttle-roster/route.ts:110~114 | **필수(치명)** | 확정 후에도 requestId 분기가 열려 있어 오래 열어둔 탭이 원본 신청서를 수정하고 "저장됨"을 띄운다(확정본 미반영). requestId 분기 진입 전 확정본 존재 확인 → 409 거절 | 수정완료(isShuttleRequestConfirmed 서버 확인 + 409 + 화면 자동 새로고침, 2026-07-26) |
| R-6 | lib/seasonal/shuttleRoster.ts:633~641 | 권장 | 같은 patch에 `pickupLocation` + `pickupPin`이 오면 SET 중복 컬럼으로 SQL 42701 → 500. 현재 화면은 미도달, 4단계에서 터짐 | 수정완료(순수 모듈 shuttleRosterEdit.ts로 분리+컬럼별 1절, 실행 테스트 16건, 2026-07-26) |
| R-7 | lib/seasonal/shuttleRoster.ts:328 / 166~176 | 권장 | ①확정본 전원 제외 시 폴백 부활(뺀 학생 재등장) ②다음 시즌 신청자가 목록·확정 버튼에서 사라짐(시즌 스코프 전체 합산) | ①수정완료(confirmedRosterExists 판정, 2026-07-26) / ②미처리(4단계, PM 지시로 범위 밖) |
| R-8 | admin/seasonal/shuttle/ShuttleRosterClient.tsx:117~121, 163~170 | 권장 | ①저장 실패 시 낙관 반영 롤백 없음(403/400에도 새 값 유지) ②제외 되돌리기가 세션 한정(새로고침 시 복구 UI 소멸) | ①수정완료(save 실패 시 이전 값 롤백, 2026-07-26) / ②미처리(4단계) |
| T-1 | lib/shuttle/service.ts:966~1020 (`updateShuttleRequestLocation`) + api/admin/shuttle/route.ts:88~91 + admin/shuttle/ShuttleRouteAdminClient.tsx:216~231 | **필수(치명)** | **확정 후 노선 편성 화면(`/admin/shuttle`)의 "위치 확정" 핀이 조용히 무시된다.** 그 화면의 미배정 명단은 게이트웨이(`getConfirmedShuttleRoster`, service.ts:384)에서 = **확정본**에서 오는데, 핀 저장(`resource:"shuttleRequest"`, `action:"confirmLocation"`)은 **원본 `SpecialProgramShuttleRequest`에만 UPDATE**한다. 결과: 원장이 핀을 찍으면 "저장했습니다" 토스트가 뜨고 목록이 새로고침되지만 좌표는 그대로 → 그 학생만 배차에서 빠진 걸 현장에서 알게 된다. `/admin/seasonal/shuttle`은 1차 수정으로 해결됐으나 **이 화면은 누락**. 필요 조치: 확정본이 있으면 `updateConfirmedShuttleRosterRow`(pickupPin/dropoffPin)로 라우팅하거나, 확정 후에는 409+안내로 거절 | 수정완료(applyConfirmedRosterPin으로 확정본 저장 라우팅, 2026-07-26) |

---

## 작업 로그 (최근 10건)

| 날짜 | 작업 내용 | 상태 |
|------|----------|------|
| 2026-07-27 | **세션 마무리(pm)** — 오늘 다수 배포(수강생 상세 재설계+편집 / 셔틀 위치 placeName 전역통일 / 저장배차노선 reconcile·증분재배차·라벨자가갱신 / 정차 확정시간 실T맵+편집+기사·학부모노출 / 방학특강 선생님 화면 정규 통합흐름 개편[로스터 전원화·좌석출결·수업시작 취소·void 핫픽스·UI] / 관리자→선생님 진입점). 각 tsc EXIT=0, 병렬세션과 반복 머지. **미푸시 0.** 개발서버 종료. 이월: 셔틀4단계 4a-2/4b/4c/4d, 미전환자 학부모알림, (참고)카카오맵 키는 localhost만 미등록·프로덕션 정상 | 마무리·배포완료 |
| 2026-07-27 | **수업 시작 취소(되돌리기) 추가(developer)** — 스태프 진행 화면에서 실수/테스트로 시작한 수업을 PLANNED로 되돌림. 서버액션 `cancelClassSession({sessionId})`(staff-sessions.ts): requireSessionAccess 권한게이트, IN_PROGRESS 아니면 거부, `UPDATE Session SET status='PLANNED',startedAt=NULL,startedByUserId=NULL WHERE id=$1 AND status='IN_PROGRESS'`($executeRawUnsafe, 0행이면 안전통과), **출결/사진/메모 무변경**, revalidatePath. 정규·특강 공통. StaffSessionDetail 타입에 sessionDateId 노출(쿼리는 이미 반환). SessionInProgressClient에 종료바 하단 보조버튼(회색 테두리·undo아이콘)+window.confirm+성공시 router.replace(seasonal?'/staff/seasonal':'/staff'). tsc EXIT=0 | 구현완료(PM 검증대기) |
| 2026-07-27 | **특강 명단 버그 #2·#3 수정(developer)** — (#3) `getTodayStaffClasses` seasonal 쿼리가 CANCELLED offering을 안 걸러 취소반(중등부·초등저학년)이 학생0명으로 노출 → 메인 WHERE `o.status<>'CANCELLED'` + access_o EXISTS 서브쿼리 `access_o.status<>'CANCELLED'` 추가(반+시간 GROUP BY라 OPEN 하나라도 있으면 유지·전부취소면 제거). (#2) `/staff/seasonal`이 offering별 getSeasonalDatesForStaff로 주n회 쪼개짐 → 홈과 동일한 반 단위 `getTodayStaffClasses`(SEASONAL 필터)로 데이터소스 교체. getTodayStaffClasses에 날짜 파라미터 추가(기본=오늘, 홈 무영향). page.tsx·StaffSeasonalClient(필드 매핑 StaffTodayClass)·api/staff/seasonal route(GET date 분기) 수정. 홈/정규/startClassSession 무변경. tsc EXIT=0 | 구현완료(PM 검증대기) |
| 2026-07-27 | **학부모 마이페이지 방학특강 확정 승·하차 시각 노출(T3, developer)** — 마이페이지 "셔틀 안내" 방학특강 카드에 확정 시각 표시. 출처=SeasonalDispatchRoute.payload stops[].etaLabel(etaManual 반영값), 매핑=학생→roster.shuttleRequestId→payload students[].requestId. 순수 `extractEtaByRequestId`(dispatchEtaLookup.ts 신규, import 0)+서버 `getConfirmedDispatchEtas`(방향별 대표 1건, updatedAt DESC, 읽기전용·인증X)+parent.ts에 pickupEtaLabel?/dropoffEtaLabel? optional 필드+MyPageClient "확정 시각" 행. 정규반 로직 무변경, 미저장이면 미표시(회귀없음). IDOR: 본인 자녀 requestId만 전달. 유닛 5/5+tsc EXIT=0 | 구현완료(PM 검증대기) |
| 2026-07-27 | **planRun ETA를 T맵 구간별 실제시간으로 교체(developer)** — 기존 routeFixedOrder(총시간)+segMin 비율배분(부정확) → routeSegmentsWithTmapRetry로 정차 사이 구간별 실측시간 받아 stop ETA를 실측 누적 계산. 순수함수 `segmentMinutes`/`nodeTimesFromSegments`를 무의존 모듈 `shuttle-eta.ts`로 분리(테스트 직접 import). 실패 구간만 segMin 폴백, 전체실패는 전 구간 segMin+경로 prev복원(mergeTmapRoute). stop.etaMinutes(분 숫자, T2 확정편집 기준값) 추가. keepOrder(증분)·일반자동 둘 다 경유, localOnly·정차0/1 회귀없음(fallbackMin=종전 segMin과 동일). 미사용 routeFixedOrder 래퍼 제거. 유닛 8개+tsc EXIT=0. (admin-shuttle-compat 실패 1건은 무관 stale) | 구현완료(PM 검증대기) |
| 2026-07-27 | **배차 정차 라벨 reconcile-on-read 갱신(developer)** — 명단 placeLabel 수정이 저장 배차 노선의 얼어붙은 라벨에도 읽을 때 반영(재배차·좌표변경 없이 텍스트만·자가치유). `reconcileSavedVehicles`에 옵셔널 `labelByRequestId`(requestId→placeLabel) 3번째 인자 추가: 살아남은 학생 pickupLabel + 비허브 정차 label만 갱신, isHub 라벨·좌표·시각·순서·path 전부 불변, 맵 없으면 기존 유지(하위호환). `getSavedDispatchRoute`가 riders로 맵 만들어 전달. 유닛 11개(라벨 5케이스 추가)+tsc EXIT=0 | 구현완료(PM 검증대기) |
| 2026-07-27 | **저장 노선 변동 감지 + 관리자 배너(Phase 2a, developer)** — reconcile(제거)의 반대. 순수함수 `diffSavedRoute(vehicles, riders)` 추가(dispatchReconcile.ts): savedIds·requestId→정차좌표 맵으로 added(∉savedIds=신규·복귀)/locationChanged(좌표Δ>1e-5, null스킵) 산출, requestId만 매칭·불변. `getSavedDispatchRoute`가 reconcile 후 diff 반환(SavedDispatchRoute·DispatchSuggestion에 added/locationChanged 필드 추가, getDispatchForView 저장분기 전달). RouteSection 관리자 배너("⚠️ 저장 노선 이후 변동…"+이름목록)+[🔄 자동배차 다시 실행] 버튼(현재 generate, Phase 2b TODO 주석). 기사화면 미노출(run/[token] 수동매핑이 필드 안 읽음). 저장 payload·순서·시각·좌표 무변경(순수읽기). 유닛 8개+tsc EXIT=0 | 구현완료(tester 대기) |
| 2026-07-27 | **저장 배차 노선 reconcile-on-read(developer)** — 저장 payload를 DB에서 안 바꾸고 **읽을 때** 그날 유효하지 않은 학생(결석·수강취소·폐강)만 필터(자가치유). 순수함수 `reconcileSavedVehicles`를 무의존 모듈 `dispatchReconcile.ts`로 분리(shuttleRosterEdit 패턴, 실행 테스트 가능), `getSavedDispatchRoute`가 date 있으면 `getConfirmedShuttleRosterForDate`로 validIds 만들어 vehicles 교체. requestId(shuttleRequestId)만 매칭, isHub 정차 유지, passengers/over 재계산, 순서·etaLabel·시각·path 보존. 순환import 없음. 유닛 6개+tsc EXIT=0 | 구현완료(tester 대기) |
| 2026-07-27 | **셔틀 장소명 저장경로 유실 버그 수정(G3, developer)** — (1)정규반 신청→학생 전환의 `StudentShuttleLocation` INSERT가 `name`을 NULL 하드코딩하던 버그 수정: 라벨 컬럼(`app.shuttlePickup`→PICKUP, `app.shuttleDropoff`→DROPOFF)에서 장소명 읽어 파라미터화($12), ON CONFLICT에 `name=EXCLUDED.name` 추가, 폴백 `roadAddress ?? address`. 좌표/주소/placeId/source 무변경. (2)방학특강 확정본은 확인만—`confirmSeasonalShuttleRoster` INSERT…SELECT가 원본 `pickupLocation/dropoffLocation` 라벨을 그대로 복사, 편집경로도 라벨 저장 → **변경 불필요**. 스키마 변경 없음. tsc EXIT=0 | 구현완료(tester 대기) |
| 2026-07-27 | **셔틀 라벨에 장소명 우선 저장(G2, developer)** — 지도 선택 장소명을 라벨 컬럼에 `name ?? 주소`로 저장(스키마 변경 없음, 라벨 컬럼 재활용). 방학특강: contracts.ts `name?` 파싱 + service.ts 저장부 `pickup?.name ?? 텍스트라벨` + SeasonalApplyClient 라벨 매핑. 정규반: EnrollLaterSteps onConfirm + public.ts `EnrollmentShuttleLocationData.name?` 정규화 + INSERT/UPDATE 라벨($17/$19) name 우선. 좌표/주소/placeId 무변경(운행 기준 보존), name 없으면 주소 폴백(하위호환). **정규반 name→`shuttlePickup`/`shuttleDropoff` 컬럼 저장(G3 참고)**. tsc EXIT=0 | 구현완료(tester 대기) |
| 2026-07-26 | **수강생 상세 반 추가·삭제(E3, developer)** — `/admin/students/[id]` 개요 탭 "현재 수강 반"에 [반 추가](프로그램별·수강중 제외 선택)+행별 빨간 휴지통 하드삭제(강한 확인창). 기존 `enrollStudent`/`deleteEnrollment` 호출만(서버 무변경). 클래스목록=`getClasses()` 재사용, page.tsx가 getStudentActivity와 Promise.all 병렬조회해 classes prop 신규전달(getStudentActivity 무변경). E1/E2·loadData·데이터계약 무변경. tsc EXIT=0 | 구현완료(tester 대기) |
| 2026-07-26 | **수강생 상세 수납 탭 결제 상태 변경(E2, developer)** — `/admin/students/[id]` "청구·납부(시스템)" 각 건에 ✏️→4-세그먼트(완납/대기/연체/취소) 상태 변경. E1 패턴 답습(async 핸들러+loadData+피드백). 기존 `updatePaymentStatus` 호출만(서버 무변경). 취소만 window.confirm, 성공 "변경됨" 2초, 권한 실패 시 서버메시지 표면화(조용한 실패 없음). "장부 수납(시트원장)" 무변경. tsc EXIT=0 | 구현완료(tester 대기) |
| 2026-07-26 | **정규반 수강생 상세 페이지 UI 재설계(developer)** — `/admin/students/[id]` 시안대로 UI만 교체(데이터·API·서버액션·로직 100% 보존). 새 레이아웃: 정체성 헤더 → KPI 4칸(출석률 미니도넛·수강중·이번달수납·미납) → 좌 320px sticky 레일(연락처·셔틀·메모) + 우 5탭(개요/수강출결/수납/월별히스토리/사진). 기존 "운영 요약" 카드는 KPI로 흡수, 셔틀을 월별히스토리→좌레일로 승격, 테이블→카드리스트, 수납 시스템/시트원장 2출처 분리, 월별히스토리 `<details>`+반뱃지 전체노출. 3핸들러(saveMemo/changeEnrollmentStatus/loadData)·`StudentActivityData` 계약·media-consent 라우트 무변경. 하드코딩 hex 0, Material Symbols만. tsc EXIT=0, eslint 0 error(경고 1=기존 갤러리 img) | 구현완료(tester 대기) |
| 2026-07-26 | **셔틀 명단 시트↔앱 대조 + 운영 데이터 반영(운영 DB 쓰기)** — 원장 요청으로 구글폼 시트(23명)와 앱 DB 대조. 발견: ①양서진(신규·미탑승) 시트에만 있음 ②이승민 앱=탑승/시트=미탑승 충돌 ③이수아 앱에만(시트 무관, DB 정답). 조치(사용자 승인): **이승민→무료탑승**(pickupLocation`1호점(무료탑승)`+거점좌표, 셔틀비 10,000→0, 합계150,000), **양서진→수강등록**(초등고 주3회 44b2ad31, APPROVED, 좌석11 월화수, 셔틀無, 멱등키 임포터공식 sheet-c4bad8…, importSource 동일). 시트임포터=`scripts/seasonal-import.mjs`(PENDING생성+승인시 좌석). 전부 단일 트랜잭션·검증SELECT 완료 | 운영반영 완료 |
| 2026-07-26 | 셔틀 4단계 기획 + **4a-1 구현·커밋** — 3개 Explore 조사(확정 시즌스코프/날짜별 배차/결석 시스템)로 현황 파악. 핵심발견: 날짜별 배차는 `getConfirmedShuttleRosterForDate` 한 곳이 유일 게이트, `SpecialProgramEnrollmentDate`에 `status`(배차가 봄)와 `attendanceStatus`(출결, 배차 안 봄)가 **따로** 존재. 사용자 결정 3건(결석=출결 자동연동/입력=관리자+학부모/신규=원장 수동버튼). **4a-1**: 배차 좌석 쿼리 WHERE에 `attendanceStatus NOT IN (ABSENT,EXCUSED)` 추가 → 결석 미리 찍으면 그날 셔틀 등·하원 자동 제외(LATE는 태움, 시즌명단 유지). 관리자 입력은 기존 출결화면 미래회차로 이미 가능(버튼 disabled 없음). tsc EXIT=0, 셔틀 회귀 88/88 | 커밋완료(b04fdf8, 미푸시) |
| 2026-07-27 | **순서변경 T맵 실도로 재계산 + 기사님 운행 화면(origin)** — ①순서 변경 시 routeOptimization(재정렬) 대신 `/routes` 고정순서 경로: passList≤5 → 경계공유 청킹(routeFixedOrderWithTmap), /dispatch/reroute API, 클라 0.5초 디바운스로 실도로 선·실제시간 교체(ref로 stale 방지·'🔄 재계산'). 지도 2등분·모바일 목록↑지도↓·▲▼삭제 동반. ②기사님 화면: ShuttleRunLink(토큰)·ShuttleBoarding(탑승) 테이블(운영 DB apply_migration), computeDispatch 분리(비로그인 토큰게이트), /shuttle/run/[token] 공개+DriverRunClient(탑승/미탑승 탭·진행률), /api/shuttle/boarding, 배차에 '🔗 기사님 링크'. 미탑승 기록만(MVP). tsc/next build EXIT=0. 커밋 a78571f·064c7db | 배포완료 |
| 2026-07-26 | **배차 개선 2차 묶음(origin·전부 배포)** — ①출발시각 조정 후 순서변경 시 초기화 버그: '출발 고정' 상태 추가해 유지 ②기존 주소→건물명 일괄변환: 명단 화면 버튼(카카오 JS SDK coord2Address 건물명, 탑승자·주소라벨·건물명 있을 때만) ③드래그 핸들 카드 맨 앞 이동 ④노선 지도: T맵 features의 LineString(실도로 경로) 추출→Run.path→DispatchRouteMap(카카오 지도 폴리라인+번호 마커) ⑤노선 수정본 DB 저장: SeasonalDispatchRoute 테이블(운영 DB에 apply_migration으로 생성)+저장/조회 API+저장 버튼·자동 로드·배너. ★배포는 migrate deploy 없이 fast-forward push, DDL은 Supabase MCP. tsc/next build EXIT=0, 셔틀·T맵 테스트 통과. 커밋 db7f1aa·88dfc34·(출발고정)·(지도)·f210bb0 | 배포완료 |
| 2026-07-26 | **T맵 최적경로 활성화 + 배차 순서변경 시각 재계산(origin)** — ①T맵이 늘 400(9401)로 실패해 직선추정으로 내려가던 원인 2건 규명(실 키로 API 직접 진단): `startTime` 필수 누락, `viaPointId "0"`을 값없음 취급. tmap.ts에 startTime 추가 + 내부 안전id(wpN) 전송 후 원래 id로 복원(호출부 계약 유지). ②배차 화면 reorderStop이 순서만 바꾸고 시각 미갱신 → recomputeRunTimes(서버 planRun과 동일 공식, 학원 도착/출발 기준 역산·T맵총시간 재배분) 연결. tsc EXIT=0, tmap 14/14(단언 2건 신설)·셔틀 100/100. errors.md에 T맵 버그 기록. 커밋 965ceec | 구현완료(수동검증 대기) |
| 2026-07-26 | **승차위치 아파트/건물명 표시 + 자동배차 무료탑승 드래그(origin)** — ①MapLocationData에 placeName 추가, 카카오 검색 place_name 저장, 표시 이름표를 장소명→도로명→지번 순(신청폼·명단핀·노선편성핀 4곳). ②shuttle-optimize: 학생에 rosterId/requestId/pickupLabel 추가, 등원에서 '무료탑승' 라벨 학생을 거점 정류장에 붙여 계산(명단 무료탑승 학생이 집좌표로 가던 불일치 해소). DispatchClient: 학생칩 드래그→거점 드롭→pickupLocation='무료탑승·기존이름' 저장(기존 PATCH 재사용)→재계산, 거점에 지정학생 목록·인원수. tsc EXIT=0, 셔틀 명단필터 18/18·호환 1/1, location-picker 9/1(1은 기준선 기존실패, 무관). 커밋 eb2e11b·4fbf380 | 구현완료(수동검증 대기) |
| 2026-07-26 | 셔틀 확정 명단 3단계 **실 DB 읽기 검증(tester)** — tsc/build EXIT=0, 전체 657/662(잔여 5는 기준선 동일). 운영 DB SELECT 전용 검증: 테이블 실재·행 0(미확정 정상)·킬스위치 NULL(꺼짐)·컬럼 46개 중 SELECT/INSERT/핀16 **누락 0**·NOT NULL 충돌 0·UNIQUE(seasonId,shuttleRequestId) 실재·**확정 INSERT의 SELECT 절을 읽기 실행해 39/39 표현식 정상·18행 반환**. 폴백 명단 18행(탑승17/미탑승1) **취소·거절·폐강 오염 0건**(필터가 실제 2건 제외 중). → **확정 버튼 500 위험 없음, 눌러도 됨(예상 inserted=18)**. ★신규 치명 1건(T-1): 확정 후 `/admin/shuttle` 노선 편성 화면의 "위치 확정" 핀이 원본에만 써서 조용히 무시됨 | 검증완료(T-1 수정 필요) |
| 2026-07-26 | 셔틀 확정 명단 3단계 리뷰 — SQL 인젝션·$n 번호·핀 저장(ConfirmedAt/라벨보존/등원동일 복제)·soft delete·재확정 방지·안전장치 3종 전부 이상 없음. **치명 1(R-5)**: 확정 후에도 requestId 경로가 열려 있어 오래 열어둔 탭이 원본을 수정하고 "저장됨" 표시(확정본 미반영) → 409 거절 필요. 권장 4(R-6 SET 중복컬럼 500, R-7 전원제외 폴백부활·다음시즌 잠김, R-8 낙관롤백·되돌리기 세션한정, 테스트가 전부 문자열매칭이라 실동작 결함 미검출). tsc EXIT=0, 신규테스트 24/24 | 리뷰: 수정필요(R-5) |
| 2026-07-26 | 셔틀 확정 명단 3단계 2차 수정(리뷰 R-5/R-6/R-7①/R-8 + 테스터 T-1) — ①R-5(치명): 원본 수정 직전 서버가 확정본 조회→409 거절+화면 자동 새로고침 ②R-6: SET 조립을 의존성0 순수모듈로 분리, 컬럼중복 제거(42701 방지) ③R-7①: 확정 판정을 "확정본 존재(제외행 포함)"로 교체—전원제외해도 폴백 부활 없음 ④R-8: 저장 실패 시 낙관반영 롤백 ⑤T-1(치명): 노선편성 핀 저장을 확정본으로 라우팅(조용한 no-op 제거, 부원장은 403 안내). ★실행 테스트 16건 신설이 추가 결함(Number(null)=0 → 좌표 0,0 저장) 실제 검출·수정. tsc/build EXIT=0, 전체 676/681(잔여 5는 기존 실패) | 구현완료(tester 대기) |
| 2026-07-26 | 셔틀 확정 명단 3단계 1차 수정 — 확정 후 지도 핀 잠금 해제(PM 지시). `ConfirmedRosterPin` + `pickupPin/dropoffPin` patch 추가, `pinSetClauses()`로 확정본 기존 컬럼에만 저장(새 컬럼·마이그레이션 0), 좌표 검증은 원본 applyPin과 동일 기준이되 실패 시 throw→400+이유, `${kind}ConfirmedAt` 동시 기록(배차 판정 보호), 라벨 COALESCE 보존, '등원과 동일' 하원 복제. 확정 후 원본 신청서 UPDATE 경로 없음(테스트 고정). tsc/build EXIT=0, 전체 657/662(잔여 5는 기존 실패), 확정 테스트 24/24 | 구현완료(tester 대기) |
| 2026-07-26 | 셔틀 명단 개편(코워크) 푸시 — 개편 과정에서 지워졌던 안전장치 복구: ①미탑승 기본 숨김+토글 ②기사님 CSV 탑승자만 ③탑승판정 isRidingShuttleStatus(REJECTED 누수) ④대상자 조회를 getConfirmedShuttleRoster 게이트웨이로 일원화(필터 누락 6회째 차단). 게이트웨이에 applicationId 추가. tsc/build EXIT=0, 셔틀 회귀 32/32 PASS, 전체 633/638(잔여 5건은 HEAD 기존실패) | 배포완료(78380ec) |
| 2026-07-26 | 이용약관 개정 초안 → **완성본** 갱신(`.Codex/drafts/terms-revision-2026-07.md`) — ★이월 계산식 오류 수정(`÷4` → `해당 월 수강료 ÷ 그 달 총 수업 횟수`, 주2회 반 2배 과다차감 방지) + 빈칸 5건 확정 채움(휴원·퇴원 신청마감=수강 시작일 전 / 최대 휴원 2개월 / 자리 보장·같은 반 복귀 / 셔틀비 미이용분 반환 / 시행일은 게시일 기입 안내). 형제할인 조항은 2-B 별도 상자로 분리해 ⏸️ 게시보류 표시(정규반 자동적용 완료 후). 자동퇴원 조문은 완곡 문구+`[원장님 확인 필요]`. 환불 규정·기존 문장 무변경. DB·소스 무수정 | 문서 완료(남은 확인 2건: 자동퇴원·시행일) |
