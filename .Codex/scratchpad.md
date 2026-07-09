# STIZ 고도화 스크래치패드

## 현재 작업
- 작업명: 학부모 수강신청 후속 단계 지연 로딩
- 상태: 검증 완료
- 범위: `/apply/enroll`
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
| 타입/빌드 검증 | 완료 | `npx.cmd tsc --noEmit`, `npx.cmd next build` 통과 |

## 작업 로그
- 2026-07-09: `/apply/enroll`의 2~4단계 입력/약관 UI를 동적 로드로 분리해 첫 JS를 131.2KB에서 112.4KB로 줄임.
- 2026-07-09: `/admin/apply` 승인/반려/상세 모달과 안내 설정 탭을 동적 로드로 분리해 첫 JS를 131.0KB에서 115.5KB로 줄임.
- 2026-07-09: `/admin/schedule` 편집/추가/구글시트 모달과 표 미리보기를 동적 로드로 분리해 첫 JS를 137.1KB에서 118.6KB로 줄임.
- 2026-07-09: 페이지 빌더의 남은 lucide 아이콘 import를 Material Symbols로 바꿔 `src/app`, `src/components`의 실제 `lucide-react` import를 모두 제거함.
- 2026-07-09: `ChatPanel`의 lucide 닫기/전송 아이콘을 Material Symbols로 바꿔 챗봇 동적 패널의 아이콘 라이브러리 의존을 제거함.
- 2026-07-09: `/admin` 대시보드의 lucide 아이콘을 Material Symbols로 바꿔 서버 렌더 아이콘 의존을 제거함. client JS는 100.2KB 유지.
- 2026-07-09: `/notices/[id]`의 lucide 아이콘을 Material Symbols로 바꿔 서버 렌더 아이콘 의존을 제거함. client JS는 99.9KB 유지.
- 2026-07-09: `/mypage` 레이아웃/본문의 lucide 아이콘을 Material Symbols로 바꿔 마이페이지 첫 JS를 109.2KB에서 105.4KB로 줄임.
- 2026-07-09: `/staff/quick-post`의 lucide 아이콘을 Material Symbols로 바꿔 선생님 빠른 업로드 첫 JS를 88.2KB에서 85.3KB로 줄임.
- 2026-07-09: `/admin/faq`의 lucide 아이콘을 Material Symbols로 바꿔 FAQ 관리 첫 JS를 109.7KB에서 107.2KB로 줄임.

## 구현 기록
- 변경 파일: `src/app/apply/enroll/EnrollApplicationForm.tsx`, `src/app/apply/enroll/EnrollApplicationLaterSteps.tsx`
- 주요 변경: 첫 화면에 보이는 1단계 아이 정보는 유지하고, 2~4단계 보호자/수강정보/약관 UI를 `next/dynamic`으로 분리.
- 적용 범위: 학부모 수강신청 자체 폼.

## 테스트 결과
- `npx.cmd tsc --noEmit` 통과
- `npx.cmd next build` 통과. Google Fonts 네트워크가 필요해 네트워크 허용으로 검증.
- 산출물 확인: `/apply/enroll` 첫 JS 131.2KB → 112.4KB.

## 다음에 할 것
- 다음 속도 개선 후보: `/admin/gallery`, `/admin/trial`, `/admin/notices`의 초기 업로드/처리 모달 분리.
