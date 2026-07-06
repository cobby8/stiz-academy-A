# STIZ Knowledge Index

- 기준일: 2026-07-06
- 문서 수: 5
- 최근 지식: 개인정보처리방침, 푸터 문구, SNS 링크, 인스타그램 갤러리 연동 기반이 관리자 설정과 갤러리 관리로 연결됐다.

## 목차
- [architecture.md](architecture.md): 프로젝트 구조와 주요 기능
- [conventions.md](conventions.md): 작업/코딩/디자인 규칙
- [decisions.md](decisions.md): 기술 결정 이력
- [errors.md](errors.md): 에러와 주의할 함정
- [lessons.md](lessons.md): 작업 중 배운 교훈

## 현재 요약
- 현재 프로젝트는 Cafe24 쇼핑몰이 아니라 STIZ 농구교실 다산점 홈페이지와 학원관리 플랫폼이다.
- DB는 Supabase PostgreSQL이고 Prisma를 사용한다.
- Supabase PgBouncer 호환 때문에 DB 접근에 `$queryRawUnsafe` 패턴이 많다.
- 공개 홈페이지와 관리자 페이지가 같은 Next.js 앱 안에 있다.
- 메인 홈 갤러리는 `GalleryPost`를 기준으로 통합했고, 기존 `AcademySettings.galleryImagesJSON`은 아직 삭제하지 않았다.
- 운영시간은 관리자 설정에서 입력하면 공개 페이지 상단 바와 푸터에 함께 반영된다.
- 개인정보처리방침은 `/admin/privacy`에서 관리하고 `/privacy`가 설정값을 표시한다.
- 푸터 소개/저작권/SNS 링크는 관리자 설정에서 관리한다.
- 인스타그램 연동은 환경변수 토큰과 Instagram Business Account ID가 준비되면 기존 게시물 가져오기와 새 갤러리 자동 업로드를 사용할 수 있다.
