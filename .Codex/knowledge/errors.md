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
