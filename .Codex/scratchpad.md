# STIZ 고도화 스크래치패드

## 현재 작업
- 작업명: 인스타 게시 서버 큐/cron 재시도화
- 상태: 검증 완료
- 범위: 선생님 빠른 업로드, 관리자 갤러리 초안, SocialPostDraft 큐, Vercel cron
- 기준일: 2026-07-09

## 진행 현황표
| 항목 | 상태 | 메모 |
| --- | --- | --- |
| 프로젝트 현황 파악 | 완료 | Next.js + Supabase + Prisma 기반 학원 홈페이지/관리 플랫폼 |
| 홈페이지-관리자 갤러리 통합 | 완료 | `GalleryPost` 기준으로 공개 갤러리 관리 |
| 인스타 게시물 자동 가져오기 | 완료 | Vercel cron 하루 1회 실행 |
| 선생님 빠른 업로드 | 완료 | `/staff/quick-post` 추가 |
| AI 인스타 초안 생성 | 완료 | Gemini 사용, 없으면 안전한 기본 문구 fallback |
| 선생님 직접 게시/관리자 보조 관리 | 완료 | `/staff/quick-post`에서 바로 게시, `/admin/gallery`에서 실패/관리 |
| 인스타 다중 사진 게시 | 완료 | 사진 2~10장은 캐러셀 컨테이너로 게시 |
| 인스타 미디어 처리 대기/재시도 | 완료 | Meta 컨테이너 처리 완료 확인 후 `media_publish` 일시 오류를 재시도 |
| 공지사항 소셜 홍보 발행 | 완료 | `GalleryPost` 없이 공지 이미지를 인스타 피드/스토리와 페이스북 광고 소재로 전환 |
| 이미지 저장 전 압축 | 완료 | `/api/upload` 전 브라우저에서 JPG 리사이즈/품질 압축 |
| 관리자 권한 보호 | 완료 | `/admin` 서버 레이아웃에서 DB role 기준 권한 확인 |
| UI 글자 대비 보강 | 완료 | 흰 배경/흰 글씨 또는 hover 대비 충돌 제거 |
| 업로드 UX 개선 | 완료 | 병렬 업로드, 진행률 표시, 성공 메시지 보강 |
| 인스타 게시 상태 분리 | 완료 | 홈페이지 갤러리 성공을 먼저 표시하고 인스타 게시를 후속 진행 |
| 홈 공지/인스타 갤러리 보강 | 완료 | 히어로 공지 목록 추가, Instagram CDN 이미지 허용, 기존 인스타 URL 갱신 |
| 인스타 서버 큐/재시도 | 완료 | 브라우저가 닫혀도 Vercel cron이 `PUBLISHING` 초안을 처리 |
| 타입 검증 | 완료 | `npx.cmd tsc --noEmit` 통과 |

## 작업 로그
- 2026-07-09: 인스타 게시를 브라우저 후속 호출에서 서버 큐/cron 방식으로 옮기고, 실패 시 최대 3회까지 예약 재시도하도록 변경.
- 2026-07-08: 홈 히어로 좌측 농구공 영역에 공개 공지 목록을 배치하고, 홈 갤러리의 인스타 CDN 이미지를 Next Image가 최적화해 표시하도록 보강.
- 2026-07-08: 홈페이지 갤러리 게시와 인스타그램 게시를 분리하고 `PUBLISHING` 상태/재시도 UI를 추가해 외부 게시 지연이 화면 성공 메시지를 막지 않게 개선.
- 2026-07-08: 선생님 빠른 업로드와 관리자 갤러리 수동 업로드에 3장 병렬 업로드, 진행률 표시, 성공 메시지/다음 행동 버튼을 추가.
- 2026-07-08: 관리자 사이드바 탭/메뉴 hover, 갤러리 라이트박스 버튼, 마이페이지 학생 선택의 흰 배경/흰 글씨 대비 충돌을 보강.
- 2026-07-08: 공지 상세 리치 HTML 본문에서 신청 URL이 자동 링크되도록 `sanitizeHtml` 옵션을 추가하고 `npx.cmd tsc --noEmit` 통과.
- 2026-07-08: `/admin` 서버 권한 체크, `/api/upload` 스태프 권한 체크, PC 로그인/역할별 진입점, 갤러리 저장 오류 메시지 처리 보강.
- 2026-07-08: 인스타 `media_publish` 단계의 `Media ID is not available` 일시 오류를 짧게 재시도하도록 보강.
- 2026-07-08: 인스타 자동 게시 전 미디어 컨테이너 처리 완료 상태를 기다리도록 수정해 `Media ID is not available` 실패 가능성을 낮춤.
- 2026-07-08: 모든 주요 이미지 업로드 흐름에 공통 브라우저 압축을 적용해 저장 전 JPG 리사이즈/품질 압축을 수행.
- 2026-07-08: 공지사항에서 갤러리 추가 없이 인스타 피드/스토리 발행과 페이스북 광고 소재 준비를 할 수 있는 소셜 발행 흐름 추가.

## 구현 기록
- 변경 파일: `src/lib/socialDrafts.ts`, `src/lib/socialPostPublishing.ts`, `src/app/api/cron/social-posts/route.ts`, `src/app/actions/social-posts.ts`, `src/app/staff/quick-post/QuickPostClient.tsx`, `src/app/admin/gallery/GalleryAdminClient.tsx`, `vercel.json`
- 주요 변경: `SocialPostDraft`에 시도 횟수/마지막 시도/다음 재시도 시간을 추가하고, `/api/cron/social-posts`가 5분마다 1건씩 인스타 게시를 처리.
- 적용 범위: 선생님 바로 게시, 관리자 초안 게시, 서버 자동 재시도.

## 테스트 결과
- `git diff --check` 통과
- `npx.cmd tsc --noEmit` 통과
- `npm.cmd run build` 예정

## 다음에 할 것
- 인스타에서 가져온 외부 이미지를 Supabase Storage로 캐싱해 홈/갤러리 이미지 안정성을 더 높인다.
