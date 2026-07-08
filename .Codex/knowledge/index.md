# 최근 변경 추가
- 2026-07-08: 선생님/관리자 초안 게시에서 홈페이지 갤러리 반영과 인스타그램 게시를 분리하고 `PUBLISHING` 재시도 UI를 둔다.
- 2026-07-08: 선생님/관리자 갤러리 업로드는 공통 `uploadImagesWithProgress` 도우미로 압축 후 3장씩 병렬 업로드하고 진행률을 표시한다.
- 2026-07-08: 어두운 배경 위 메뉴/아이콘 hover는 순백 `bg-white` 대신 `bg-white/10`처럼 반투명 배경을 사용해 글자 대비를 유지한다.
- 2026-07-08: 리치 에디터 공지 본문의 일반 URL은 공지 상세 렌더링에서만 자동 링크화한다.

# STIZ Knowledge Index

- 기준일: 2026-07-08
- 문서 수: 5
- 최근 지식: 외부 인스타그램 게시처럼 느릴 수 있는 작업은 홈페이지 갤러리 저장 성공과 분리해 먼저 성공 메시지를 보여주고, 후속 게시 상태는 재시도 가능하게 관리한다.

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
- 인스타 자동 게시는 단일 이미지, 스토리, 캐러셀 모두 미디어 처리 완료 상태를 확인하고 발행 확정 단계의 일시 오류를 재시도한다.
- 관리자 화면 접근은 미들웨어 로그인 확인만 믿지 않고 서버 레이아웃에서 관리자 권한을 다시 확인한다.
- 어두운 사이드바/오버레이 위 버튼 hover는 `bg-white/10`처럼 투명도를 가진 배경을 써서 흰 아이콘과 글씨가 사라지지 않게 한다.
- 선생님/관리자 갤러리 업로드는 `src/lib/clientImageUpload.ts`의 `uploadImagesWithProgress`를 사용해 같은 압축/업로드/진행률 패턴을 공유한다.
- 선생님/관리자 초안 게시는 홈페이지 갤러리 반영을 먼저 완료 처리하고, 인스타그램 게시 결과는 `PUBLISHING`/`PUBLISHED`/`FAILED` 상태로 별도 표시한다.
