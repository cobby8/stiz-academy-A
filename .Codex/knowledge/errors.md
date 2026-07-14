# Errors And Traps

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
