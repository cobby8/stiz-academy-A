# STIZ 고도화 스크래치패드

## 현재 작업
- 작업명: 인스타그램 갤러리 자동 누적 안정화
- 상태: 완료
- 범위: 수동 가져오기 성능 개선, 오류 메시지 처리, Vercel cron 자동 동기화 추가
- 기준일: 2026-07-07

## 진행 현황표
| 항목 | 상태 | 메모 |
| --- | --- | --- |
| 프로젝트 현황 파악 | 완료 | Next.js 16 + Supabase + Prisma 기반 학원 운영 플랫폼 |
| 기록 구조 생성 | 완료 | `.Codex` 폴더와 knowledge 문서 생성 |
| 홈페이지/관리자 갭 점검 | 완료 | 갤러리 분리, 개인정보처리방침, 운영시간 등 갭 확인 |
| 메인 갤러리 통합 | 완료 | `/`가 공개 `GalleryPost` 이미지 데이터를 사용 |
| 운영시간 관리자 설정 연동 | 완료 | 관리자 설정값을 공개 헤더/푸터에 반영 |
| 개인정보처리방침 관리 | 완료 | `/admin/privacy`에서 `/privacy` 문구 관리 |
| 푸터/SNS 관리자 설정 | 완료 | 푸터 소개/저작권/SNS 링크를 설정값으로 반영 |
| 인스타그램 연동 기반 | 완료 | 기존 게시물 가져오기 및 새 갤러리 자동 업로드 구조 추가 |
| 관리자 설정 갤러리 입력 정리 | 완료 | 설정 화면에서 전용 갤러리 관리로 안내 |
| 인스타그램 자동 누적 | 완료 | 매시간 cron으로 새 인스타 게시물만 `GalleryPost`에 추가 |

## 작업 로그
- 2026-07-07: 인스타그램 가져오기 공통 로직을 분리하고 매시간 cron 자동 동기화와 관리자 버튼 오류 처리를 추가.
- 2026-07-06: 관리자 설정의 오래된 포토 갤러리 URL 입력을 제거하고 `/admin/gallery` 안내로 교체.
- 2026-07-06: 개인정보처리방침 관리 페이지, 푸터/SNS 설정, 인스타그램 갤러리 가져오기/자동 업로드 기반 추가.
- 2026-07-06: 공개 페이지 상단 바와 푸터 운영시간을 관리자 설정 `operatingHours`로 제어하도록 변경.
- 2026-07-06: 메인 홈 활동 사진 섹션을 관리자 갤러리 `GalleryPost` 공개 이미지 기준으로 변경.
- 2026-07-06: 프로젝트 현황 파악 및 `.Codex` 기록 구조 생성.

## 구현 기록
- 변경 파일: `src/lib/instagramGallerySync.ts`, `src/app/api/cron/instagram-gallery/route.ts`, `src/app/actions/admin.ts`, `src/app/admin/gallery/GalleryAdminClient.tsx`, `src/app/admin/gallery/page.tsx`, `src/lib/instagram.ts`, `vercel.json`
- 수동 버튼과 cron이 같은 `syncInstagramGalleryPostsToDb` 함수를 사용하도록 정리.
- 기존 게시물 중복 확인과 신규 저장을 묶음 처리해 서버 액션 시간을 줄임.
- 관리자 갤러리는 `force-dynamic`으로 최신 DB 상태를 바로 조회.

## 테스트 결과
- `npx.cmd tsc --noEmit` 통과
- `git diff --check` 통과

## 다음에 할 것
- 배포 후 Vercel cron `/api/cron/instagram-gallery`가 시간당 1회 실행되는지 확인.
- Vercel 요금제 cron 제한 때문에 시간당 실행이 막히면 스케줄을 일 1회로 낮추거나 Pro 플랜에서 운영.
