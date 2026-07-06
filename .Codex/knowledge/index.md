# STIZ Knowledge Index

- 기준일: 2026-07-06
- 문서 수: 5
- 최근 지식: 공개 페이지 상단 바와 푸터 운영시간은 관리자 설정 `AcademySettings.operatingHours` 값을 사용한다.

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
- 다음 고도화는 홈페이지에 보이지만 관리자에서 제어되지 않는 고정 문구/정책/소셜 링크부터 단계적으로 편입한다.
