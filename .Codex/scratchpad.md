# STIZ 고도화 스크래치패드

## 현재 작업
- 작업명: 보강 관리 원생 목록 지연 로딩
- 상태: 빌드 검증 완료
- 범위: `/admin/makeup`, `/api/admin/student-options`
- 기준일: 2026-07-10

## 진행 현황표
| 항목 | 상태 | 메모 |
| --- | --- | --- |
| 프로젝트 현황 파악 | 완료 | Next.js + Supabase + Prisma 기반 학원 홈페이지/관리 플랫폼 |
| 관리자 권한 보호 | 완료 | `/admin` 서버 레이아웃에서 DB role 기준 권한 확인 |
| 업로드 UX 개선 | 완료 | 병렬 업로드, 진행률 표시, 성공 메시지 보강 |
| 홈 공지/인스타 갤러리 보강 | 완료 | 히어로 공지 목록 추가, Instagram CDN 이미지 허용 |
| 전역 속도 병목 개선 | 완료 | 홈 폰트 preload 561개→0개, 리소스 참조 630개→90개 |
| 플로팅 도구/모달 지연 로딩 | 완료 | 챗봇, 가이드, 관리자 모달류를 첫 렌더에서 분리 |
| 런타임 폰트 CSS 지연 로딩 | 완료 | Pretendard/Material Symbols stylesheet를 첫 paint/idle 후 로드 |
| 공개/관리자 아이콘 요청 축소 | 완료 | 주요 페이지 단순 아이콘을 `FontFreeIcon` 또는 로컬 방식으로 전환 |
| 관리자 갤러리 아이콘 폰트 요청 제거 | 완료 | `/admin/gallery` 소스/빌드 산출물의 Material Symbols 사용 흔적 0건 확인 |
| 관리자 대시보드 첫 렌더 대기 완화 | 완료 | 제목/스켈레톤을 먼저 렌더하고 DB 통계는 Suspense 경계 안에서 스트리밍 |
| 관리자 사이드바 prefetch 차단 | 완료 | 다수 관리자 링크가 자동으로 서버 조회를 몰아치지 않도록 `prefetch={false}` 적용 |
| 관리자 대시보드 내부 prefetch 차단 | 완료 | 대시보드 카드/목록/빠른관리 링크가 다른 관리자 route를 자동 조회하지 않도록 조정 |
| 스킬 관리 원생 목록 지연 로딩 | 완료 | 기본 카테고리 탭은 원생 전체 조회 없이 렌더하고, 평가 탭 클릭 시 가벼운 옵션 API 호출 |
| 대기자 관리 원생 목록 지연 로딩 | 완료 | 대기 등록 모달을 열 때만 학생 선택용 최소 데이터 호출 |
| 보강 관리 원생 목록 지연 로딩 | 완료 | 보강 예약 모달을 열 때만 원생 선택용 최소 데이터 호출 |
| 타입/빌드 검증 | 완료 | `npx.cmd tsc --noEmit`, `npx.cmd next build` 통과 |

## 작업 로그
- 2026-07-10: `/admin/makeup` 초기 렌더에서 `getStudents()` 호출을 제거하고, 보강 예약 모달을 열 때 `/api/admin/student-options`로 원생 선택 목록을 불러오도록 변경함.
- 2026-07-10: `/admin/waitlist` 초기 렌더에서 `getStudents()` 호출을 제거하고, 대기 등록 모달을 열 때 `/api/admin/student-options`로 학생 선택 목록을 불러오도록 변경함.
- 2026-07-10: `/admin/skills` 초기 렌더에서 `getStudents()` 호출을 제거하고, 스킬 평가 탭 클릭 시 `/api/admin/student-options`로 원생 선택용 최소 데이터만 불러오도록 변경함.
- 2026-07-09: `/admin` 대시보드의 카드, 배너, 신규 원생, 요청 목록, 빠른 관리 링크에 `prefetch={false}`를 적용해 첫 화면에서 다른 관리자 route가 자동 조회되는 일을 줄임.
- 2026-07-09: `/admin` 대시보드의 기본 통계/요청/신청 통계 조회를 `DashboardPrimarySection` Suspense 경계 뒤로 옮겨 헤더와 스켈레톤이 DB 응답 전에 먼저 표시되도록 변경함.
- 2026-07-09: 관리자 사이드바 `NavItem`의 자동 prefetch를 꺼서 진입 직후 여러 관리자 route 서버 조회가 동시에 몰리는 상황을 줄임.
- 2026-07-09: `/admin/gallery` 목록과 업로드/수정 모달의 업로드/동기화/저장/공개상태/수정/삭제 아이콘을 `FontFreeIcon`으로 바꿔 Material Symbols 요청 흔적을 제거함.
- 2026-07-09: `/apply`, `/apply/enroll`, `/apply/trial` 신청 화면 아이콘을 `FontFreeIcon`으로 바꿔 신청 페이지 HTML에서 Material Symbols 요청 흔적을 제거함.
- 2026-07-09: `/notices` 목록/상세의 고정글, 첨부파일, 뒤로가기, 다운로드 아이콘을 `FontFreeIcon`으로 바꿔 공개 공지 HTML에서 Material Symbols 요청 흔적을 제거함.
- 2026-07-09: `/gallery` 공개 그리드와 라이트박스 아이콘을 `FontFreeIcon`으로 바꿔 공개 갤러리 HTML에서 Material Symbols 요청 흔적을 제거함.

## 구현 기록
- 변경 파일: `src/app/admin/makeup/page.tsx`, `src/app/admin/makeup/MakeupClient.tsx`
- 주요 변경: 보강 관리 첫 렌더에서 원생 전체 조회를 제거하고, 보강 예약 모달을 열 때 원생 선택용 최소 데이터만 불러오도록 분리.
- 적용 범위: `/admin/makeup`

## 테스트 결과
- `npx.cmd tsc --noEmit` 통과
- `npx.cmd next build` 통과
- 빌드 중 Supabase DB 접속 실패 로그는 로컬 네트워크 제한으로 발생했지만 fallback 처리되어 빌드 종료 코드는 0.

## 다음에 할 것
- 다음 속도 개선 후보: 남은 관리자 `getStudents()` 호출을 재분류하고, 초기 화면에 불필요한 호출을 더 지연 로딩으로 분리하기.
