# STIZ 고도화 스크래치패드

## 현재 작업
- 작업명: 공개 공지 아이콘 폰트 요청 제거
- 상태: 빌드 검증 완료
- 범위: `/notices` 공개 목록/상세 단순 아이콘
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
| 로그아웃 진입점 | 완료 | 공개 헤더와 마이페이지 헤더에서 기존 `logout()` 액션 노출 |
| 전역 속도 병목 개선 | 완료 | 홈 폰트 preload 561개→0개, 리소스 참조 630개→90개 |
| 플로팅 도구 지연 로딩 | 완료 | 챗봇 패널/가이드 투어 본체를 첫 렌더에서 분리 |
| 홈 클라이언트 경계 축소 | 완료 | 정적 홈 섹션을 서버 렌더링으로 전환하고 후기 캐러셀만 클라이언트 유지 |
| 갤러리 라이트박스 지연 로딩 | 완료 | 갤러리 목록은 서버 렌더링, 전체화면 라이트박스는 클릭 후 로드 |
| 관리자 공지 에디터 지연 로딩 | 완료 | 공지 목록 초기 진입에서 리치 에디터 번들을 제외 |
| 공개 헤더 계정 확인 지연 로딩 | 완료 | Supabase 브라우저 인증 확인을 초기 헤더 JS에서 분리 |
| 공개 공통 아이콘 JS 제거 | 완료 | 공개 첫 화면 공통 아이콘을 Material Symbols로 전환 |
| 관리자 shell 초기 요청 지연 | 완료 | 서버 인증 정보를 재사용하고 알림/체험 카운트 호출을 첫 렌더 뒤로 이동 |
| 업로드 이미지 캐시 강화 | 완료 | `/uploads`와 Supabase Storage 업로드 파일에 1년 immutable 캐시 적용 |
| 관리자 공통 아이콘 JS 제거 | 완료 | shell 로그아웃 아이콘을 Material Symbols로 전환해 공통 chunk 축소 |
| 신청 페이지 client bundle 축소 | 완료 | `sanitize-html`을 client bundle에서 제거해 `/apply` 첫 JS 대폭 축소 |
| setup 페이지 Supabase SDK 제거 | 완료 | 최초 관리자 생성 API를 서버 처리로 옮겨 `/setup` 첫 JS 대폭 축소 |
| 학생 관리 엑셀 모달 지연 로딩 | 완료 | 엑셀 업로드 모달을 클릭 후 별도 chunk로 로드 |
| 갤러리/인스타 미리보기 아이콘 JS 제거 | 완료 | lucide 아이콘을 Material Symbols로 전환 |
| 공지 관리 아이콘 JS 제거 | 완료 | 공지 관리 lucide 아이콘을 Material Symbols로 전환 |
| 수업 상세 아이콘 JS 제거 | 완료 | 수업 상세 lucide 아이콘을 Material Symbols로 전환 |
| 학생 상세 아이콘 JS 제거 | 완료 | 학생 상세 lucide 아이콘을 Material Symbols로 전환 |
| 요청 관리 아이콘 JS 제거 | 완료 | 학부모 요청 관리 lucide 아이콘을 Material Symbols로 전환 |
| FAQ 관리 아이콘 JS 제거 | 완료 | FAQ 관리 lucide 아이콘을 Material Symbols로 전환 |
| 선생님 빠른 업로드 아이콘 JS 제거 | 완료 | 빠른 업로드 lucide 아이콘을 Material Symbols로 전환 |
| 마이페이지 아이콘 JS 제거 | 완료 | 마이페이지 lucide 아이콘을 Material Symbols로 전환 |
| 공지 상세 서버 아이콘 의존 제거 | 완료 | 공지 상세 lucide 아이콘을 Material Symbols로 전환 |
| 관리자 대시보드 서버 아이콘 의존 제거 | 완료 | 관리자 대시보드 lucide 아이콘을 Material Symbols로 전환 |
| 챗봇 패널 아이콘 JS 제거 | 완료 | 클릭 후 로드되는 챗봇 패널 lucide 아이콘을 Material Symbols로 전환 |
| 페이지 빌더 아이콘 JS 제거 | 완료 | 빌더 툴박스/상단바/노드 lucide 아이콘을 Material Symbols로 전환 |
| 시간표 관리 모달 지연 로딩 | 완료 | `/admin/schedule` 첫 JS 137.1KB → 118.6KB |
| 신청 관리 보조 UI 지연 로딩 | 완료 | `/admin/apply` 첫 JS 131.0KB → 115.5KB |
| 수강신청 후속 단계 지연 로딩 | 완료 | `/apply/enroll` 첫 JS 131.2KB → 112.4KB |
| 갤러리 업로드 폼 지연 로딩 | 완료 | `/admin/gallery` 첫 JS 126.4KB → 120.3KB |
| 체험 CRM 모달 지연 로딩 | 완료 | `/admin/trial` 모달 묶음 분리, 빌드 수치 측정은 Google Fonts 네트워크 실패로 보류 |
| 공지 소셜 발행 모달 지연 로딩 | 완료 | `/admin/notices` 소셜 발행 준비/게시 UI 분리, 빌드 수치 측정은 Google Fonts 네트워크 실패로 보류 |
| 수업 상세 기록 모달 지연 로딩 | 완료 | `/admin/classes/[id]` 수업 기록/사진 업로드 모달 분리, 빌드 수치 측정은 Google Fonts 네트워크 실패로 보류 |
| 반 관리 작성 폼 지연 로딩 | 완료 | `/admin/classes` 반 작성/수정 폼과 저장 액션 분리, 빌드 수치 측정은 Google Fonts 네트워크 실패로 보류 |
| 스태프 직접 추가 모달 지연 로딩 | 완료 | `/admin/staff` 전화번호 인증/직접 추가 모달 분리, 빌드 수치 측정은 Google Fonts 네트워크 실패로 보류 |
| 스태프 초대 모달 지연 로딩 | 완료 | `/admin/staff` SMS 초대 링크 발송 모달 분리, 빌드 수치 측정은 Google Fonts 네트워크 실패로 보류 |
| 프로그램 작성/수정 폼 지연 로딩 | 완료 | `/admin/programs` 등록/수정 폼과 create/update 액션 분리, 빌드 수치 측정은 Google Fonts 네트워크 실패로 보류 |
| 설정 리치 에디터 가시 영역 지연 로딩 | 완료 | `/admin/settings` 리치 에디터를 스크롤/호버/클릭 시 로드하도록 분리, 빌드 수치 측정은 Google Fonts 네트워크 실패로 보류 |
| Google Fonts 빌드 의존 제거 | 완료 | `next/font/google` 제거 후 `npx.cmd next build`, `npx.cmd next build --webpack` 모두 통과 |
| 런타임 폰트 CSS 지연 로딩 | 완료 | Pretendard/Material Symbols stylesheet를 head에서 제거하고 첫 paint/idle 후 로드 |
| 홈/공통 아이콘 폰트 요청 제거 | 완료 | 홈 HTML의 `material-symbols-outlined`/Material Symbols URL 0건 확인 |
| 공개 갤러리 아이콘 폰트 요청 제거 | 완료 | `/gallery` HTML의 `material-symbols-outlined`/Material Symbols URL 0건 확인 |
| 공개 공지 아이콘 폰트 요청 제거 | 완료 | `/notices` 소스/HTML의 Material Symbols 사용 흔적 0건 확인 |
| 타입/빌드 검증 | 완료 | `npx.cmd tsc --noEmit`, `npx.cmd next build`, `npx.cmd next build --webpack` 통과 |

## 작업 로그
- 2026-07-09: `/notices` 목록/상세의 고정글, 첨부파일, 뒤로가기, 다운로드 아이콘을 `FontFreeIcon`으로 바꿔 공개 공지 HTML에서 Material Symbols 요청 흔적을 제거함.
- 2026-07-09: `/gallery` 공개 그리드와 라이트박스의 이미지/재생/날짜/닫기/이전/다음 아이콘을 `FontFreeIcon`으로 바꿔 공개 갤러리 HTML에서 Material Symbols 요청 흔적을 제거함.
- 2026-07-09: 공개 헤더/푸터/테마/챗봇/가이드/후기/인스타 미리보기와 관리자 shell 단순 아이콘을 `FontFreeIcon`으로 바꾸고, Material Symbols stylesheet는 실제 사용처가 있는 페이지에서만 로드되도록 조정함.
- 2026-07-09: Pretendard/Material Symbols 외부 stylesheet를 전역 head에서 제거하고 `DeferredFontStyles`로 첫 paint 이후 지연 로드해 렌더 차단 가능성을 낮춤.
- 2026-07-09: 전역 `next/font/google` 의존을 제거하고 폰트 옵션을 CSS fallback 스택으로 바꿔 Google Fonts 네트워크 실패 없이 `next build`가 통과하도록 함.
- 2026-07-09: `/admin/settings`의 리치 텍스트 편집기를 `LazyRichTextEditor`로 감싸 화면 근처에 올 때만 실제 편집기 chunk를 로드하도록 변경함.
- 2026-07-09: `/admin/programs`의 등록/수정 폼을 `ProgramFormPanel`로 분리해 프로그램 목록 초기 렌더에서 create/update 폼 코드를 제외함.
- 2026-07-09: `/admin/staff`의 SMS 초대 링크 발송 모달을 `InviteStaffModal`로 분리해 스태프 목록 초기 렌더에서 초대 폼/액션 코드를 제외함.
- 2026-07-09: `/admin/staff`의 직접 스태프 추가 모달을 `AddStaffModal`로 분리해 스태프 목록 초기 렌더에서 전화번호 인증/계정 생성 UI 코드를 제외함.
- 2026-07-09: `/admin/classes`의 반 작성/수정 폼을 `ClassFormPanel`로 분리해 반 목록 초기 렌더에서 create/update 폼 코드를 제외함.

## 구현 기록
- 변경 파일: `src/app/notices/page.tsx`, `src/app/notices/[id]/page.tsx`, `src/components/ui/FontFreeIcon.tsx`
- 주요 변경: 공개 공지 목록/상세의 단순 아이콘을 `FontFreeIcon`으로 전환.
- 적용 범위: `/notices` 공개 목록과 `/notices/[id]` 상세.

## 테스트 결과
- `npx.cmd tsc --noEmit` 통과
- `npx.cmd next build` 통과
- `src/app/notices`와 `.next/server/app/notices.html`에서 `material-symbols-outlined`, `fonts.googleapis`, `material-symbols-css` 0건 확인
- 빌드 중 Supabase DB 접속 실패 로그는 fallback 처리되어 빌드 종료 코드는 0.

## 다음에 할 것
- 다음 속도 개선 후보: `/apply`, `/admin/gallery`, `/admin/apply`의 남은 Material Symbols 사용처를 우선순위별로 `FontFreeIcon` 또는 로컬 아이콘으로 전환.
