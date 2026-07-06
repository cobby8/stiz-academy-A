# STIZ Knowledge Index

- 기준일: 2026-07-06
- 문서 수: 5
- 최근 지식: 현재 프로젝트는 Cafe24 쇼핑몰이 아니라 STIZ 농구교실 다산점 홈페이지와 학원관리 플랫폼이다.

## 목차
- [architecture.md](architecture.md): 프로젝트 구조와 주요 기능
- [conventions.md](conventions.md): 작업/코딩/디자인 규칙
- [decisions.md](decisions.md): 기술 결정 이력
- [errors.md](errors.md): 에러와 주의할 함정
- [lessons.md](lessons.md): 작업 중 배운 교훈

## 현재 요약
- 공개 홈페이지와 관리자 시스템이 하나의 Next.js 앱 안에 있다.
- DB는 Supabase PostgreSQL이고 Prisma를 사용한다.
- Supabase PgBouncer 호환 때문에 DB 접근에 `$queryRawUnsafe` 사용 패턴이 많다.
- 사용자-facing 기능은 공개 홈페이지, 체험/수강 신청, 학부모 마이페이지, 관리자 운영 기능으로 나뉜다.
- 다음 고도화는 기록 기준으로 작은 단위부터 진행한다.
