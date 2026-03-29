# 작업 스크래치패드

## 현재 작업
- **요청**: 학부모 후기 동적화 (하드코딩 -> DB 관리)
- **상태**: developer 구현 완료 → tester 검증 대기
- **현재 담당**: developer
- **마지막 세션**: 2026-03-29

### 진행 현황
| # | 작업 | 상태 |
|---|------|------|
| 1 | DB 스키마 (Testimonial 모델 + AcademySettings 필드) | 완료 (이미 존재) |
| 2 | queries.ts 조회 함수 추가 | 완료 |
| 3 | Server Actions (CRUD + 순서변경) | 완료 |
| 4 | 관리자 페이지 /admin/testimonials | 완료 |
| 5 | 공개 랜딩 페이지 연동 (서버->클라이언트 props) | 완료 |
| 6 | 네이버 플레이스 리뷰 링크 버튼 | 완료 |

---

## 기획설계 (planner-architect)

### 학부모 후기 동적화

**목표**: 하드코딩된 5개 후기를 DB에서 관리하는 시스템으로 전환. 관리자가 등록/수정/삭제/순서변경 가능. 네이버 플레이스 리뷰 링크 추가.

**현재 코드 분석 결과**:
- `src/components/landing/TestimonialCarousel.tsx` (Client Component): 이미 `testimonials?: Testimonial[]` props를 받을 수 있게 설계됨. 기본값으로 하드코딩 5개 사용 중.
- 데이터 구조: `{ name, info, text, rating }` 4개 필드
- 사용 위치: `src/app/LandingPageClient.tsx` 221행에서 `<TestimonialCarousel />` (props 없이 호출)
- 서버 컴포넌트 `src/app/page.tsx`에서 settings만 조회 후 `LandingPageClient`에 전달 중

**DB 스키마 설계** (Faq 모델과 동일 패턴):

```prisma
model Testimonial {
  id        String   @id @default(dbgenerated("(gen_random_uuid())::text"))
  name      String   // 작성자명 (예: "김O O")
  info      String   // 관계/정보 (예: "초3 학부모")
  text      String   // 후기 내용
  rating    Int      @default(5)  // 별점 1~5
  order     Int      @default(0)  // 표시 순서
  isPublic  Boolean  @default(true)  // 공개 여부
  createdAt DateTime @default(now()) @db.Timestamptz(6)
  updatedAt DateTime @default(now()) @updatedAt @db.Timestamptz(6)
}
```

AcademySettings에 네이버 플레이스 URL 필드 추가:
```prisma
naverPlaceUrl String? // 네이버 플레이스 리뷰 URL
```

**만들/수정할 파일 목록**:

| 파일 경로 | 역할 | 신규/수정 |
|----------|------|----------|
| `prisma/schema.prisma` | Testimonial 모델 추가 + AcademySettings에 naverPlaceUrl 필드 | 수정 |
| `src/lib/queries.ts` | getPublicTestimonials() + getAllTestimonials() 함수 | 수정 |
| `src/app/actions/admin.ts` | createTestimonial, updateTestimonial, deleteTestimonial + updateAcademySettings에 naverPlaceUrl 추가 | 수정 |
| `src/app/admin/testimonials/page.tsx` | 관리자 후기 목록 서버 컴포넌트 | 신규 |
| `src/app/admin/testimonials/TestimonialsAdminClient.tsx` | 관리자 후기 CRUD UI (클라이언트) | 신규 |
| `src/app/admin/layout.tsx` | 사이드바 "소식/안내" 카테고리에 "학부모 후기" 메뉴 추가 | 수정 |
| `src/app/page.tsx` | 서버에서 후기 + naverPlaceUrl 조회 -> LandingPageClient에 전달 | 수정 |
| `src/app/LandingPageClient.tsx` | testimonials, naverPlaceUrl props 받아서 TestimonialCarousel에 전달 | 수정 |
| `src/components/landing/TestimonialCarousel.tsx` | defaultTestimonials 제거, naverPlaceUrl props 추가, "리뷰 더보기" 버튼 | 수정 |

**기존 코드 연결**:
- queries.ts: 기존 getAllFaqs/getPublicFaqs와 동일 패턴 ($queryRawUnsafe)
- admin.ts: 기존 createFaq/updateFaq/deleteFaq와 동일 패턴 (requireAdmin + $executeRawUnsafe + revalidatePath)
- admin/testimonials: 기존 admin/faq 페이지와 동일 구조 (서버 컴포넌트 + *Client.tsx)
- page.tsx -> LandingPageClient: 기존 settings 전달 패턴에 testimonials, naverPlaceUrl 추가
- AcademySettings: getAcademySettings()에 naverPlaceUrl 필드 매핑 추가, updateAcademySettings()에 파라미터 추가

**실행 계획**:

| 순서 | 작업 | 담당 | 선행 조건 |
|------|------|------|----------|
| 1 | schema.prisma 수정 + prisma migrate dev | developer | 없음 |
| 2 | queries.ts에 조회 함수 추가 + getAcademySettings에 naverPlaceUrl 매핑 | developer | 1 |
| 3 | admin.ts에 CRUD Server Actions 추가 + updateAcademySettings 확장 | developer | 1 |
| 4 | /admin/testimonials 페이지 생성 + 사이드바 메뉴 추가 | developer | 2, 3 |
| 5 | 공개 랜딩 페이지 연동 (page.tsx -> LandingPageClient -> TestimonialCarousel) + 네이버 링크 버튼 | developer | 2 |
| 6 | tester + reviewer (병렬) | tester, reviewer | 4, 5 |

(2~3은 병렬 가능, 4~5도 병렬 가능)

**developer 주의사항**:
- DB 쿼리는 반드시 `$queryRawUnsafe` / `$executeRawUnsafe` 사용 (ORM 메서드 금지)
- Faq CRUD 패턴을 그대로 따를 것 (createFaq, updateFaq, deleteFaq 참고)
- TestimonialCarousel의 defaultTestimonials 배열을 삭제하고, props로만 데이터를 받도록 변경. 빈 배열이면 "아직 등록된 후기가 없습니다" 표시.
- naverPlaceUrl은 /admin/settings 페이지가 아니라 /admin/testimonials 페이지 상단에 설정 UI를 배치 (후기와 같은 맥락)
- "네이버 플레이스 리뷰 더보기" 버튼은 TestimonialCarousel 하단에 배치. URL이 없으면 버튼 숨김.
- 마이그레이션 이름: `add-testimonial-and-naver-place-url`
- revalidatePath: `/admin/testimonials` + `/` (메인 랜딩)
- 관리자 페이지 캐싱: `export const revalidate = 30;`
- 하드코딩 색상 금지 - CSS 변수 또는 Tailwind 유틸리티만 사용
- 아이콘: Material Symbols Outlined 사용

## 구현 기록 (developer)

### 변경 파일 목록
| 파일 | 신규/수정 | 주요 변경 |
|------|----------|----------|
| prisma/schema.prisma | 수정 없음 | Testimonial 모델 + naverPlaceUrl 이미 존재 (스킵) |
| src/lib/queries.ts | 수정 | getPublicTestimonials(), getAllTestimonials() 추가 + getAcademySettings에 naverPlaceUrl 매핑 |
| src/app/actions/admin.ts | 수정 | createTestimonial, updateTestimonial, deleteTestimonial 추가 + ALLOWED_SETTINGS에 naverPlaceUrl + updateAcademySettings 타입에 naverPlaceUrl 추가 |
| src/app/admin/testimonials/page.tsx | 신규 | 서버 컴포넌트, revalidate=30, getAllTestimonials+getAcademySettings 조회 |
| src/app/admin/testimonials/TestimonialsAdminClient.tsx | 신규 | CRUD UI + 네이버 URL 설정 + 순서변경(위/아래 버튼) |
| src/app/admin/layout.tsx | 수정 | 사이드바 "소식/안내" 카테고리에 "학부모 후기" 메뉴 추가 |
| src/app/page.tsx | 수정 | getPublicTestimonials 병렬 조회 + LandingPageClient에 testimonials, naverPlaceUrl props 전달 |
| src/app/LandingPageClient.tsx | 수정 | props 타입에 testimonials, naverPlaceUrl 추가 + TestimonialCarousel에 전달 |
| src/components/landing/TestimonialCarousel.tsx | 수정 | defaultTestimonials 삭제, props 필수화, 빈 배열 안내 표시, 네이버 리뷰 버튼 추가 |

### 주요 구현 사항
- DB 쿼리: 모두 $queryRawUnsafe / $executeRawUnsafe 사용 (PgBouncer 호환)
- FAQ CRUD 패턴을 그대로 복제하여 Testimonial CRUD 구현
- 관리자 페이지 상단에 네이버 플레이스 URL 설정 카드 배치
- 순서 변경은 인접 항목 order 값 스왑 방식
- 아이콘: Material Symbols Outlined 사용 (lucide-react 미사용)
- 하드코딩 색상 없음, Tailwind 유틸리티만 사용
- tsc --noEmit 통과 확인

### tester 참고
- 테스트 방법: /admin/testimonials에서 후기 CRUD + 네이버 URL 저장 → 메인 페이지(/)에서 후기 표시 확인
- 정상 동작: 관리자에서 등록한 후기가 메인 페이지 캐러셀에 표시되어야 함
- 네이버 URL 입력 시 하단에 초록색 "네이버 플레이스에서 더 많은 후기 보기" 버튼 표시
- 후기 0개일 때 "아직 등록된 후기가 없습니다" 안내 표시
- 비공개 후기는 메인 페이지에 표시되지 않아야 함

## 테스트 결과 (tester)

### 테스트 결과 (2026-03-29)

| 테스트 항목 | 결과 | 비고 |
|-----------|------|------|
| tsc --noEmit 타입 체크 | 통과 | 에러 0건 |
| queries.ts getPublicTestimonials | 통과 | $queryRawUnsafe, isPublic=true 필터, order ASC |
| queries.ts getAllTestimonials | 통과 | $queryRawUnsafe, order ASC |
| queries.ts getAcademySettings naverPlaceUrl | 통과 | 필드 매핑 포함 |
| admin.ts createTestimonial | 통과 | requireAdmin + $executeRawUnsafe + revalidatePath |
| admin.ts updateTestimonial | 통과 | requireAdmin + $executeRawUnsafe + revalidatePath |
| admin.ts deleteTestimonial | 통과 | requireAdmin + $executeRawUnsafe + revalidatePath |
| admin.ts ALLOWED_SETTINGS_COLUMNS | 통과 | naverPlaceUrl 포함 |
| admin.ts updateAcademySettings 타입 | 통과 | naverPlaceUrl 포함 |
| admin/testimonials/page.tsx | 통과 | revalidate=30, 병렬 조회 |
| TestimonialsAdminClient.tsx CRUD UI | 통과 | 모달 생성/수정, 삭제 확인, 순서 변경 |
| TestimonialsAdminClient.tsx 네이버 URL | 통과 | 설정 카드 + 저장 기능 |
| TestimonialsAdminClient.tsx 아이콘 | 통과 | Material Symbols Outlined만 사용 |
| TestimonialsAdminClient.tsx 색상 | 통과 | 하드코딩 없음, Tailwind만 |
| admin/layout.tsx 사이드바 메뉴 | 통과 | "학부모 후기" /admin/testimonials |
| page.tsx 서버 조회 | 통과 | 병렬 조회 + props 전달 |
| LandingPageClient.tsx props | 통과 | testimonials, naverPlaceUrl 타입+전달 |
| TestimonialCarousel.tsx 동적 데이터 | 통과 | defaultTestimonials 삭제, props만 사용 |
| TestimonialCarousel.tsx 빈 배열 | 통과 | 안내 메시지 표시 |
| TestimonialCarousel.tsx 네이버 버튼 | 통과 | URL 조건부 표시 |
| SQL 인젝션 보안 검증 | 통과 | 파라미터 바인딩($1~$7) 사용 |
| import 누락 확인 | 통과 | 모든 import 정상 |
| revalidatePath 누락 확인 | 통과 | /admin/testimonials + / 모두 호출 |

- **tsc --noEmit**: 통과
- **코드 정합성**: 통과 (9개 파일 모두 검증)
- **보안 검증**: 통과 (SQL 파라미터 바인딩, requireAdmin 인증)
- **누락 항목**: 없음
- **종합**: PASS (23개 항목 전부 통과)
- **수정 필요 사항**: 없음

## 리뷰 결과 (reviewer)

### 코드 리뷰 결과

- **규칙 준수**: 통과
  - $queryRawUnsafe / $executeRawUnsafe만 사용: OK (Prisma ORM 메서드 없음)
  - Material Symbols Outlined 아이콘만 사용: OK (lucide-react 미사용, MIcon 헬퍼 활용)
  - 하드코딩 색상 없음: OK (Tailwind 유틸리티 + brand-* CSS 변수만 사용)
  - Server Action에 requireAdmin() 인증 체크: OK (create/update/deleteTestimonial 모두 첫 줄에 호출)
  - revalidatePath 적절: OK ("/admin/testimonials" + "/" 모두 무효화)
  - 캐싱 정책: OK (관리자 revalidate=30, 공개 페이지 revalidate=60 기존 유지)

- **코드 품질**: 양호
  - Faq CRUD 패턴과 완벽하게 일관성 유지 (createFaq -> createTestimonial 동일 구조)
  - queries.ts의 컬럼명 대소문자 fallback 처리 적절 (isPublic ?? ispublic 등)
  - TestimonialsAdminClient 컴포넌트 구조 양호 (모달 기반 CRUD, 순서변경)
  - page.tsx에서 Promise.all 병렬 조회 적용
  - 빈 상태(0건) 안내 메시지 구현 완료
  - 타입 안전성: TestimonialData 타입 정의 적절

- **보안**: 통과
  - SQL 인젝션 방지: 모든 쿼리에 파라미터 바인딩($1, $2...) 사용, 문자열 보간 없음
  - XSS: 후기 텍스트를 textContent/innerHTML이 아닌 JSX 텍스트로 렌더링하여 자동 이스케이프됨
  - 인증/인가: 3개 Server Action 모두 requireAdmin() 체크 완료
  - naverPlaceUrl은 <a> 태그 href로 직접 사용 — target="_blank" + rel="noopener noreferrer" 적용 완료

- **UX**: 양호
  - 관리자: 모달 기반 생성/수정, confirm 기반 삭제 확인, isPending 로딩 상태 처리
  - 공개 페이지: 빈 배열시 안내 메시지, 모바일 스크롤 힌트, 네이버 리뷰 버튼 조건부 표시
  - 접근성: aria-label 스크롤 버튼, 시맨틱 구조 적절

- **종합**: APPROVE

- **개선 제안**:
  - [없음] 기획대로 잘 구현됨. Faq 패턴을 충실히 복제하여 일관성 높음.

---

## 작업 로그 (최근 10건)

| 날짜 | 작업 내용 | 파일 | 상태 |
|------|----------|------|------|
| 2026-03-29 | 학부모 후기 동적화 기획설계 | scratchpad 기획설계 섹션 | 기획완료 |
| 2026-03-29 | 관리자 사이드바 "사이트"/"학원운영" 탭 UI | admin/layout.tsx | 완료 |
| 2026-03-29 | 보안 단기 조치 5건 (헤더/CRON/업로드/에러/XSS) | next.config, cron, upload, sanitize 등 12파일 | 완료 |
| 2026-03-29 | 보안 Phase A — 미들웨어+Server Action 인증 53개 | middleware.ts, auth-guard.ts, admin.ts 등 | 완료 |
| 2026-03-29 | 보안 Phase B — 개인정보 처리방침 + 동의 체크박스 | privacy/page, PublicFooter, login/page 등 | 완료 |
| 2026-03-29 | 보안 분석 보고서 작성 (등급 C, 즉시조치 5건) | .claude/security-report.md | 완료 |
| 2026-03-28 | 구글 캘린더 양방향 동기화 + private_key 호환 | googleCalendarWrite.ts, admin.ts, schema | 완료 |
| 2026-03-28 | 이용약관+FAQ 독립 페이지 + 메뉴 4카테고리 | terms, faq, Header, Footer, about | 완료 |
| 2026-03-28 | 이용약관 접근성 개선 (푸터 링크+신청 안내) | PublicFooter, ApplyPageClient 등 | 완료 |
| 2026-03-27 | 히어로 리디자인 + 입학가이드 UI 수정 | LandingPageClient + 9개 페이지 | 완료 |

---

## 대기 중인 작업
1. **학부모 후기 동적화**: 기획설계 완료 -> developer 구현 대기
2. **수업 등록 시뮬레이터 리디자인**: 디자인 시안 대기
3. **엑셀 업로드 일괄 등록**: 사용자 결정 대기

## 참고
- 보안 상세 보고서: `.claude/security-report.md`
