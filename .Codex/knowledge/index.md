# STIZ Knowledge Index

- 기준일: 2026-07-08
- 문서 수: 5
- 최근 지식: 주요 이미지 업로드는 `/api/upload` 전 브라우저에서 JPG 리사이즈/품질 압축을 거쳐 저장한다.

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
- 공지사항 홍보는 `SocialCampaignPost`에 기록하고 공개 갤러리에는 추가하지 않는다.
- 선생님 업로드, 관리자 갤러리, 공지, 코치 사진, 수업 로그, 페이지 빌더 이미지는 저장 전 공통 압축 함수를 사용한다.
