# 작업 스크래치패드

## 현재 작업
- **요청**: 구글 캘린더 양방향 동기화 코드 구현 (Service Account 쓰기)
- **상태**: 기획설계 완료 → developer 실행 대기
- **현재 담당**: planner-architect → developer
- **마지막 세션**: 2026-03-26

---

## 구현 기록 (developer)

### 구글 캘린더 양방향 동기화 — Phase 1 코드 구현

| 파일 경로 | 변경 내용 | 신규/수정 |
|----------|----------|----------|
| `prisma/schema.prisma` | AnnualEvent에 `googleEventId String?` 필드 추가 | 수정 |
| `src/lib/googleCalendarWrite.ts` | Service Account 인증 + create/update/delete 3개 함수 | 신규 |
| `src/app/actions/admin.ts` | 3개 CRUD에 구글 캘린더 동기화 추가 (best-effort) | 수정 |

주요 구현 사항:
- create: crypto.randomUUID()로 ID 미리 생성 -> DB INSERT -> 구글 생성 -> googleEventId UPDATE
- update: DB UPDATE 먼저 -> googleEventId 조회 -> 구글 수정
- delete: googleEventId 조회 -> DB DELETE -> 구글 삭제
- 모든 구글 API 호출은 try-catch로 감싸서 실패해도 DB 정상 진행
- 환경변수(GOOGLE_SERVICE_ACCOUNT_KEY, GOOGLE_CALENDAR_ID) 미설정 시 조용히 건너뜀
- $queryRawUnsafe / $executeRawUnsafe만 사용 (PgBouncer 호환)

tester 참고:
- tsc --noEmit 통과 완료
- 환경변수 미설정 상태에서도 기존 CRUD 정상 동작해야 함
- DB 마이그레이션(googleEventId 컬럼)은 별도 실행 필요

reviewer 참고:
- JWT 생성자를 객체 형태({email, key, scopes})로 전달 (googleapis v171 시그니처)
- prisma migrate dev는 의도적으로 실행하지 않음 (PM 지시)

---

## 기획설계: 구글 캘린더 양방향 동기화 — 코드 구현

### 현재 구조 분석 결과

**기존 코드 상태:**
- `src/lib/googleCalendar.ts` — 읽기 전용 모듈. ICS 파싱 + Calendar API v3 (API Key, 읽기만 가능). `fetchViaCalendarAPI()`에서 직접 fetch로 REST API 호출 중
- `src/app/actions/admin.ts` (441~504행) — AnnualEvent CRUD 3개 함수. 모두 `$executeRawUnsafe` 사용. INSERT는 `gen_random_uuid()::text`로 ID 자동 생성
- `prisma/schema.prisma` (241~250행) — AnnualEvent 모델에 `googleEventId` 필드 없음
- `package.json` — `googleapis` / `google-auth-library` 미설치 상태
- `src/app/annual/page.tsx` — DB + 구글 이벤트를 합쳐서 표시 (이미 통합됨, 중복 제거 로직 포함)

**핵심 제약사항:**
- Supabase PgBouncer → `$queryRawUnsafe` / `$executeRawUnsafe`만 사용 (ORM 메서드 금지)
- INSERT 시 ID가 서버에서 자동 생성(gen_random_uuid) → INSERT 후 생성된 ID를 돌려받으려면 `$queryRawUnsafe` + RETURNING 필요

### 기획설계

**목표**: 관리자가 사이트에서 일정 CRUD 시 구글 캘린더에도 자동 반영 (DB + 구글 이중 저장)

**만들 위치와 구조:**
| 파일 경로 | 역할 | 신규/수정 |
|----------|------|----------|
| `src/lib/googleCalendarWrite.ts` | Service Account 인증 + 구글 캘린더 쓰기 3개 함수 | 신규 |
| `prisma/schema.prisma` | AnnualEvent에 `googleEventId String?` 추가 | 수정 |
| `src/app/actions/admin.ts` | create/update/delete에 구글 쓰기 호출 추가 | 수정 |

**기존 코드 연결:**
- `src/lib/googleCalendar.ts` (읽기) — 변경 없음. 쓰기 모듈을 별도 파일로 분리
- `src/app/annual/page.tsx` (공개 페이지) — 변경 없음. 이미 DB+구글 통합 표시 중
- `src/app/admin/annual/AnnualAdminClient.tsx` — UI 변경 없음 (Phase 1에서는 서버 로직만)

**실행 계획:**
| 순서 | 작업 | 담당 | 선행 조건 |
|------|------|------|----------|
| 1 | `npm install googleapis` 패키지 설치 | developer | 없음 |
| 2 | `prisma/schema.prisma` AnnualEvent에 `googleEventId String?` 추가 + `npx prisma migrate dev` | developer | 없음 (1과 병렬) |
| 3 | `src/lib/googleCalendarWrite.ts` 신규 생성 — Service Account 인증 + create/update/delete 함수 | developer | 1 완료 |
| 4 | `src/app/actions/admin.ts` 수정 — 3개 함수에 구글 쓰기 연동 (best-effort: 실패해도 DB는 정상) | developer | 2, 3 완료 |
| 5 | tester 검증 (tsc --noEmit + 동작 시나리오) | tester | 4 완료 |

**developer 주의사항:**

1. **googleapis vs 직접 fetch 선택**: `googleapis` 패키지가 거대하지만 (번들 ~50MB), 서버 전용이라 클라이언트 번들에 영향 없음. Service Account JWT 서명 + 토큰 관리를 직접 구현하는 것보다 `googleapis` 사용이 안전. 다만 번들 크기가 걱정되면 `google-auth-library` + fetch 직접 호출도 가능

2. **INSERT 후 ID 반환 방식 변경 필요**: 현재 `createAnnualEvent`는 `$executeRawUnsafe`(INSERT)로 ID를 반환받지 않음. 구글 이벤트 생성 후 `googleEventId`를 DB에 저장하려면:
   - 방법 A: INSERT에 `RETURNING id` 추가 → `$queryRawUnsafe`로 변경하여 생성된 row의 id를 받아옴
   - 방법 B: INSERT 전에 uuid를 미리 생성하여 전달 (crypto.randomUUID())
   - **권장: 방법 B** — 기존 쿼리 구조 변경 최소화

3. **환경변수 2개 추가**:
   - `GOOGLE_SERVICE_ACCOUNT_KEY` — Service Account JSON 전체를 문자열로 저장 (JSON.parse하여 사용)
   - `GOOGLE_CALENDAR_ID` — 쓰기 대상 캘린더 ID (예: xxxx@group.calendar.google.com)

4. **에러 처리 (graceful fallback)**:
   - `GOOGLE_SERVICE_ACCOUNT_KEY`가 없으면 → 구글 쓰기 건너뜀, DB만 저장. console.warn으로 알림
   - 구글 API 호출 실패 → catch 후 DB 저장은 유지. 에러 로그만 남김
   - 즉, **구글 동기화는 "best effort"** — 실패해도 사이트 기능에 영향 없음

5. **$queryRawUnsafe 규칙 절대 준수**: googleEventId 업데이트도 raw query로

6. **googleCalendarWrite.ts 함수 시그니처**:
```typescript
// 구글 캘린더에 이벤트 생성, 생성된 구글 이벤트 ID 반환 (실패 시 null)
createCalendarEvent(event: { title: string; date: string; endDate?: string; description?: string }): Promise<string | null>

// 구글 캘린더 이벤트 수정 (실패 시 조용히 실패)
updateCalendarEvent(googleEventId: string, event: { title: string; date: string; endDate?: string; description?: string }): Promise<void>

// 구글 캘린더 이벤트 삭제 (실패 시 조용히 실패)
deleteCalendarEvent(googleEventId: string): Promise<void>
```

7. **admin.ts 수정 흐름 (create 예시)**:
```
1. DB INSERT (googleEventId 포함, 초기 null)
2. createCalendarEvent() 호출
3. 성공 시 → UPDATE SET googleEventId = 반환값 WHERE id = 방금 생성한 id
4. 실패 시 → 아무것도 안 함 (DB에는 이미 저장됨)
```

---

## 작업 로그 (최근 10건)

| 날짜 | 작업 내용 | 파일 | 상태 |
|------|----------|------|------|
| 2026-03-26 | 공개 연간일정에 DB 이벤트 통합 (구글+DB 합침, 중복제거) | annual/page.tsx | 완료 |
| 2026-03-26 | 이용약관 관리 독립 페이지 분리 (/admin/terms) | admin/terms/*, ProgramsAdminClient, programs/page, layout | 완료 |
| 2026-03-28 | 히어로-본문 제목 중복 제거 (FAQ+이용약관) | FaqClient, ProgramAccordionTerms, terms/page | 완료 |
| 2026-03-28 | 이용약관+FAQ 독립 페이지 분리 (/terms, /faq) | terms/page, faq/page, FaqClient, Header, Footer | 완료 |
| 2026-03-28 | 메뉴 4카테고리 재구성 + 오시는 길 섹션 | PublicHeader, about/page | 완료 |
| 2026-03-28 | FAQ DB 통합 관리 (10개, 이용약관 기반 추가) | ApplyPageClient + DB INSERT | 완료 |
| 2026-03-28 | 이용약관 항상 펼침 + 중요 키워드 자동 강조 | ProgramAccordionTerms | 완료 |
| 2026-03-28 | 이용약관 접근성 개선 (푸터 링크+신청 안내) | PublicFooter, ApplyPageClient, programs/page | 완료 |
| 2026-03-27 | 투어 정보 스텝 오버레이 제거 (콘텐츠 가리지 않음) | GuideTourTrigger | 완료 |
| 2026-03-27 | 입학가이드 버튼 원형+색상 수정 | GuideTourTrigger | 완료 |
| 2026-03-27 | 히어로 리디자인 + 높이 75% 축소 (전체 페이지) | LandingPageClient + 9개 페이지 | 완료 |
| 2026-03-26 | 구글캘린더 ICS 설정을 연간일정 관리로 이동 | AdminSettingsClient, annual/page, AnnualAdminClient | 완료 |

---

## 프로젝트 현황 요약
- **완료된 Phase**: 초기 ~ Phase 10 + 보안패치 + 입학가이드 + UI개선
- **개발서버**: localhost:4000
- **프로덕션 배포**: stiz-dasan.kr (Vercel)

### 최근 주요 변경사항
- 입학가이드 투어 v2 (driver.js, 5단계 게임 튜토리얼)
- 메뉴 4카테고리 (학원 소개 / 수업 안내 / 소식·안내 / 수업찾기)
- 이용약관(/terms) + FAQ(/faq) 독립 페이지
- 오시는 길 (카카오맵) /about 하단
- 체험수업 비용 무료→1만원 전체 수정
- 관리자 페이지 쿼리 병렬화 4건

### 대기 중인 작업
1. **학부모 후기 동적화**: 현재 하드코딩 → DB 관리 전환 (구글 리뷰 불가, 자체 관리)
2. **수업 등록 시뮬레이터 리디자인**: 기획설계 완료, 디자인 시안 대기
3. **엑셀 업로드 일괄 등록**: planner 계획 수립 완료, 사용자 결정 대기
