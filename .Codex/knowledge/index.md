# STIZ Knowledge Index

- 기준일: 2026-07-08
- 문서 수: 5
- 최근 지식: 선생님은 `/staff/quick-post`에서 사진 업로드 후 AI 초안을 확인하고, 승인 과정 없이 홈페이지 갤러리와 인스타그램 게시를 바로 시도할 수 있다.

## 목차
- [architecture.md](architecture.md): 프로젝트 구조와 주요 기능
- [conventions.md](conventions.md): 작업/코딩/디자인 규칙
- [decisions.md](decisions.md): 기술 결정 이력
- [errors.md](errors.md): 에러와 주의할 함정
- [lessons.md](lessons.md): 작업 중 배운 교훈

## 현재 요약
- 현재 프로젝트는 STIZ 농구교실 다산점 홈페이지와 학원관리 플랫폼이다.
- DB는 Supabase PostgreSQL이고 Prisma를 사용한다.
- Supabase PgBouncer 호환 때문에 DB 구조 보강은 `$queryRawUnsafe`/`$executeRawUnsafe` 패턴을 자주 쓴다.
- 공개 홈페이지와 관리자 페이지가 같은 Next.js 앱 안에 있다.
- 메인 홈과 `/gallery`는 `GalleryPost`를 기준으로 갤러리를 표시한다.
- Instagram API 토큰은 서버 환경변수에 두고, 계정 ID와 자동 업로드 ON/OFF는 관리자 설정에서 관리한다.
- 인스타그램 기존 게시물 가져오기는 Vercel cron으로 하루 1회 실행된다.
- 선생님 인스타 자동화는 `SocialPostDraft` 초안을 거치지만, 본인이 만든 초안은 선생님이 바로 게시할 수 있다.
