# Errors And Traps

## PowerShell npm 실행 정책
- 현상: `npm run lint` 실행 시 `npm.ps1` 실행 정책 오류가 날 수 있다.
- 의미: 코드 문제가 아니라 PowerShell이 스크립트 실행을 막는 상태다.
- 해결: Windows에서는 `npm.cmd run lint`처럼 `.cmd` 실행 파일을 사용한다.

## ESLint 전체 실패
- 현상: 현재 전체 lint는 많은 오류를 낸다.
- 주요 원인: `any` 타입 금지, 루트 임시 JS 패치 스크립트의 `require()`, React 19 lint 규칙 위반.
- 해석: 타입 체크 통과와 별개로 lint 기준이 현재 코드 상태보다 엄격하다.
- 예방: 기능 작업과 lint 정리는 분리해서 진행한다.

## PgBouncer 와 Prisma ORM
- 현상: Prisma 기본 ORM 메서드로 바꾸면 배포 환경에서 DB 쿼리 문제가 생길 수 있다.
- 원인: Supabase PgBouncer 트랜잭션 모드가 prepared statement와 충돌할 수 있다.
- 예방: 기존 `$queryRawUnsafe`/`$executeRawUnsafe` 패턴을 무작정 교체하지 않는다.

## 개발 서버 종료 주의
- 금지: `taskkill //f //im node.exe`
- 이유: 다른 프로젝트 개발 서버와 Codex 관련 프로세스까지 모두 종료할 수 있다.
- 해결: 포트로 PID를 찾고 해당 PID만 종료한다.

## 인스타그램 첫 동기화 서버 액션 타임아웃
- 현상: 인스타 게시물은 DB에 저장됐지만 관리자 화면은 오류 페이지로 떨어질 수 있다.
- 원인: 게시물마다 중복 조회와 INSERT를 반복하면 Vercel 함수 응답 시간이 길어져 서버 액션이 중간에 끊긴다.
- 해결: 중복 ID를 한 번에 조회하고 신규 게시물을 묶음 INSERT하는 공통 동기화 함수로 처리한다.
- 예방: 외부 API 동기화는 버튼 액션 하나에 긴 반복 쿼리를 넣지 말고, cron/공통 함수/묶음 DB 작업으로 나눈다.
