# 최근 변경 추가
- 2026-07-09: `/admin/gallery`와 `InstagramFeedPreview`의 `lucide-react` 아이콘을 Material Symbols로 전환했다.
- 2026-07-09: `/admin/students` 엑셀 업로드 모달을 클릭 후 동적 로드하도록 분리했다.
- 2026-07-09: `/setup` 최초 관리자 생성 흐름을 서버 API로 옮겨 Supabase 브라우저 SDK를 제거했다.
- 2026-07-09: `/apply` 안내 HTML sanitize를 서버로 옮겨 `sanitize-html` client chunk를 제거했다.
- 2026-07-09: 관리자 shell 로그아웃 아이콘의 `lucide-react` import를 제거하고 Material Symbols 아이콘으로 바꿨다.
- 2026-07-09: 업로드 이미지 URL이 고유 파일명인 점을 활용해 `/uploads`와 Supabase Storage 업로드에 장기 캐시를 적용했다.
- 2026-07-09: 관리자 shell이 서버 인증 정보를 재사용하고 알림/체험 카운트 API 호출을 첫 렌더 뒤로 지연하도록 바꿨다.
- 2026-07-09: 공개 헤더, 테마 토글, 챗봇 버튼의 `lucide-react` 아이콘을 Material Symbols로 전환했다.
- 2026-07-09: 공개 헤더의 Supabase 계정 상태 확인을 `PublicAccountControls` 동적 컴포넌트로 분리했다.

# STIZ Knowledge Index

- 기준일: 2026-07-09
- 문서 수: 5
- 최근 지식: 관리자/선생님이 자주 쓰는 갤러리·인스타 미리보기 UI의 단순 아이콘도 Material Symbols를 우선 사용해 별도 아이콘 JS를 줄인다.

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
- 공개 헤더는 메뉴/테마/큰글씨 상태만 직접 관리하고, Supabase 계정 확인과 로그아웃 UI는 `PublicAccountControls`를 동적 로드한다.
- 공개 헤더, 테마 토글, 챗봇 버튼처럼 모든 공개 페이지에 붙는 단순 아이콘은 `lucide-react` 대신 Material Symbols 텍스트 아이콘을 사용한다.
- 관리자 shell은 `requireAdmin()`에서 받은 사용자 이름/이메일을 사용하고, 로그아웃은 서버 액션으로 처리하며, 알림/체험 카운트 조회는 첫 렌더 후 지연 실행한다.
- 로컬 fallback 업로드 `/uploads/:path*`와 Supabase Storage 업로드 파일은 1년 immutable 캐시를 사용해 재방문 이미지 다운로드 비용을 줄인다.
- 관리자 shell의 로그아웃처럼 모든 관리자 화면에 포함되는 단순 아이콘은 별도 아이콘 라이브러리 import 대신 Material Symbols를 사용한다.
- `/apply` 안내 HTML은 서버에서 sanitize한 뒤 `ApplyPageClient`에 넘겨 `sanitize-html/htmlparser2`가 client bundle에 들어가지 않게 한다.
- `/setup` 최초 관리자 생성은 서버 API에서 Auth 사용자 생성, `User` row upsert, 로그인 쿠키 설정까지 처리해 client bundle에 Supabase 브라우저 SDK가 들어가지 않게 한다.
- `/admin/students`의 엑셀 업로드 모달처럼 목록에서 가끔 쓰는 대형 보조 UI는 `next/dynamic`과 조건부 렌더로 클릭 후 로드한다.
- `InstagramFeedPreview`처럼 관리자와 선생님 화면이 공유하는 미리보기 컴포넌트는 단순 아이콘을 Material Symbols로 유지한다.
