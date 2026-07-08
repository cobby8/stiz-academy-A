# Errors And Traps

## PowerShell npm 실행 정책
- 현상: `npm run lint` 실행 시 `npm.ps1` 실행 정책 오류가 날 수 있다.
- 원인: 코드 문제가 아니라 PowerShell 스크립트 실행 제한이다.
- 해결: Windows에서는 `npm.cmd run lint`, `npx.cmd tsc --noEmit`처럼 `.cmd` 실행 파일을 사용한다.

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
