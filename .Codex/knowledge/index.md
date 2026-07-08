# 최근 변경 추가
- 2026-07-09: `/admin/notices`의 `RichTextEditor`를 새 공지/수정 모달이 열릴 때만 동적 로드하도록 변경했다.
- 2026-07-09: 공개 갤러리 목록은 서버 렌더링으로 유지하고 전체화면 라이트박스 본체는 클릭 후 동적 로드하도록 분리했다.
- 2026-07-09: 홈 `LandingPageClient`를 서버 컴포넌트로 전환해 정적 홈 섹션의 초기 JS 부담을 줄였다.
- 2026-07-09: 공개 페이지의 챗봇 패널과 입학 가이드 투어 본체를 동적 로딩으로 분리했다.
- 2026-07-09: 전역 폰트 preload 폭증과 미설정 Meta Pixel 강제 로드를 제거하고, `AcademySettings` 서버 캐시를 추가했다.
- 2026-07-09: 공개 홈페이지 헤더와 마이페이지 헤더에 기존 `logout()` 서버 액션을 연결한 로그아웃 진입점을 추가했다.
- 2026-07-09: 선생님/관리자 초안의 인스타 게시를 브라우저 후속 호출에서 서버 큐와 Vercel cron 재시도로 옮겼다.
- 2026-07-08: 홈 히어로에 공개 공지 목록을 가볍게 표시하고, 인스타 CDN 이미지를 Next Image 최적화 허용 목록에 추가했다.
- 2026-07-08: 선생님/관리자 초안 게시에서 홈페이지 갤러리 반영과 인스타그램 게시를 분리하고 `PUBLISHING` 재시도 UI를 둔다.

# STIZ Knowledge Index

- 기준일: 2026-07-09
- 문서 수: 5
- 최근 지식: 관리자 목록 화면은 먼저 가볍게 보여주고, 리치 에디터처럼 큰 편집 도구는 작성/수정 모달이 열릴 때 동적 로드한다.

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
- 홈 히어로 공지는 `getNotices({ limit, publicOnly: true })`로 공개 공지만 작게 가져오고, 본문 HTML은 홈에 렌더하지 않는다.
- `/api/cron/social-posts`는 `PUBLISHING` 초안을 5분마다 1건씩 처리하고, 일시 실패는 `instagramNextRetryAt` 기준으로 최대 3회까지 예약 재시도한다.
- 공개 홈페이지와 마이페이지의 로그아웃 UI는 새 로그아웃 로직을 만들지 않고 `logout()` 서버 액션을 `form action`으로 연결한다.
- 전역 레이아웃의 Google 폰트는 `preload: false`로 두어 첫 화면에서 선택 후보 폰트 수백 개를 선로딩하지 않는다.
- `NEXT_PUBLIC_META_PIXEL_ID`가 없으면 Meta Pixel을 렌더하지 않는다. 기본 ID fallback은 전역 외부 스크립트 로드를 강제하므로 쓰지 않는다.
- `getAcademySettings()`는 5분 서버 캐시와 `academy-settings` 태그를 사용하며, 관리자 설정 저장 시 `revalidateTag(..., { expire: 0 })`로 즉시 무효화한다.
- 공개 페이지의 챗봇은 `ChatBotButton`만 초기 로드하고, `ChatPanel`은 버튼 클릭 후 `next/dynamic`으로 로드한다.
- 입학 가이드 투어는 `GuideTourLazyTrigger`를 공개 페이지에 붙이고, 기존 `GuideTourTrigger` 본체는 클릭, `?tour=` URL, 첫 방문 예열 시점에 로드한다.
- 홈 `LandingPageClient`는 서버 컴포넌트로 렌더링하고, `TestimonialCarousel` 같은 상호작용 섬만 클라이언트로 남겨 첫 화면 entry JS를 줄인다.
- 공개 갤러리는 `GalleryPublicClient`를 서버 렌더링으로 두고, `GalleryLightboxController`가 클릭만 감지하며 `GalleryLightboxOverlay`는 클릭 후 동적 로드한다.
- `/admin/notices`는 목록 초기 진입에서 `RichTextEditor`를 싣지 않고, 새 공지/수정 모달 렌더 시 `next/dynamic`으로 로드한다.
