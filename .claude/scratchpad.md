# 작업 스크래치패드

## 현재 작업
- **요청**: ①승차위치 아파트/건물명 표시 ②무료탑승 드래그 ③T맵 활성화 ④순서변경 시각 재계산
- **상태**: 구현·tsc·셔틀테스트 100/100 통과·커밋 완료 (미푸시 5개, 브라우저 수동 검증 대기)
- **현재 담당**: pm
- **마지막 세션**: 2026-07-26

## 진행 현황
| 항목 | 상태 |
|------|------|
| 셔틀 확정 명단 0~2단계(게이트웨이) | 완료·배포 |
| 셔틀 확정 명단 3단계(확정 UI·확정본 편집·핀) | 완료·배포 |
| 승차위치 아파트/건물명 표시(카카오 장소명) | 완료·커밋(수동검증 대기) |
| 자동배차 무료탑승 드래그 지정 | 완료·커밋(수동검증 대기) |
| T맵 최적경로 활성화(startTime·viaPointId 버그 수정) | 완료·커밋(테스트 통과) |
| 배차 순서변경 시 시각 재계산 | 완료·커밋(수동검증 대기) |
| 셔틀 확정 명단 4~5단계(변동 감지·재발 방지 가드) | 대기 |
| 정규반 형제할인 자동화 | 대기(시트 수동 10% 이중적용 위험 확인 필요) |
| 미푸시 커밋 | 5개 |

## 구현 기록 (developer)

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
| 2026-07-26 | **T맵 최적경로 활성화 + 배차 순서변경 시각 재계산** — ①T맵이 늘 400(9401)로 실패해 직선추정으로 내려가던 원인 2건 규명(실 키로 API 직접 진단): `startTime` 필수 누락, `viaPointId "0"`을 값없음 취급. tmap.ts에 startTime 추가 + 내부 안전id(wpN) 전송 후 원래 id로 복원(호출부 계약 유지). ②배차 화면 reorderStop이 순서만 바꾸고 시각 미갱신 → recomputeRunTimes(서버 planRun과 동일 공식, 학원 도착/출발 기준 역산·T맵총시간 재배분) 연결. tsc EXIT=0, tmap 14/14(단언 2건 신설)·셔틀 100/100. errors.md에 T맵 버그 기록. 커밋 965ceec | 구현완료(수동검증 대기) |
| 2026-07-26 | **승차위치 아파트/건물명 표시 + 자동배차 무료탑승 드래그** — ①MapLocationData에 placeName 추가, 카카오 검색 place_name 저장, 표시 이름표를 장소명→도로명→지번 순(신청폼·명단핀·노선편성핀 4곳). ②shuttle-optimize: 학생에 rosterId/requestId/pickupLabel 추가, 등원에서 '무료탑승' 라벨 학생을 거점 정류장에 붙여 계산(명단 무료탑승 학생이 집좌표로 가던 불일치 해소). DispatchClient: 학생칩 드래그→거점 드롭→pickupLocation='무료탑승·기존이름' 저장(기존 PATCH 재사용)→재계산, 거점에 지정학생 목록·인원수. tsc EXIT=0, 셔틀 명단필터 18/18·호환 1/1, location-picker 9/1(1은 기준선 기존실패, 무관). 커밋 eb2e11b·4fbf380 | 구현완료(수동검증 대기) |
| 2026-07-26 | 셔틀 확정 명단 3단계 **실 DB 읽기 검증(tester)** — tsc/build EXIT=0, 전체 657/662(잔여 5는 기준선 동일). 운영 DB SELECT 전용 검증: 테이블 실재·행 0(미확정 정상)·킬스위치 NULL(꺼짐)·컬럼 46개 중 SELECT/INSERT/핀16 **누락 0**·NOT NULL 충돌 0·UNIQUE(seasonId,shuttleRequestId) 실재·**확정 INSERT의 SELECT 절을 읽기 실행해 39/39 표현식 정상·18행 반환**. 폴백 명단 18행(탑승17/미탑승1) **취소·거절·폐강 오염 0건**(필터가 실제 2건 제외 중). → **확정 버튼 500 위험 없음, 눌러도 됨(예상 inserted=18)**. ★신규 치명 1건(T-1): 확정 후 `/admin/shuttle` 노선 편성 화면의 "위치 확정" 핀이 원본에만 써서 조용히 무시됨 | 검증완료(T-1 수정 필요) |
| 2026-07-26 | 셔틀 확정 명단 3단계 리뷰 — SQL 인젝션·$n 번호·핀 저장(ConfirmedAt/라벨보존/등원동일 복제)·soft delete·재확정 방지·안전장치 3종 전부 이상 없음. **치명 1(R-5)**: 확정 후에도 requestId 경로가 열려 있어 오래 열어둔 탭이 원본을 수정하고 "저장됨" 표시(확정본 미반영) → 409 거절 필요. 권장 4(R-6 SET 중복컬럼 500, R-7 전원제외 폴백부활·다음시즌 잠김, R-8 낙관롤백·되돌리기 세션한정, 테스트가 전부 문자열매칭이라 실동작 결함 미검출). tsc EXIT=0, 신규테스트 24/24 | 리뷰: 수정필요(R-5) |
| 2026-07-26 | 셔틀 확정 명단 3단계 2차 수정(리뷰 R-5/R-6/R-7①/R-8 + 테스터 T-1) — ①R-5(치명): 원본 수정 직전 서버가 확정본 조회→409 거절+화면 자동 새로고침 ②R-6: SET 조립을 의존성0 순수모듈로 분리, 컬럼중복 제거(42701 방지) ③R-7①: 확정 판정을 "확정본 존재(제외행 포함)"로 교체—전원제외해도 폴백 부활 없음 ④R-8: 저장 실패 시 낙관반영 롤백 ⑤T-1(치명): 노선편성 핀 저장을 확정본으로 라우팅(조용한 no-op 제거, 부원장은 403 안내). ★실행 테스트 16건 신설이 추가 결함(Number(null)=0 → 좌표 0,0 저장) 실제 검출·수정. tsc/build EXIT=0, 전체 676/681(잔여 5는 기존 실패) | 구현완료(tester 대기) |
| 2026-07-26 | 셔틀 확정 명단 3단계 1차 수정 — 확정 후 지도 핀 잠금 해제(PM 지시). `ConfirmedRosterPin` + `pickupPin/dropoffPin` patch 추가, `pinSetClauses()`로 확정본 기존 컬럼에만 저장(새 컬럼·마이그레이션 0), 좌표 검증은 원본 applyPin과 동일 기준이되 실패 시 throw→400+이유, `${kind}ConfirmedAt` 동시 기록(배차 판정 보호), 라벨 COALESCE 보존, '등원과 동일' 하원 복제. 확정 후 원본 신청서 UPDATE 경로 없음(테스트 고정). tsc/build EXIT=0, 전체 657/662(잔여 5는 기존 실패), 확정 테스트 24/24 | 구현완료(tester 대기) |
| 2026-07-26 | 셔틀 확정 명단 3단계 구현 — 화면 확정 배너/버튼(확정 전 안내+`N명 확정하기`, 확정 후 건수·확정일시 표시·버튼 숨김), 확정 후 저장은 rosterId로 확정본만 수정(원본 신청서 무변경), 행 제외/되돌리기(soft remove), GET에 confirmed/confirmedCount/confirmedAt 추가(roster 키 유지). 대상자 SQL 신규 작성 0(게이트웨이 경유), DB 스키마 변경 없음. tsc/build EXIT=0, 전체 650/655(잔여 5는 기존 실패), 신규 고정 테스트 17/17. ★확정 후 지도 핀 편집은 잠금 — PM 확인 필요 | 구현완료(tester 대기) |
| 2026-07-26 | 셔틀 명단 개편(코워크) 푸시 — 개편 과정에서 지워졌던 안전장치 복구: ①미탑승 기본 숨김+토글 ②기사님 CSV 탑승자만 ③탑승판정 isRidingShuttleStatus(REJECTED 누수) ④대상자 조회를 getConfirmedShuttleRoster 게이트웨이로 일원화(필터 누락 6회째 차단). 게이트웨이에 applicationId 추가. tsc/build EXIT=0, 셔틀 회귀 32/32 PASS, 전체 633/638(잔여 5건은 HEAD 기존실패) | 배포완료(78380ec) |
| 2026-07-26 | 이용약관 개정 초안 → **완성본** 갱신(`.Codex/drafts/terms-revision-2026-07.md`) — ★이월 계산식 오류 수정(`÷4` → `해당 월 수강료 ÷ 그 달 총 수업 횟수`, 주2회 반 2배 과다차감 방지) + 빈칸 5건 확정 채움(휴원·퇴원 신청마감=수강 시작일 전 / 최대 휴원 2개월 / 자리 보장·같은 반 복귀 / 셔틀비 미이용분 반환 / 시행일은 게시일 기입 안내). 형제할인 조항은 2-B 별도 상자로 분리해 ⏸️ 게시보류 표시(정규반 자동적용 완료 후). 자동퇴원 조문은 완곡 문구+`[원장님 확인 필요]`. 환불 규정·기존 문장 무변경. DB·소스 무수정 | 문서 완료(남은 확인 2건: 자동퇴원·시행일) |
| 2026-07-06 | 공지 리치에디터 7단계 검증(tester, 통합) — tsc/build EXIT=0(전체 라우트 컴파일). 붙여넣기 정제 happy-dom 격리검증 **30/30 PASS**(제거: style/script/조건부주석/o:p·mso/class·on*·빈span, 보존: 서식/링크/img/표/data-pm-slice). 공지500 재발경로無(DOMParser만·sanitize.ts 무변경 확인). 이미지붙여넣기 무충돌(handlePaste 선처리). 제출잠금 이중가드. onUploadingChange 옵셔널 설정페이지 무영향. 회귀無. 11/12통과·1미실시(로그인벽)·0실패. ★1~7 전체완료 확인 | 검증통과(커밋OK) |
