# Errors And Traps

## 정규반 청구액이 "첫 행 1건"만 읽혀 510만원 과소 청구됨 (2026-07-26)
- **분류**: architecture
- **발견자**: developer
- **현상**: 2026년 8월 정규반 청구가 14,041,750원(140건)으로 생성됐는데 실제 청구액은 19,141,000원(139명)이었다. 차액 **5,099,250원**. 게다가 8명(배수호·우지호·이성민·서우빈·이현일·김현호·신이준·여민재)은 청구서가 **아예 생성되지 않았다.**
- **원인 (버그 4개가 겹침)**:
  1. 구글시트 `등록` 탭은 **한 학생이 수업 1개당 1행**이다(주3회면 3행). 그런데 `importStudents.ts`의 `parseAndTransformCsv`가 `const best = candidates[0]`로 **대표 행 1건만** 골라 그 행의 수강료만 청구했다. 주1회 학생(82명)은 첫 행 = 합계라 **버그가 드러나지 않아** 오래 살아남았다.
  2. `결제방법`이 `추가수강`인 행이 첫 행이면 수강료 칸이 비어 있어 `s.amount`가 null → `if (s.amount && ... && s.paymentMethod)` 조건에서 걸러져 Payment가 통째로 안 만들어졌다.
  3. 학생 묶음 키가 `이름 + 학부모전화번호`였다. 같은 학생인데 행마다 부(父)/모(母)의 **다른 번호**를 적어 넣은 경우가 있어(김용준·김백찬·이하준·박서준 4명) 한 학생이 둘로 쪼개져 **수강료가 반토막**(180,000 → 90,000)났다.
  4. `detectColumnIndices`가 `결제액`/`금액`/`수강료`를 전부 하나의 `amount` 인덱스에 `else if` 체인으로 대입해, **헤더 순서에 따라 뒤 컬럼이 앞 컬럼을 덮어썼다.** 현재 시트는 우연히 `수강료`가 뒤에 있어 정상 동작했을 뿐, 시트에서 열 순서만 바뀌면 청구 기준 금액이 통째로 바뀐다.
- **해결**: 금액 규칙을 `src/lib/studentBilling.ts`(외부 의존성 0, 순수 함수)로 분리하고 `studentBilling.test.ts` 24개로 방어. 컬럼은 `수강료`/`셔틀비`/`이월`/`결제액`을 각각 별도 인덱스로 잡고 **처음 매칭된 컬럼만** 채택. 묶음 키는 `이름 + 생년월일`(없으면 전화번호 fallback).
- **예방**:
  - **"학생 1명 = 시트 1행"을 절대 가정하지 마라.** 이 시트는 수업 단위 행이다. 금액은 반드시 학생별 합계.
  - 회귀 지표를 "총액"으로만 보지 마라. 주1회 학생만 보면 버그가 안 보인다. **다행 학생 표본(김루하 210,000 = 70,000×3)을 반드시 포함**한다.
  - **셔틀비는 월 단위 값이라 첫 행에만 적힌다 → 절대 합산 금지.** 8월 실측 568,000원/45명, 두 행에 적힌 학생 0건.
  - **`이월`은 금액 차감이 아니라 행 제외다.** 시트 전체 2,186행에서 `이월` 금액 칸(M열)은 100% 비어 있고 `결제방법='이월'` 라벨로만 존재한다(전체 21건). 휴원·퇴원과 같이 그 행을 이번 달 청구에서 뺀다.
  - **형제할인을 코드에서 계산하지 마라.** 시트 금액에 이미 수기 반영돼 있다(72,000 = 80,000 × 0.9). 다시 곱하면 이중 할인 사고.
  - 시트에 여러 달이 섞여 들어오므로 합산 전 **반드시 같은 연/월 행으로 먼저 자른다.** 안 자르면 7월치와 8월치가 한 청구서로 합쳐진다.
  - 금액 컬럼 자동 감지를 `else if` 체인 + 단일 변수로 만들지 마라. 컬럼마다 인덱스를 따로 두고 첫 매칭만 채택한다.

## `Payment.classId`가 전건 NULL이라 교사 앱 청구 기능이 죽어 있었음 (2026-07-26)
- **분류**: architecture
- **발견자**: developer
- **현상**: `Payment` 300건 전부 `classId = NULL`이라 교사 앱의 청구·현금수납 확인이 아무것도 표시하지 못했다.
- **원인**: `import-students` 경로의 `createPaymentIfNeeded` INSERT문에 `classId` 컬럼 자체가 없었다.
- **해결**: 학생의 대표 반(수강료가 가장 큰 행의 `slotKey`, 동률이면 원본 행 번호가 빠른 쪽)을 `Class.slotKey`로 조회해 채운다. 8월 실측 139명 중 **137명(98.6%)** 채워지고, 2명은 `Tue-3` 반이 `Class`에 없어 NULL로 남는다(경고 로그).
- **한계 (반드시 인지)**: `Payment`는 학생당 월 1건이고 `PaymentInvoice`와 **1:1**이라 반별로 쪼갤 수 없다. 그래서 여러 반을 듣는 학생은 **대표 반 1개**만 기록되고, 그 학생의 청구는 **다른 반 담당 교사에게는 보이지 않는다.** 금액은 언제나 학생의 월 총액이며 반별로 나뉘지 않는다. 반별 분할이 필요해지면 `Payment`가 아니라 별도 라인아이템 모델을 만들어야 한다.
- **예방**: `sheet-reconcile`이 `DISTINCT ON (p."studentId")`로 학생당 1건을 가정하므로, Payment를 반별로 쪼개면 그 경로가 조용히 깨진다. 청구 단위를 바꾸려면 두 경로를 함께 고쳐야 한다.

## 승인 경로에 REGULAR 수강일 슬롯 생성 코드가 없어 수동 백필로 운영됨 (2026-07-25)
- **분류**: architecture
- **발견자**: developer
- **현상**: 방학특강 신청을 승인해도 날짜별 출석부(`/admin/seasonal/attendance`)에 학생이 나타나지 않았다. DB의 `SpecialProgramEnrollmentDate` 79행은 생성 시각이 신청 시각과 무관한 3개 배치로, 사람이 수동으로 넣은 값이었다.
- **원인**: 코드베이스 전체에서 `INSERT INTO "SpecialProgramEnrollmentDate"`는 `src/lib/seasonal/makeup.ts`의 `ensureSeasonalMakeupSlot` 한 곳뿐이고 거기서는 `kind='MAKEUP'`만 넣는다. 즉 `kind='REGULAR'` 슬롯을 만드는 애플리케이션 코드가 애초에 없었다. 출석부는 이 슬롯을 읽어 명단을 그리므로 승인만으로는 아무 것도 생기지 않는다.
- **해결**: `src/lib/seasonal/enrollment-dates.ts`의 `syncEnrollmentDatesForItem()`을 추가하고, 유일한 상태 변경 choke point인 `updateSpecialProgramItemStatus` 호출부(단건 `resource:"item"`, 일괄 `resource:"bulkItems"`) 뒤에 연결했다.
- **예방**:
  - "화면이 읽는 테이블에 행을 넣는 코드가 실제로 존재하는가"를 먼저 grep으로 확인한다. 운영 데이터가 있다고 해서 그 데이터를 만드는 코드가 있는 것은 아니다.
  - 수강일 슬롯 upsert는 반드시 `ON CONFLICT ("applicationItemId","sessionDateId") DO NOTHING`. `DO UPDATE`를 쓰면 이미 배정된 `kind='MAKEUP'` 보강 슬롯이 REGULAR로 덮여 보강 배정과 출결이 사라진다. (makeup.ts는 보강 배정이 의도적 덮어쓰기라 DO UPDATE를 쓰지만, REGULAR 백필은 절대 안 된다.)
  - 요일 판정은 반드시 서울시간(`weekdayInSeoul`, `src/lib/seasonal/planning.ts`). UTC 기준으로 판정하면 저녁 수업이 전날 요일로 밀린다.
  - 승인 부가 처리(슬롯 생성)는 `$transaction` **밖**에서 try/catch로 실행한다. 안에서 실행하면 부가 처리 실패가 승인 롤백으로 이어진다.

## 분기 안에서 이미 좁혀진 타입을 다시 비교하면 TS2367 발생
- 현상: `variant === "inline"` 분기 안에서 다시 `variant === "menu"`를 비교하자 `This comparison appears to be unintentional` 오류가 발생했다.
- 원인: TypeScript가 이미 해당 블록의 `variant` 타입을 `"inline"`으로 좁혔기 때문에 `"menu"`와 비교할 수 없다.
- 해결: inline 분기에서는 메뉴 닫기 조건을 제거하고, menu 분기의 버튼에서만 닫기 처리를 한다.
- 예방: 버튼 스타일/동작을 variant별로 나눌 때는 각 분기 안에 다른 variant 조건을 다시 넣지 않는다.

## 미완성 신규 페이지가 전체 타입검사를 막을 수 있음 (2026-07-20)
- 현상: 결제 화면 변경 파일 대상 검증은 통과했지만 `tsc --noEmit` 전체 실행이 `src/app/seasonal/[slug]/apply/page.tsx`의 `SeasonalApplyClient` 누락으로 실패했다.
- 원인: 계절특강 관련 파일과 Prisma 스키마 변경이 커밋되지 않은 별도 작업으로 섞여 있고, 일부 컴포넌트가 아직 완성되지 않았다.
- 해결: 현재 작업 커밋에는 결제 링크 파일만 분리해서 포함한다. 계절특강 작업을 이어갈 때는 누락 컴포넌트를 추가하고 Prisma client를 다시 생성한 뒤 전체 타입검사를 재실행한다.
- 예방: 큰 기능 초안 파일을 추가할 때는 import 대상 컴포넌트까지 함께 만들거나, 완성 전에는 라우트가 전체 타입검사에 포함되지 않도록 별도 브랜치에서 관리한다.

## 교사 초대 문자가 localhost 링크로 발송될 수 있는 문제 (2026-07-16)
- 원인: 운영 사이트 주소 환경변수가 없을 때 초대 URL이 개발용 localhost로 조용히 대체됐다.
- 해결: 파싱 가능한 HTTPS 운영 origin만 SMS에 사용하고, 주소가 없거나 localhost이면 초대만 생성한 뒤 문자 발송을 차단한다. 관리자는 현재 도메인으로 정규화된 개인 링크를 직접 복사한다.
- 예방: 외부로 발송되는 URL은 개발 fallback을 사용하지 않고 운영 origin 검증에 실패하면 fail-closed 처리한다.

## 수업 종료 후 화면이 그대로 남는 문제 (2026-07-15)
- 원인: `Session`을 `COMPLETED`로 저장한 뒤 학부모 알림을 동기 대기하여, 알림 조회나 발송 예외가 이미 성공한 종료 요청까지 실패처럼 전달됐다.
- 해결: 종료 저장과 알림을 분리하고 알림은 `Promise.allSettled`와 예외 격리로 처리한다. 클라이언트는 서버 예외를 확인창 안에 표시한다.
- 예방: 핵심 상태 변경 뒤 부가 알림·푸시는 핵심 성공 응답을 깨지 않도록 분리하고, 재시도 시 이미 완료된 상태도 성공으로 처리한다.

## 시간표 키는 항상 실제 Class 컬럼으로 확인한다
- 현상: 확인용 raw SQL에서 `Class.timeSlotKey`를 조회하면 `column c.timeSlotKey does not exist` 오류가 난다.
- 원인: `Mon-4` 같은 슬롯 키는 장부/코드에서 계산해 쓰는 값이고, `Class` 테이블의 실제 컬럼은 `dayOfWeek`, `startTime`, `endTime` 등으로 분리되어 있다.
- 해결: DB 직접 검증에서는 `dayOfWeek`, `startTime`, `endTime`을 조회하거나 코드의 슬롯 키 생성 함수를 거친 값을 비교한다.
- 예방: UI 표시용/계산용 필드와 DB 실제 컬럼을 혼동하지 않도록 raw SQL 작성 전 Prisma schema 또는 기존 쿼리를 확인한다.

## 수강생 월 표기는 숫자 추출로 파싱한다
- 현상: `2026년 7월` 같은 값에서 월을 뽑아 최신 월을 계산해야 하는데, 정규식/인코딩/캡처 방식에 따라 `20`처럼 연도 일부를 월로 잘못 잡을 수 있다.
- 원인: 한글 리터럴과 `substring(... from '([0-9]{1,2})월')` 조합은 운영 DB/스크립트 환경에서 기대와 다르게 동작할 수 있고, 문자열 앞의 `2026` 숫자가 먼저 잡힌다.
- 해결: `regexp_replace(registrationMonth, '[^0-9]+', ',', 'g')`로 숫자 배열을 만든 뒤 두 번째 숫자를 월로 사용한다. 예: `2026년 7월` → `["2026", "7"]`.
- 예방: 월별 운영 데이터는 표시 문자열을 직접 자르지 말고, 가능한 한 숫자 토큰이나 별도 year/month 컬럼을 기준으로 계산한다.

## 관리자 읽기 API no-store 남발
- 현상: 홈페이지는 빠른데 관리자 페이지 첫 진입과 메뉴 이동이 유독 느리다.
- 원인: 인증이 필요한 관리자 route에서 `force-dynamic`, `Cache-Control: no-store`, 클라이언트 `fetch(..., { cache: "no-store" })`, 자동 폴링이 겹치면 같은 통계/목록도 매 진입마다 DB를 다시 조회한다.
- 해결: 권한 확인은 매번 유지하되, 권한 확인 뒤의 공통 읽기 데이터는 `unstable_cache`와 짧은 private cache로 재사용하고, 시스템 점검/알림처럼 당장 필요 없는 API는 사용자 클릭 또는 충분히 늦은 idle 작업으로 내린다.
- 예방: 관리자 첫 화면에 API를 추가할 때는 “처음 화면에 꼭 필요한가”, “몇 초 캐시해도 괜찮은가”, “버튼을 눌렀을 때만 불러도 되는가”를 먼저 확인한다.

## Prisma db:push의 없는 옵션
- 현상: `npm.cmd run db:push`가 `unknown or unexpected option: --reject-data-loss`로 바로 실패했다.
- 원인: 현재 Prisma CLI의 `db push`에는 `--reject-data-loss` 옵션이 없다. 데이터 손실을 허용하는 옵션은 반대로 `--accept-data-loss`이며, 기본값은 데이터 손실 경고를 자동 승인하지 않는 쪽이다.
- 해결: `package.json`의 `db:push`는 `prisma db push`로 둔다. 운영 DB에 인덱스나 스키마를 적용할 때는 사용자 명시 승인 후 실행한다.
- 예방: Prisma CLI 옵션은 버전마다 달라질 수 있으므로, 스크립트가 오래됐으면 실제 명령을 한 번 검증한다.

## 관리자 속도 병목 오판 주의
- 현상: 관리자 페이지가 느리다고 해서 SQL 한 방이 무조건 느린 것으로 단정하기 쉽다.
- 확인: 2026-07-11 계측에서 원생 전체 조회는 265행 기준 DB 내부 실행 약 3.4ms였고, 실제 왕복은 40~70ms 수준이었다.
- 원인: 작은 SQL 여러 개가 인증/API 왕복과 함께 반복되면, 각각은 빨라도 화면 전체는 느리게 느껴진다.
- 해결: 먼저 읽기 전용 계측으로 SQL 실행 시간과 API 왕복을 분리하고, 단일 쿼리 튜닝보다 전역 자동 호출 제거/짧은 서버 캐시/저장 후 무효화를 우선 적용한다.

## Supabase MCP SQL 권한 없음
- 현상: Supabase MCP `_execute_sql` 호출이 `permission` 오류로 막힐 수 있다.
- 원인: 현재 연결된 MCP 권한이 해당 프로젝트 SQL 실행을 허용하지 않는다.
- 해결: 데이터 변경이 필요 없을 때는 로컬 `.env.local`의 Prisma 연결로 읽기 전용 `SELECT`/`EXPLAIN`을 수행한다. 운영 데이터를 바꾸는 SQL은 별도 승인을 받고 진행한다.

## PowerShell node -e에서 `$` 확장
- 현상: `node -e` 안의 `prisma.$queryRawUnsafe`가 PowerShell에서 `prisma.(`처럼 깨질 수 있다.
- 원인: PowerShell이 큰따옴표 안의 `$queryRawUnsafe`, `$disconnect`를 변수로 확장한다.
- 해결: 복잡한 Node 계측은 한 줄 `node -e`로 밀어붙이지 말고 `.tmp` 임시 스크립트로 실행한 뒤 커밋하지 않는다.

## 관리자 화면에서 외부 API 직접 대기
- 현상: 특정 관리자 메뉴가 DB 최적화 후에도 유난히 느릴 수 있다.
- 원인: `/api/admin/schedule`처럼 관리자 진입 API가 Google Sheets 같은 외부 네트워크를 직접 기다리면, DB가 빨라도 외부 응답 지연이 그대로 화면 속도가 된다.
- 해결: 화면 API는 이미 동기화된 로컬 DB 캐시(`SheetSlotCache`)를 읽고, 외부 동기화는 별도 수동/cron 작업이 담당하게 분리한다.
- 예방: 관리자 첫 화면 API는 “실시간 외부 호출”보다 “미리 받아 둔 캐시 읽기”를 우선한다. 음식점으로 치면 손님 앞에서 장을 보러 나가지 않고, 미리 준비해 둔 재료를 꺼내는 구조다.

## 월별 날짜 조회에서 EXTRACT 남발
- 현상: 수납/통계처럼 월별 조회가 데이터가 늘수록 점점 느려질 수 있다.
- 원인: `EXTRACT(YEAR FROM dueDate)`처럼 컬럼을 함수로 감싸면 DB가 날짜 인덱스를 바로 활용하기 어렵다.
- 해결: `dueDate >= 월 시작 AND dueDate < 다음 달 시작`처럼 범위 조건으로 조회한다.
- 예방: 달력에서 특정 월을 찾을 때는 모든 날짜 숫자를 다시 계산하지 말고, 시작일과 끝일 사이만 찾는 조건을 우선 사용한다.

# Errors And Traps

## PowerShell npm 실행 정책
- 현상: `npm run lint` 실행 시 `npm.ps1` 실행 정책 오류가 날 수 있다.
- 원인: 코드 문제가 아니라 PowerShell 스크립트 실행 제한이다.
- 해결: Windows에서는 `npm.cmd run lint`, `npx.cmd tsc --noEmit`처럼 `.cmd` 실행 파일을 사용한다.

## Next build Google Fonts 네트워크 제한
- 현상: `npm.cmd run build`가 `Failed to fetch ... from Google Fonts`로 실패할 수 있다.
- 원인: Next `next/font/google`이 빌드 중 Google Fonts CSS와 `fonts.gstatic.com` woff2 파일을 받아오는데, 현재 작업 환경의 네트워크 샌드박스 또는 외부 연결 불안정이 요청을 끊는다.
- 해결: 전역 `next/font/google` 후보 폰트를 제거하고 `src/lib/fonts.ts`의 폰트 선택값을 CSS fallback 스택으로 바꾼다. 이후 `npx.cmd next build`, `npx.cmd next build --webpack` 모두 Google Fonts 다운로드 없이 통과한다.
- 예방: 관리자에서 선택 가능한 후보 폰트를 전역 `next/font/google`로 등록하지 않는다. 특정 폰트를 반드시 보장해야 하면 Google 런타임/빌드 다운로드가 아니라 로컬 self-host 파일을 프로젝트 자산으로 둔다.

## Next build Turbopack 출력 지연
- 현상: `npx.cmd next build`가 `Creating an optimized production build ...` 이후 수십 초 이상 출력 없이 멈춘 것처럼 보일 수 있다.
- 원인: Turbopack 컴파일 워커가 오래 걸리면 중간 로그가 거의 나오지 않는다.
- 해결: 먼저 충분히 기다린다. 실제로 멈춘 빌드를 정리해야 하면 전체 `node.exe` 종료가 아니라 `next build` 명령줄을 가진 PID만 찾아 종료한다.
- 예방: 다른 프로젝트 개발 서버가 함께 떠 있는 Windows 환경에서는 `taskkill //f //im node.exe`를 사용하지 않는다.

## Windows Prisma generate DLL rename EPERM
- 현상: `npm.cmd run build`의 `prisma generate` 단계에서 `EPERM: operation not permitted, rename ... query_engine-windows.dll.node.tmp...` 오류가 날 수 있다.
- 원인: Windows에서 Prisma query engine DLL 파일이 기존 Node/빌드 프로세스 또는 보안 소프트웨어에 잠깐 잡혀 있으면 rename이 실패한다.
- 해결: 코드 검증이 목적이면 이미 생성된 Prisma Client를 사용해 `npx.cmd next build`로 Next 빌드를 먼저 확인한다. 프로세스 종료가 필요하면 전체 `node.exe` 종료가 아니라 포트/PID 기준으로 해당 프로세스만 종료한다.
- 예방: 빌드/개발 서버를 동시에 여러 개 띄운 상태에서 `prisma generate`를 반복 실행하지 않는다.

## 전역 next/font preload 폭증
- 현상: 홈 HTML에 `/_next/static/media/*.woff2` preload가 수백 개 붙어 첫 화면 로드가 심각하게 느려질 수 있다.
- 원인: 관리자에서 선택 가능한 한국어 Google 폰트 여러 종을 전역 `next/font`로 등록하면서 기본 preload가 켜져 있으면, 실제 선택 여부와 관계없이 모든 후보 폰트 조각을 선로딩한다.
- 해결: 최종적으로 전역 `next/font/google` 후보 폰트를 제거하고 CSS fallback 스택으로 전환한다.
- 예방: 빌드 산출물에서 `FontPreloadCount`와 HTML 리소스 참조 수를 확인하고, 전역 후보 폰트는 빌드/런타임 모두에 부담이 되는지 먼저 계산한다.

## Next build 정적 생성 중 Supabase 접속 실패 로그
- 현상: `npx.cmd next build`가 `Can't reach database server at aws-1-ap-northeast-2.pooler.supabase.com:6543` 로그를 많이 출력할 수 있다.
- 원인: 정적 페이지 생성 단계에서 공개/관리 페이지 데이터 조회 함수가 Supabase에 접근하지만, 현재 로컬/샌드박스 환경에서 DB 연결이 막혀 있다.
- 해석: 현재 쿼리 함수들이 fallback을 반환해 빌드 종료 코드는 0으로 끝난다. 배포 빌드 실패와는 다르게, 로컬 검증에서는 경고성 로그로 본다.
- 예방: 빌드 로그를 볼 때 Google Fonts 실패처럼 종료 코드를 막는 오류와, fallback으로 흡수되는 DB 연결 로그를 구분한다.

## 관리자 화면에서 인덱스/DDL 자동 실행 금지
- 현상: 관리자 페이지가 여전히 느리고, 첫 진입 뒤에도 DB가 바쁜 느낌이 날 수 있다.
- 원인: 사용자 화면의 idle 시간에 `CREATE INDEX IF NOT EXISTS` 같은 DB 구조 작업을 실행하면 화면 렌더와 직접 겹치지 않아도 DB 락/부하가 생겨 실제 관리자 API 응답을 밀어낼 수 있다.
- 해결: `/api/admin/performance-indexes`처럼 운영 화면에서 자동 실행되는 인덱스 보강 API를 제거하고, 인덱스는 Prisma schema/SQL 마이그레이션 또는 별도 운영 작업으로 적용한다.
- 예방: 읽기 화면에서 DDL을 실행하지 않는다. DDL은 건물 공사처럼 서비스 동선과 분리하고, 사용자가 누르는 화면에서는 데이터 조회/저장만 처리한다.

## 홈 인스타 갤러리 이미지 회색 박스
- 현상: 홈 갤러리에서 인스타그램에서 가져온 사진이 회색 박스와 alt 텍스트처럼 보일 수 있다.
- 원인: 홈은 `next/image`를 사용하므로 Instagram/Facebook CDN 호스트가 `next.config.ts`의 `images.remotePatterns`에 없으면 최적화 이미지 요청이 막힌다. 또한 Instagram CDN URL은 시간이 지나 바뀔 수 있다.
- 해결: `**.cdninstagram.com`, `**.fbcdn.net`을 허용하고, 인스타 동기화 시 기존 `GalleryPost`의 `mediaJSON` URL도 새로 갱신한다.

## ESLint 전체 실패
- 현상: 현재 전체 lint는 많은 기존 오류를 낸다.
- 주요 원인: 기존 `any`, 루트 임시 JS 스크립트의 `require()`, React 19 lint 규칙 위반.
- 해석: 타입체크 통과와 별개로 lint 기준이 현재 코드 상태보다 엄격하다.
- 예방: 기능 작업과 lint 정리는 별도 작업으로 분리한다.

## PgBouncer 대 Prisma ORM
- 현상: Prisma 기본 ORM 메서드로 바꾸면 배포 환경에서 DB 쿼리 문제가 생길 수 있다.
- 원인: Supabase PgBouncer transaction mode가 prepared statement와 충돌할 수 있다.
- 예방: 기존 `$queryRawUnsafe`/`$executeRawUnsafe` 패턴을 무작정 교체하지 않는다.

## 개발 서버 종료 주의
- 금지: `taskkill //f //im node.exe`
- 이유: 다른 프로젝트 개발 서버와 Codex 관련 프로세스까지 모두 종료될 수 있다.
- 해결: 포트로 PID를 찾고 해당 PID만 종료한다.

## 인스타그램 첫 동기화 서버 액션 타임아웃
- 현상: 인스타 게시물이 DB에 저장되지만 관리자 화면은 오류 페이지로 떨어질 수 있다.
- 원인: 게시물마다 중복 조회와 INSERT를 반복하면 서버 액션 시간이 길어진다.
- 해결: 중복 ID를 한 번에 조회하고 신규 게시물을 묶음 INSERT하는 공통 동기화 함수로 처리한다.

## TypeScript filter(Boolean) null 좁히기 실패
- 현상: `Promise.all(...).filter(Boolean)` 후에도 `null`이 남아 있다고 `TS2322`가 발생할 수 있다.
- 원인: 런타임에서는 null이 제거되지만 TypeScript 타입 추론은 Boolean 필터를 타입 가드로 보지 않는다.
- 해결: `(part): part is NonNullable<...> => part !== null`처럼 명시적 타입 가드를 사용한다.
- 예방: 외부 API/이미지 파트처럼 `null` 가능성이 있는 배열을 SDK에 넘길 때는 타입 가드를 명시한다.

## Instagram `Media ID is not available`
- 현상: 미디어 컨테이너 생성 직후 또는 처리 완료 확인 직후 `media_publish`에서 `Media ID is not available` 오류가 날 수 있다.
- 원인: Meta가 이미지 URL을 처리하고 게시 ID를 내부 시스템에 반영하는 데 시간이 더 걸릴 수 있다.
- 해결: `src/lib/instagram.ts`에서 컨테이너 `status_code`가 `FINISHED` 또는 `PUBLISHED`가 될 때까지 대기하고, 같은 오류가 나면 `media_publish`를 짧게 재시도한다.
- 예방: 단일 이미지, 스토리, 캐러셀 자식 이미지, 캐러셀 컨테이너 모두 게시 전 상태 확인을 거치고 발행 확정 단계의 일시 지연도 재시도로 흡수한다.

## 관리자 화면 접근은 미들웨어만 믿지 않는다
- 현상: 미들웨어가 로그인 여부만 확인하면 `PARENT` 같은 일반 로그인 사용자도 `/admin` 화면 HTML을 받을 수 있다.
- 원인: Supabase 미들웨어는 쿠키 기반 세션 확인에는 좋지만, DB `User.role` 기준 권한 확인은 서버 컴포넌트/서버 액션에서 다시 해야 한다.
- 해결: `/admin` 레이아웃을 서버 컴포넌트로 두고 렌더링 전 `requireAdmin()`을 통과한 경우에만 관리자 UI shell을 렌더링한다.
- 예방: 관리자 화면은 페이지 렌더링 전 권한 확인, 관리자 변경 작업은 Server Action 내부 권한 확인을 함께 둔다.

## 갤러리 업로드 후 전역 오류 화면
- 현상: 사진 파일 업로드는 성공했는데 게시물 저장 단계에서 캡처 화면처럼 전역 오류 화면으로 이동할 수 있다.
- 원인: `/api/upload`는 로그인만 확인하고, `createGalleryPost`는 관리자 권한을 확인하므로 권한 없는 사용자는 두 번째 단계에서 Server Action 예외가 난다.
- 해결: `/api/upload`를 `requireStaff()`로 보호하고, 갤러리 저장 예외는 `GalleryAdminClient` 폼 내부 메시지로 표시한다.
- 예방: 파일 업로드 API와 최종 저장 액션의 권한 수준을 맞추고, 예상 가능한 권한/저장 오류는 화면 안에서 처리한다.

## 흰 배경 위 흰 글씨 대비 충돌
- 현상: 관리자 사이드바 탭처럼 활성/hover 상태에서 메뉴 글씨가 보이지 않는다.
- 원인: 어두운 배경 기준으로 `text-white`를 유지한 채 활성 또는 hover 배경만 `bg-white`로 바뀌면 흰 종이에 흰 글씨가 된다.
- 해결: 실제 흰 배경을 쓰는 활성 탭은 `text-brand-navy-900`처럼 진한 글씨를 사용하고, 어두운 오버레이/사이드바 hover는 `bg-white/10`처럼 반투명 배경을 사용한다.
- 예방: `bg-white text-white`, `hover:bg-white hover:text-white` 조합을 전역 검색해 실제 충돌인지 확인한다.
## 관리자 page 파일의 깨진 주석 주의
- 증상: `classes/page.tsx`의 깨진 주석 안에 `revalidate` 텍스트가 섞여 TypeScript 중복 선언처럼 보였다.
- 해결: 짧은 page 파일은 깨진 주석을 유지하지 않고 ASCII 주석/명확한 export로 정리한다.
- 예방: 인코딩이 깨진 주석 주변에 설정 export를 추가할 때는 `npx.cmd tsc --noEmit`으로 중복 선언 여부를 바로 확인한다.

## `Student.birthDate` 비교식은 이중 시간대 적용이 아니다 (건드리지 말 것)
- 현상: `hasMatchingExistingStudent()`의 `((student."birthDate" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Seoul')::date`가 "시간대를 두 번 적용해 하루 밀린다"는 오진이 나오기 쉽다.
- 실제: `Student.birthDate` 컬럼은 `timestamp without time zone`(naive)이다. 첫 `AT TIME ZONE 'UTC'`는 naive→timestamptz **해석**, 두 번째 `AT TIME ZONE 'Asia/Seoul'`은 timestamptz→KST naive **변환**이다. 이중 적용이 아니라 정상적인 2단계 변환이다.
- 근거(2026-07-26 실측): 저장 형식이 두 가지로 섞여 있다 — `00:00:00`(151건) / `15:00:00`(144건). 시트 원본 생년월일과 대조한 결과 현재 식은 295건 중 **293건(99.3%) 정확**. 반면 naive 날짜부분(`birthDate::date`)을 그대로 쓰면 **149건(50.5%)만 정확**하다. 두 저장 형식 모두 "KST 자정의 UTC 순간"이라는 동일 의미를 갖기 때문이다.
- 예방: 이 식을 "고치기" 전에 반드시 `StudentSheetRawRow.rawJSON->>'수강생 생년월일'`과 대조해 실측하라. 컬럼이 `timestamptz`가 아니라 `timestamp`라는 점이 핵심이다.

## 방학특강 기존회원 판정: 진짜 결함은 재원 상태 미확인
- 현상: 휴원(`PAUSED`)·퇴원(`WITHDRAWN`)·과거 이력자가 "기존 회원"으로 판정되어 할인 단가가 적용된다.
- 원인: `hasMatchingExistingStudent()`가 이름+생년월일+연락처만 보고 `Enrollment` 상태를 전혀 확인하지 않는다.
- 실측(2026 여름특강 28명): 신규 19명 중 5명이 거짓 양성(전원 `PAUSED` 또는 등록 없음). 기존 9명 중 2명은 매칭 실패인데 원인이 코드가 아니라 **신청서 입력 오류**(전화번호 상이 1건, 생년월일 상이 1건)다.
- 예방: 재원 여부 판정은 프로젝트 전역 관례인 `Enrollment.status = 'ACTIVE'`를 쓴다. `PAUSED`는 반 이동 시 예전 반에도 남으므로 "학생 단위 ACTIVE 1건 이상" 기준으로 집계해야 한다.

## 🚨 셔틀 대상자 조회를 새로 짤 때마다 필터가 누락된다 — 4회 반복
- 현상: 자동 배차·명단 화면에 **폐강된 반의 취소 학생(나우준·문근우)** 이 다시 실린다. 고쳐도 다음 기능에서 또 나온다.
- 반복 이력:
  1. 기존 노선 화면(`shuttle/service.ts`) — 개설 취소 반(`SpecialProgramOffering.status='CANCELLED'`)을 안 걸렀다.
  2. 통합 명단(`seasonal/shuttle-roster.ts`) — `WHERE` 절 자체가 없어 취소자가 전부 들어왔다.
  3. 자동 배차(`seasonal/shuttle-optimize.ts`) — 오염된 명단을 그대로 받아 썼다. → 공용 모듈 `shuttleEligibility.ts` 신설로 1~3 해결(`4c87468`).
  4. **자동 배차 날짜별 재작성** — 공용 모듈이 있는데도 쓰지 않고 SQL을 손으로 새로 써서 `r.status <> 'CANCELLED'` 하나만 넣었다. 신청서·수강항목·개설반·`REJECTED`가 전부 다시 샜다.
- 근본 원인: **조회 구조를 바꾸면(명단 기준 → 날짜별 좌석 기준) SQL을 처음부터 새로 쓰게 되고, 그때 필터가 통째로 증발한다.** 기준이 4개(신청서/수강항목/개설반/셔틀)나 되는데 손으로 쓰면 매번 일부만 기억한다.
- 해결: `src/lib/seasonal/shuttleEligibility.ts`의 `seasonalShuttleEligibilitySql({ application, item, offering, shuttleRequest? })`를 **반드시 import해서 쓴다.** 새 쿼리에 별칭이 없으면 조건을 손으로 쓰지 말고 **JOIN을 추가**해 공용 조각을 그대로 끼운다.
- 예방:
  - 셔틀 대상자 SQL에 `status` 비교를 **직접 타이핑하면 그 자체가 버그 신호**다. 특히 `r.status <> 'CANCELLED'`는 `REJECTED`를 못 걸러 항상 틀리다.
  - `tests/seasonal-shuttle-roster-filter.test.mjs`가 소스에 공용 조각 호출이 있는지 문자열로 검사한다. 새 셔틀 조회를 만들면 이 테스트에 한 줄 추가할 것.
  - 셔틀 상태(`r.status`)는 **선택 인자**다. 통합 명단은 '미탑승 되돌리기' 때문에 SQL에서 거르면 안 되고, 자동 배차처럼 실제 탑승자만 뽑는 곳만 `shuttleRequest`를 넘긴다.
# 2026-08-26: Google 서비스 계정 JSON 한 줄 저장과 시트 403

- 원인: `GOOGLE_SERVICE_ACCOUNT_KEY`가 JSON 바깥 줄바꿈까지 리터럴 `\n`으로 저장되어 단순 `JSON.parse`가 실패했다.
- 해결: 문자열 내부의 개인키 이스케이프는 유지하고 JSON 바깥쪽 `\n`만 복구하는 `parseGoogleServiceAccount`를 공용으로 사용한다.
- 추가 상태: 인증 파싱 후 대상 수강생 시트 읽기는 HTTP 403. 서비스 계정 이메일에 대상 시트 편집자 공유가 필요하다.
- 보안: 진단 중 개인키가 명령 출력에 노출되어 해당 키를 폐기하고 새 키로 교체해야 한다. 이후 진단은 오류 코드만 출력한다.
- 예방: 인증 오류를 출력할 때 원본 환경변수나 파싱 대상 문자열을 로그에 포함하지 않는다.
- 후속: Google Cloud 콘솔 현재 로그인 계정에도 서비스 계정 키 관리 권한이 없어 키 생성·폐기가 차단됐다. 권한 있는 프로젝트 관리자 계정이 필요하다.

# 2026-08-26: 차량 변동 문자 발신번호 미등록

- 현상: 로컬 환경 설정으로 보낸 차량 변동 문자 11건이 Solapi에서 모두 `발신번호 미등록`로 거절됐다.
- 원인: 로컬 발신번호가 운영 Solapi 계정에 등록된 번호와 달랐다.
- 해결: Vercel 운영 환경 설정을 임시로 불러와 동일한 멱등 키로 재시도했고, 11건 모두 `SYNCED`로 확인했다. 운영 설정 임시 파일은 즉시 삭제했다.
- 예방: 문자 발송 전 운영 발신번호 설정을 사전 점검한다. 공급자가 접수한 메시지는 중복 재시도하지 않고, 접수 전 거절된 건만 동일 멱등 키로 재시도한다.
