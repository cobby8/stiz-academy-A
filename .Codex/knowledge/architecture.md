## 2026-07-11 관리자 초기 payload 메모
- `src/lib/adminReadPayloads.ts`는 수강생/반/체험 CRM의 캐시된 읽기 payload를 제공하며, API route와 서버 페이지가 같은 캐시 키와 태그를 공유한다.
- `/admin/students`, `/admin/classes`, `/admin/trial`은 페이지 서버 렌더링에서 초기 데이터를 받아 클라이언트 컴포넌트에 넘기고, 초기 데이터가 있을 때 첫 `useEffect` API 재호출을 건너뛴다.
- 저장/삭제/상태 변경 이후에는 기존 API 재조회와 Server Action의 `revalidateTag`가 함께 동작해 화면 갱신과 캐시 무효화를 유지한다.

## 2026-07-11 관리자 대시보드 속도 메모
- `/api/admin/dashboard`는 관리자 권한 확인 후 15초 `unstable_cache`로 동일한 읽기 결과를 짧게 재사용한다.
- `/api/admin/dashboard/system`은 5분 서버 캐시를 쓰며, `/admin` 첫 진입에서는 자동 호출하지 않고 시스템 상태 카드의 확인 버튼으로만 조회한다.
- 관리자 공통 알림은 첫 렌더/idle 자동 조회와 120초 폴링을 하지 않고, 알림 버튼을 열 때만 `/api/admin/notifications`를 호출한다.

## 2026-07-11 관리자 공통 읽기 캐시 메모
- `/api/admin/schedule`은 외부 Google Sheets를 직접 fetch하지 않고, 동기화 작업이 저장해 둔 `SheetSlotCache` 슬롯을 읽는다.
- 학생 선택 목록, 코치 선택 목록, 학원 설정, 신규 체험 카운트처럼 여러 관리자 화면에서 반복 호출되는 API는 권한 확인 후 짧은 private/server cache를 사용한다.
- 관리자 클라이언트에서 같은 API를 부를 때 `cache: "no-store"`를 남발하지 않는다. 문 앞에서 신분 확인은 매번 하되, 안쪽 서류 묶음은 몇 초 재사용하는 구조다.

## 2026-07-11 시간표 동기화 메모
- Google Sheets 시간표는 자동 cron으로 매번 맞추지 않고, 관리자 시간표의 “지금 동기화” 버튼을 눌렀을 때만 외부 시트를 읽어 `SheetSlotCache`에 저장한다.
- 공개 `/schedule`, `/simulator`, 관리자 `/admin/schedule`은 모두 Google Sheets를 직접 기다리지 않고 DB에 저장된 캐시만 읽는다.
- `/api/cron/sync-schedule`은 예비 엔드포인트로 남겨 두되, `vercel.json` cron 등록은 제거해 기본 운영을 수동 동기화로 둔다.

## 2026-07-11 수납/통계 속도 메모
- `/api/admin/finance`는 관리자 권한 확인 후 월별 수납 목록/요약을 30초 캐시한다.
- `/api/admin/stats`는 운영 통계 묶음을 60초 캐시한다.
- 수납 생성/상태 변경/삭제/월별 청구서 생성/미납 알림 후에는 `admin-finance`, `admin-stats` 태그를 즉시 무효화한다.
- 월별 수납 조건은 `EXTRACT(YEAR/MONTH FROM dueDate)` 대신 `dueDate >= 월 시작 AND dueDate < 다음 달 시작` 범위 조건을 쓴다.

# Architecture

## 프로젝트 성격
STIZ 농구교실 다산점의 홈페이지와 학원관리 플랫폼이다. 일반 쇼핑몰의 상품/장바구니/주문 구조가 아니라, 수업 신청과 학원 운영을 중심으로 구성되어 있다.

## 기술 스택
- Next.js 16 App Router
- React 19
- TypeScript
- Prisma 5
- Supabase PostgreSQL/Auth/Storage
- Tailwind CSS 4
- Vercel 배포와 Cron

## 주요 영역
- 공개 홈페이지: `/`, `/about`, `/programs`, `/schedule`, `/annual`, `/gallery`, `/notices`, `/faq`, `/apply`
- 학부모 영역: `/mypage`, `/mypage/reports`, `/mypage/skills`
- 관리자 영역: 사이트 콘텐츠, 학원 운영, 학생/출결/결제/SMS/스태프 관리
- 스태프 빠른 업로드: `/staff/quick-post`

## 관리자 레이아웃
- 관리자 공통 레이아웃은 `/admin/layout.tsx`에서 제어한다.
- 데스크톱은 왼쪽 고정 사이드바와 `md:ml-64` 본문 구조를 사용한다.
- 모바일은 상단 헤더의 메뉴 버튼으로 슬라이드 사이드바를 열고, 본문은 전체 화면 폭을 사용한다.
- 관리자 공통 셸은 운영 화면에서 DB 구조 변경이나 인덱스 생성 작업을 자동 실행하지 않는다. 인덱스/DDL은 배포 전 마이그레이션이나 별도 관리 작업으로 처리한다.
- 관리자 인증 확인은 Supabase `getClaims()`를 먼저 사용하고, 관리자/스태프 role 조회는 짧은 서버 메모리 캐시로 반복 DB 조회를 줄인다.
- 관리자 공통 셸은 알림을 클릭할 때만 조회하고, 체험 신청 배지를 위한 `trial-count` 자동 조회는 하지 않는다.
- 관리자 대시보드 `/admin`은 서버 렌더에서 통계 DB 조회를 직접 기다리지 않고 `/api/admin/dashboard`와 `/api/admin/dashboard/system`을 클라이언트에서 호출해 채운다.
- 학생 관리 `/admin/students`는 서버 렌더에서 학생/반 목록을 기다리지 않고 `/api/admin/students`를 클라이언트에서 호출해 채우며, 학생 목록 API는 Enrollment를 CTE로 한 번에 집계해 학생별 반복 subquery를 피한다. API 응답은 60초 서버 캐시를 쓰고 학생/수강 변경 시 태그를 무효화한다.
- 운영 통계 `/admin/stats`도 서버 렌더에서 7개 집계를 기다리지 않고 `/api/admin/stats`를 클라이언트에서 호출해 채운다.
- 체험수업 CRM `/admin/trial`은 서버 렌더에서 리드/통계를 기다리지 않고 `/api/admin/trial`을 클라이언트에서 호출해 채운다.
- 스태프 관리 `/admin/staff`는 서버 렌더에서 스태프/코치/초대 목록을 기다리지 않고 `/api/admin/staff`를 클라이언트에서 호출해 채운다.
- 대기자 관리 `/admin/waitlist`는 서버 렌더에서 대기자/정원/반 목록을 기다리지 않고 `/api/admin/waitlist`를 클라이언트에서 호출해 채운다.
- 수강 신청 관리 `/admin/apply`는 서버 렌더에서 신청/통계/반 목록을 기다리지 않고 `/api/admin/apply`를 클라이언트에서 호출하며, 안내 설정은 설정 탭 진입 시 `/api/admin/apply/settings`로 별도 조회한다.
- 수납 관리 `/admin/finance`는 서버 렌더에서 결제 목록/요약을 기다리지 않고 `/api/admin/finance`를 클라이언트에서 호출해 채운다.
- 보강 관리 `/admin/makeup`은 서버 렌더에서 보강 예약/반 목록을 기다리지 않고 `/api/admin/makeup`을 클라이언트에서 호출해 채운다.
- 수업 리포트 목록 `/admin/attendance/report`는 서버 렌더에서 최근 수업 리포트 목록을 기다리지 않고 `/api/admin/attendance/report`를 클라이언트에서 호출해 채운다.
- 시간표 관리 `/admin/schedule`은 서버 렌더에서 설정/시간표 override/코치/직접 슬롯/프로그램/외부 Google Sheets를 기다리지 않고, `/api/admin/schedule`이 `SheetSlotCache`에 동기화된 슬롯을 읽어 클라이언트에서 채운다.
- 청구 템플릿 `/admin/finance/billing`은 서버 렌더에서 청구 템플릿/프로그램 목록을 기다리지 않고 `/api/admin/finance/billing`을 클라이언트에서 호출해 채운다.
- 프로그램/코치/FAQ/연간일정/SMS 템플릿/청구 템플릿 관리자 읽기 API는 권한 확인 후 60초 서버 캐시를 사용하고, 관련 저장/삭제/순서변경 액션에서 태그 캐시를 즉시 무효화한다.
- 반/체험/수강신청/대기자/보강 관리자 읽기 API도 권한 확인 후 30~60초 서버 캐시를 사용하고, 관련 저장 액션에서 태그 캐시를 즉시 무효화한다.
- 스킬 트래킹 `/admin/skills`는 서버 렌더에서 스킬 카테고리 목록을 기다리지 않고 `/api/admin/skills`를 클라이언트에서 호출해 채운다.
- 반 관리 `/admin/classes`는 서버 렌더에서 프로그램/반 목록을 기다리지 않고 `/api/admin/classes`를 클라이언트에서 호출해 채운다.
- 코치 관리 `/admin/coaches`는 서버 렌더에서 코치 목록을 기다리지 않고 `/api/admin/coaches`를 클라이언트에서 호출해 채운다.
- 연간일정 관리 `/admin/annual`은 서버 렌더에서 일정/ICS 설정을 기다리지 않고 `/api/admin/annual`을 클라이언트에서 호출해 채운다.
- 후기 관리 `/admin/testimonials`는 서버 렌더에서 후기/네이버 링크를 기다리지 않고 `/api/admin/testimonials`를 클라이언트에서 호출해 채운다.
- FAQ 관리 `/admin/faq`는 서버 렌더에서 FAQ 목록을 기다리지 않고 `/api/admin/faq`를 클라이언트에서 호출해 채운다.
- 출석 관리 `/admin/attendance`는 서버 렌더에서 반 목록을 기다리지 않고 `/api/admin/attendance`를 클라이언트에서 호출해 채우며, 같은 API가 선택 반/날짜 출석 조회도 처리한다.
- 공지 관리 `/admin/notices`는 서버 렌더에서 공지/반 목록을 기다리지 않고 `/api/admin/notices`를 클라이언트에서 호출해 채운다.
- 프로그램 관리 `/admin/programs`는 서버 렌더에서 프로그램 목록을 기다리지 않고 `/api/admin/programs`를 클라이언트에서 호출해 채운다.
- 요청 관리 `/admin/requests`는 서버 렌더에서 학부모 요청 목록을 기다리지 않고 `/api/admin/requests`를 클라이언트에서 호출해 채운다.
- 갤러리 관리 `/admin/gallery`는 서버 렌더에서 갤러리/반/인스타 설정/소셜 초안을 기다리지 않고 `/api/admin/gallery`를 클라이언트에서 호출해 채운다.
- 피드백 관리 `/admin/feedback`은 서버 렌더에서 피드백 목록을 기다리지 않고 `/api/admin/feedback`을 클라이언트에서 호출해 채운다.
- SMS 템플릿 `/admin/sms/templates`는 서버 렌더에서 템플릿 조회/보장 작업을 기다리지 않고 `/api/admin/sms/templates`를 클라이언트에서 호출해 채운다.
- 학원 설정 `/admin/settings`는 서버 렌더에서 학원 설정 조회를 기다리지 않고 `/api/admin/settings`를 클라이언트에서 호출해 채운다.
- 개인정보처리방침 `/admin/privacy`는 서버 렌더에서 개인정보 설정 조회를 기다리지 않고 `/api/admin/settings`를 클라이언트에서 호출해 채운다.
- 이용약관 `/admin/terms`는 서버 렌더에서 이용약관 설정 조회를 기다리지 않고 `/api/admin/settings`를 클라이언트에서 호출해 채운다.
- 리포트 상세 편집 `/admin/attendance/report/[sessionId]`는 서버 렌더에서 리포트/코치 조회를 기다리지 않고 `/api/admin/attendance/report/[sessionId]`를 클라이언트에서 호출해 채운다.

## 주요 데이터 모델
- 사용자/권한: `User`, `StaffInvitation`, `Role`
- 학생/보호자: `Student`, `Guardian`, `Enrollment`
- 수업 운영: `Program`, `Class`, `Session`, `Attendance`, `StudentSessionNote`
- 홈페이지 콘텐츠: `AcademySettings`, `Coach`, `AnnualEvent`, `GalleryPost`, `Notice`, `Faq`, `Testimonial`
- 인스타 자동화 초안: `SocialPostDraft` raw SQL 테이블

## 홈페이지-관리자 연결
- 메인 홈과 `/gallery`는 `GalleryPost` 공개 데이터를 기준으로 표시한다.
- 공개 사진 관리는 `/admin/gallery`에서 `GalleryPost` 게시물로 통일한다.
- `AcademySettings.galleryImagesJSON`은 호환 필드로 남아 있지만, 관리자 설정 화면에서는 더 이상 편집하지 않는다.
- 공개 페이지 상단 바와 푸터 운영시간은 `AcademySettings.operatingHours`를 사용한다.
- 개인정보처리방침은 `AcademySettings.privacyPolicy`에 저장하고 `/admin/privacy`에서 관리한다.
- Instagram/YouTube/네이버 플레이스/카카오 채널 링크는 `AcademySettings` 설정값을 사용한다.

## 이미지 업로드
- 주요 이미지 업로드 화면은 `/api/upload` 전 `compressImageForUpload`를 거친다.
- 브라우저 `canvas`로 사진 긴 변을 줄이고 JPG 품질을 단계적으로 낮춰 저장소에 들어가는 원본 용량을 줄인다.
- GIF는 움직임 보존을 위해 재압축하지 않고 5MB 이하만 허용한다.
- 적용 영역은 선생님 빠른 업로드, 관리자 갤러리, 공지 본문/첨부, 코치 사진, 수업 로그, 페이지 빌더 이미지다.

## 인스타그램 연동
- Instagram API 토큰은 DB에 저장하지 않고 서버 환경변수 `INSTAGRAM_ACCESS_TOKEN` 또는 `META_ACCESS_TOKEN`로 읽는다.
- Instagram Business Account ID와 자동 업로드 ON/OFF는 관리자 설정에서 관리한다.
- 기존 인스타 게시물 가져오기는 `/api/cron/instagram-gallery` Vercel cron으로 하루 1회 실행한다.
- `GalleryPost`는 `source`, `externalId`, `externalUrl`, `instagramMediaId`, `instagramPermalink`, `instagramPublishedAt`, `instagramPublishError`로 가져오기/게시 상태를 기록한다.

## 선생님 인스타 자동화
- `/staff/quick-post`에서 선생님이 휴대폰 사진을 올리고 수업 메모를 입력한다.
- 브라우저에서 사진을 먼저 압축한 뒤 `/api/upload`로 업로드한다.
- `generateSocialCaptionDraft`가 Gemini로 제목/본문/해시태그를 생성하고, API 키가 없으면 안전한 기본 문구를 만든다.
- 초안은 `SocialPostDraft`에 `READY` 상태로 저장된다.
- 선생님은 본인이 만든 초안을 인스타 피드 미리보기에서 수정한 뒤 승인 과정 없이 바로 게시할 수 있다.
- 바로 게시 시 홈페이지 `GalleryPost`가 생성/갱신되고, 인스타그램 게시도 함께 시도한다.
- `/admin/gallery`는 관리자/부관리자가 대기 또는 실패 초안을 확인하고 재게시/반려하는 보조 관리 화면으로 남긴다.
- 사진 1장은 단일 게시, 사진 2~10장은 캐러셀 게시로 처리한다.

## 공지사항 소셜 캠페인
- `/admin/notices`에서 공지사항별 소셜 발행 모달을 열 수 있다.
- 공지 본문 이미지와 첨부 이미지를 모아 인스타 피드, 인스타 스토리, 페이스북 광고 소재 초안으로 전환한다.
- 공지사항 홍보는 공개 갤러리 게시물이 아니므로 `GalleryPost`를 만들지 않는다.
- 발행/준비 기록은 `SocialCampaignPost` raw SQL 테이블에 저장한다.
- 페이스북 광고는 현재 Marketing API 직접 생성이 아니라 광고관리자에 붙여 넣을 문구와 링크를 준비하는 방식이다.

## 현재 확인 상태
- `npx.cmd tsc --noEmit` 통과.
- 전체 lint는 기존 `any`, 임시 JS 스크립트 `require()`, React 19 lint 규칙 위반 때문에 별도 정리 작업이 필요하다.
- 개발 서버 기본 포트는 4000이다.
