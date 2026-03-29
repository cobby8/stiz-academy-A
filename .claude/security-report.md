# STIZ 농구교실 보안 분석 보고서

**분석일**: 2026-03-29
**분석 대상**: stiz-academy-A (stiz-dasan.kr)
**분석자**: planner-architect (Claude Opus 4.6)

---

## 요약 (Executive Summary)

- **전체 보안 등급**: C (보통 — 기본 보안은 갖추었으나, 학부모 개인정보를 다루기 전 반드시 개선해야 할 항목 다수 존재)
- **즉시 조치 필요 항목**: 5건
- **권장 개선 항목**: 6건
- **참고 사항**: 4건

### 핵심 요약

**잘 되어 있는 부분:**
- SQL 인젝션 방어: `$queryRawUnsafe` / `$executeRawUnsafe` 사용하지만, 전 구간에서 **파라미터 바인딩($1, $2...)** 을 철저히 사용 중. SQL 인젝션 위험 거의 없음.
- API Route 인증: `/api/admin/*` 전 엔드포인트에서 `supabase.auth.getUser()` 인증 체크 수행.
- 환경변수 관리: `.env*`가 `.gitignore`에 포함, NEXT_PUBLIC_* 키는 Supabase anon key와 VAPID public key뿐 (노출되어도 안전한 것들).
- Vercel Cron 인증: CRON_SECRET 설정 시 Bearer 토큰 검증.

**치명적 취약점:**
- Server Action (`actions/admin.ts`) 40개 이상의 함수에 **인증 체크가 전혀 없음**. 누구든 직접 호출 가능.
- 미들웨어(`src/middleware.ts`) 파일이 **아예 존재하지 않아** `/admin/*` 경로 보호가 실제로는 동작하지 않을 가능성이 높음.
- 회원가입 시 `role: "ADMIN"` 값을 클라이언트에서 직접 보냄 — 누구나 관리자 계정 생성 가능.

---

## 1. 인증/인가 (Authentication & Authorization)

### 현재 상태

**미들웨어 구조:**
- `src/lib/supabase/middleware.ts`에 `updateSession()` 함수가 정의되어 있음.
- 그러나 **`src/middleware.ts` 파일이 존재하지 않음**. Next.js에서 미들웨어가 실행되려면 `src/middleware.ts` (또는 프로젝트 루트 `middleware.ts`)에서 export해야 함.
- CLAUDE.md에도 "미들웨어 주의: `src/middleware.ts`가 없다"고 명시되어 있음.

**결론**: `/admin/*` 경로의 미들웨어 보호가 **실제로 동작하지 않을 가능성이 매우 높음**.

> 단, 각 `/admin/*/page.tsx`가 Server Component이고, 내부에서 `createClient()` + `getUser()`를 호출하여 인증을 체크하는 패턴이 있다면 페이지 레벨에서 보호될 수 있음. 하지만 이는 미들웨어 보호와 별개의 문제.

**Server Action 인증 부재:**
- `src/app/actions/admin.ts`에 **40개 이상의 exported 함수**가 있으나, 단 하나도 `supabase.auth.getUser()` 인증 체크를 하지 않음.
- `src/app/actions/schedule.ts`에도 5개 함수 모두 인증 체크 없음.
- Server Action은 HTTP POST 엔드포인트로 노출되므로, 인증 없이 누구나 직접 호출 가능.

**역할 기반 접근 제어(RBAC) 부재:**
- Prisma 스키마에 `Role` enum (`ADMIN`, `INSTRUCTOR`, `PARENT`)이 정의되어 있으나, 코드 어디에서도 역할 검증을 하지 않음.
- 로그인한 사용자라면 학부모든 관리자든 모든 Server Action을 호출할 수 있음.

**회원가입 역할 취약점:**
- `login/page.tsx` 190행: `<input type="hidden" name="role" value="ADMIN" />`
- `actions/auth.ts` 43행: `const role = (formData.get("role") as string) || "PARENT";`
- 회원가입 시 role 값을 클라이언트에서 보내므로, 개발자 도구로 "ADMIN"을 "PARENT"로 바꾸든 그 반대든 자유롭게 조작 가능.
- **누구나 ADMIN 역할로 가입할 수 있음**.

### 발견된 문제

| # | 문제 | 위험도 | 영향 |
|---|------|--------|------|
| 1-1 | src/middleware.ts 파일 미존재 — /admin/* 미들웨어 보호 미작동 | 🔴 높음 | 비로그인 사용자가 관리자 페이지 접근 가능 |
| 1-2 | Server Action 인증 체크 전무 (40개+ 함수) | 🔴 높음 | 비로그인 사용자가 DB CRUD 직접 수행 가능. 데이터 삭제/변조 위험 |
| 1-3 | 회원가입 시 role을 클라이언트에서 전송 | 🔴 높음 | 누구나 ADMIN 계정 생성 가능 |
| 1-4 | RBAC(역할 기반 접근 제어) 미구현 | 🟡 중간 | 학부모가 관리자 기능 사용 가능 |
| 1-5 | /setup 페이지 보안 취약 | 🟡 중간 | check-setup API가 "관리자 1명이라도 있으면 차단"이지만, 클라이언트 측 검사만 수행. API 호출 실패 시 셋업 허용 |

### 권장 조치

**1-1. src/middleware.ts 생성 (즉시)**
```typescript
// src/middleware.ts
import { updateSession } from "@/lib/supabase/middleware";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: ["/admin/:path*", "/login", "/mypage/:path*"],
};
```

**1-2. Server Action 인증 헬퍼 추가 (즉시)**
```typescript
// src/lib/auth-guard.ts
import { createClient } from "@/lib/supabase/server";

export async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("인증 필요");
  // user_metadata.role 확인 또는 DB에서 역할 조회
  return user;
}
```
모든 admin Server Action 함수 최상단에 `await requireAdmin();` 추가.

**1-3. 회원가입 역할 고정 (즉시)**
- `actions/auth.ts`의 `signup` 함수에서 `formData.get("role")` 제거.
- 서버 측에서 역할을 "PARENT"로 고정.
- 관리자 계정은 Supabase Dashboard에서만 생성하거나, 기존 관리자만 추가할 수 있도록 변경.

---

## 2. API 보안

### 현재 상태

**API Route 인증**: 모든 `/api/admin/*` 엔드포인트가 `supabase.auth.getUser()` 인증 체크를 수행함 --- 이 부분은 양호.

| API Route | 인증 | 비고 |
|-----------|------|------|
| `/api/admin/backup` (GET/POST) | O | 관리자만 백업/복원 |
| `/api/admin/backup-now` (POST) | O | 관리자만 수동 백업 |
| `/api/admin/cloud-backups` (GET/POST/DELETE) | O | 관리자만 클라우드 백업 관리 |
| `/api/admin/diagnostics` (GET) | O | 관리자만 진단 |
| `/api/admin/export-seed` (GET) | O | 관리자만 시드 내보내기 |
| `/api/admin/seed` (POST) | O | 관리자만 시드 복원 |
| `/api/admin/parse-excel` (POST) | O | 관리자만 엑셀 파싱 |
| `/api/admin/attendance` (GET) | O | 관리자만 출결 조회 |
| `/api/admin/finance` (GET) | O | 관리자만 수납 조회 |
| `/api/admin/sync-schedule` (POST) | O | 관리자만 동기화 |
| `/api/admin/session-detail` (GET) | O | 관리자만 세션 조회 |
| `/api/cron/backup` (GET) | 조건부 | CRON_SECRET 설정 시 Bearer 토큰 검증 |
| `/api/cron/sync-schedule` (GET) | 조건부 | CRON_SECRET 설정 시 Bearer 토큰 검증 |
| `/api/chat` (POST) | X | 공개 챗봇 — 인증 불필요 (의도적) |
| `/api/push` (POST/DELETE) | O | 로그인 사용자만 |
| `/api/upload` (POST) | O | 로그인 사용자만 |
| `/api/auth/check-setup` (GET) | X | 공개 — Service Role Key 사용 (의도적) |

**Cron 보안:**
- `CRON_SECRET` 미설정 시 cron 엔드포인트가 **인증 없이 실행됨**.
- 코드: `if (cronSecret) { ... }` — 환경변수가 없으면 검증을 건너뜀.

**채팅 API Rate Limiting 부재:**
- `/api/chat`은 공개 API이지만 Rate Limiting이 없음. Gemini API 키가 남용될 수 있음.

**파일 업로드 검증:**
- `/api/upload`에서 파일 확장자 검증이 없음. 악의적 파일 업로드 가능.
- 파일 크기 제한도 없음 (Vercel 자체 제한인 ~4.5MB에 의존).
- Supabase Storage 실패 시 로컬 파일시스템 fallback — Vercel에서는 의미 없지만, 다른 환경에서 보안 위험.

### 발견된 문제

| # | 문제 | 위험도 | 영향 |
|---|------|--------|------|
| 2-1 | CRON_SECRET 미설정 시 cron API 무방비 | 🟡 중간 | 외부에서 반복 호출하여 DB 부하 유발 가능 |
| 2-2 | /api/chat Rate Limiting 없음 | 🟡 중간 | Gemini API 키 남용, 비용 폭증 가능 |
| 2-3 | /api/upload 파일 타입 미검증 | 🟡 중간 | 악성 파일 업로드 가능 (실행 위험은 낮지만 스토리지 남용) |
| 2-4 | /api/auth/check-setup이 Service Role Key로 전체 유저 목록 조회 | 🟢 낮음 | hasAdmin boolean만 반환하므로 데이터 노출 없음, 그러나 불필요한 권한 사용 |

### 권장 조치

**2-1. CRON_SECRET 필수화**
```typescript
// CRON_SECRET 없으면 거부 (선택이 아닌 필수)
const cronSecret = process.env.CRON_SECRET;
if (!cronSecret || req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

**2-2. 채팅 API Rate Limiting**
- Vercel Edge Middleware 또는 `@upstash/ratelimit` 등으로 IP당 분당 요청 수 제한.

**2-3. 업로드 파일 타입 화이트리스트**
```typescript
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
if (!ALLOWED_TYPES.includes(file.type)) {
  return NextResponse.json({ error: "허용되지 않는 파일 형식" }, { status: 400 });
}
```

---

## 3. 데이터 보호

### 현재 상태

**SQL 인젝션 분석 결과: 안전**

프로젝트 전체에서 `$queryRawUnsafe` / `$executeRawUnsafe`를 사용하고 있으나, **모든 사용자 입력이 파라미터 바인딩($1, $2, ...)으로 전달됨**. SQL 문자열에 사용자 입력을 직접 삽입하는 코드는 발견되지 않음.

확인된 패턴:
- `admin.ts`: 모든 INSERT/UPDATE/DELETE에서 `$1, $2, ...` 바인딩 사용.
- `schedule.ts`: `updateCustomSlot`에서 동적 SET 절 생성하지만, 컬럼명은 코드 내 하드코딩된 `data.xxx` 속성명에서 결정되고, 값은 바인딩으로 전달. 안전.
- `queries.ts`: 읽기 전용 쿼리, 사용자 입력 없이 고정 SQL.
- `admin.ts` `rawUpsertAcademySettings`: `ALLOWED_SETTINGS_COLUMNS` 배열로 화이트리스트 제한. 안전.

유일한 주의점:
- `admin.ts` `notifyParentsOfStudents`에서 `placeholders` 동적 생성: `studentIds.map((_, i) => $${i + 1}).join(",")` — 값은 바인딩으로 전달되므로 안전하나, 배열 크기가 매우 클 경우 성능 문제 가능.

**환경변수:**
- `.env*`가 `.gitignore`에 포함 — Git에 노출되지 않음.
- `NEXT_PUBLIC_SUPABASE_URL`과 `NEXT_PUBLIC_SUPABASE_ANON_KEY`는 Supabase 설계상 공개 가능 (RLS로 보호).
- `SUPABASE_SERVICE_ROLE_KEY`는 서버에서만 사용 (`admin.ts`, `cron/backup/route.ts`).

**Supabase RLS:**
- Prisma를 통해 직접 DB 연결 → RLS가 적용되지 않음 (Prisma는 `DATABASE_URL`로 직접 연결).
- Supabase SDK를 통한 접근(Storage 등)에는 RLS 적용됨.
- **DB 데이터 보호는 전적으로 애플리케이션 코드의 인증 체크에 의존**.

**민감 데이터 암호화:**
- 비밀번호: Supabase Auth가 bcrypt 해싱 처리 — 안전.
- 개인정보(이름, 전화번호, 주소, 생년월일): DB에 **평문 저장**.
- PushSubscription의 auth/p256dh 키: 평문 저장.

### 발견된 문제

| # | 문제 | 위험도 | 영향 |
|---|------|--------|------|
| 3-1 | 개인정보(전화번호, 주소, 생년월일) 평문 저장 | 🟡 중간 | DB 유출 시 개인정보 직접 노출 |
| 3-2 | Prisma 직접 연결로 RLS 우회 | 🟢 낮음 | 의도된 설계이나, 앱 코드 인증이 유일한 보호막 |
| 3-3 | 에러 메시지에 내부 정보 포함 가능 | 🟢 낮음 | `console.error`로 서버 로그에만 기록, 클라이언트에는 일반 메시지 반환 — 양호 |

### 권장 조치

**3-1. 민감 데이터 암호화 (장기)**
- 전화번호, 주소 등 PII(개인식별정보)를 AES-256으로 암호화 후 저장.
- 현실적으로는 Supabase의 `pgsodium` 확장 또는 앱 레벨 암호화 고려.
- **단기 대안**: DB 접근 권한을 최소화하고, Supabase 대시보드 접근을 강화.

---

## 4. 프론트엔드 보안

### 현재 상태

**XSS (Cross-Site Scripting):**
- `dangerouslySetInnerHTML` 사용 위치 5곳 발견:
  - `ApplyPageClient.tsx` 84행: 체험/수강신청 콘텐츠 (trialContent/enrollContent)
  - `about/page.tsx` 102, 142, 226행: 학원 소개/철학/시설 텍스트
  - `LandingPageClient.tsx` 86행: 소개 텍스트
- 이 데이터는 모두 **관리자가 Tiptap 에디터로 입력한 HTML**이 DB에 저장된 것.
- 관리자만 입력 가능하므로 자가 XSS(Self-XSS) 수준이나, 관리자 계정이 탈취되면 악성 스크립트 삽입 가능.
- **HTML 새니타이징(sanitization)이 전혀 없음**.

**CSRF (Cross-Site Request Forgery):**
- Next.js Server Action은 기본적으로 CSRF 토큰 없이 동작하나, Same-Origin 정책과 POST 요청의 특성상 외부 사이트에서의 CSRF 공격은 제한적.
- Supabase Auth의 쿠키 기반 인증을 사용하므로, CSRF 위험이 완전히 제거된 것은 아님.

**클라이언트 노출 환경변수:**
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase 프로젝트 URL — 공개 가능 (설계상 안전).
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: RLS로 보호되는 공개 키 — 안전.
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`: Push 알림 공개 키 — 안전.
- 위험한 키 노출 없음.

### 발견된 문제

| # | 문제 | 위험도 | 영향 |
|---|------|--------|------|
| 4-1 | dangerouslySetInnerHTML에 새니타이징 없음 | 🟡 중간 | 관리자 계정 탈취 시 저장형 XSS 공격 가능. 학부모가 악성 페이지 열람 시 세션 탈취 위험 |
| 4-2 | CSRF 보호 명시적 없음 | 🟢 낮음 | Next.js/Supabase 기본 보호에 의존. Server Action은 Same-Origin으로 제한 |

### 권장 조치

**4-1. HTML 새니타이징 추가 (단기)**
```typescript
// DOMPurify 또는 isomorphic-dompurify 설치
import DOMPurify from "isomorphic-dompurify";

// dangerouslySetInnerHTML 사용 전 새니타이징
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(htmlContent) }} />
```

---

## 5. 개인정보보호법 준수

### 현재 상태

**수집하는 개인정보 항목:**

| 대상 | 수집 항목 | 저장 위치 |
|------|----------|----------|
| 학부모 (User) | 이메일, 이름, 전화번호 | User 테이블 |
| 학생 (Student) | 이름, 생년월일, 성별, 전화번호, 학교, 학년, 주소, 입회일, 메모 | Student 테이블 |
| 보호자 (Guardian) | 이름, 관계, 전화번호 | Guardian 테이블 |
| 수납 (Payment) | 금액, 납부일 | Payment 테이블 |
| 출결 (Attendance) | 출석 상태, 날짜 | Attendance 테이블 |
| 알림 구독 (PushSubscription) | endpoint, p256dh, auth 키 | PushSubscription 테이블 |

**미성년자 개인정보 포함**: 학생(아동)의 이름, 생년월일, 성별, 학교, 주소 등 민감 정보 수집.

**개인정보 처리방침:**
- `/terms` 페이지에 "이용약관"이 존재하나, 이는 수강 규정/환불 정책 중심.
- **별도의 "개인정보 처리방침" 페이지가 존재하지 않음**.

**동의 절차:**
- 회원가입(`/login`) 시 개인정보 수집/이용 동의 체크박스 없음.
- 학생 등록 시 보호자 동의 절차 없음.

**개인정보 보관 기간/파기:**
- 보관 기간 정책이 정의되지 않음.
- 삭제 기능은 있으나 (`deleteStudent` 등), 자동 파기 메커니즘 없음.
- 학생 삭제 시 관련 출결/수납/등록 데이터도 함께 삭제됨 (cascade) — 이 부분은 양호.

### 발견된 문제

| # | 문제 | 위험도 | 영향 |
|---|------|--------|------|
| 5-1 | 개인정보 처리방침 페이지 미존재 | 🔴 높음 | 개인정보보호법 제30조 위반. 과태료 대상 |
| 5-2 | 개인정보 수집/이용 동의 절차 없음 | 🔴 높음 | 개인정보보호법 제15조 위반. 특히 미성년자 정보 수집 시 법정대리인 동의 필수 |
| 5-3 | 개인정보 보관 기간 미정의 | 🟡 중간 | 개인정보보호법 제21조 — 보관 기간 경과 시 파기 의무 |
| 5-4 | 개인정보 접근 권한 관리 미흡 | 🟡 중간 | RBAC 미구현으로 누구든 로그인하면 전 개인정보 접근 가능 |

### 권장 조치

**5-1. 개인정보 처리방침 페이지 추가 (즉시)**
- `/privacy` 경로에 개인정보 처리방침 페이지 생성.
- 필수 포함 항목: 수집 항목, 수집 목적, 보관 기간, 제3자 제공 여부, 파기 절차, 정보주체의 권리, 개인정보 보호책임자 연락처.
- 푸터에 링크 추가.

**5-2. 동의 절차 구현 (단기)**
- 회원가입 폼에 개인정보 수집/이용 동의 체크박스 추가.
- 미성년자 학생 등록 시 법정대리인(보호자) 동의 확인 절차 추가.

---

## 6. 배포/인프라 보안

### 현재 상태

**보안 헤더:**
- `next.config.ts`에 보안 헤더 설정이 **전혀 없음**.
- Content-Security-Policy, X-Frame-Options, X-Content-Type-Options 등 미설정.
- Next.js는 기본적으로 `X-Frame-Options: SAMEORIGIN`을 보내지 않음.

**HTTPS:**
- Vercel 배포이므로 HTTPS가 **자동 적용됨** — 양호.
- `stiz-dasan.kr` 커스텀 도메인도 Vercel에서 SSL 인증서 자동 발급.

**백업 체계:**
- Supabase Storage "backups/" 버킷에 자동/수동 백업 — 양호.
- 백업 파일은 `{ public: false }` 버킷에 저장 — 양호.
- 30일 자동 삭제 — 양호.

**에러 메시지 노출:**
- `error.tsx`에서 사용자에게 일반적인 에러 메시지만 표시 — 양호.
- `console.error`로 서버 로그에만 상세 에러 기록.
- 일부 API Route에서 `{ error: String(e) }` 반환 — 내부 에러 메시지가 클라이언트에 노출될 수 있음.

**Vercel 함수 설정:**
- `maxDuration: 30` (30초) — 적절.

### 발견된 문제

| # | 문제 | 위험도 | 영향 |
|---|------|--------|------|
| 6-1 | 보안 헤더 미설정 (CSP, X-Frame-Options 등) | 🟡 중간 | 클릭재킹, MIME 스니핑, XSS 추가 위험 |
| 6-2 | 일부 API에서 내부 에러 메시지 노출 | 🟢 낮음 | `String(e)`로 스택 트레이스가 노출될 수 있음 |

### 권장 조치

**6-1. 보안 헤더 추가 (단기)**
```typescript
// next.config.ts
const nextConfig: NextConfig = {
  // ... 기존 설정 유지
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};
```

**6-2. 에러 메시지 일반화**
```typescript
// API Route에서
return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
// 상세 에러는 console.error로만 기록
```

---

## 우선순위별 조치 계획

### 🔴 즉시 (배포 전 필수) — 학부모 개인정보 유입 전 반드시 완료

| # | 작업 | 관련 문제 | 예상 소요 |
|---|------|----------|----------|
| 1 | `src/middleware.ts` 생성 (미들웨어 활성화) | 1-1 | 5분 |
| 2 | Server Action 전체에 인증 체크 추가 (auth-guard 헬퍼 + 40개 함수 적용) | 1-2 | 30분 |
| 3 | 회원가입 role 서버 측 고정 (PARENT 강제, ADMIN 불가) | 1-3 | 5분 |
| 4 | 개인정보 처리방침 페이지 생성 (/privacy) | 5-1 | 20분 |
| 5 | 회원가입/학생등록 시 개인정보 동의 체크박스 추가 | 5-2 | 15분 |

### 🟡 단기 (1~2주 내)

| # | 작업 | 관련 문제 | 예상 소요 |
|---|------|----------|----------|
| 6 | RBAC 구현 (관리자/학부모 역할별 접근 제어) | 1-4 | 2시간 |
| 7 | 보안 헤더 설정 (next.config.ts) | 6-1 | 10분 |
| 8 | CRON_SECRET 필수화 | 2-1 | 5분 |
| 9 | dangerouslySetInnerHTML 새니타이징 (DOMPurify) | 4-1 | 20분 |
| 10 | /api/upload 파일 타입 화이트리스트 | 2-3 | 10분 |
| 11 | API 에러 메시지 일반화 | 6-2 | 15분 |

### 🟢 중기 (1개월 내)

| # | 작업 | 관련 문제 | 예상 소요 |
|---|------|----------|----------|
| 12 | /api/chat Rate Limiting 추가 | 2-2 | 30분 |
| 13 | 개인정보 보관 기간 정책 수립 및 자동 파기 구현 | 5-3 | 2시간 |
| 14 | 개인정보 접근 로그 기록 | 5-4 | 1시간 |

### ⚪ 장기 (선택)

| # | 작업 | 관련 문제 | 예상 소요 |
|---|------|----------|----------|
| 15 | 민감 데이터 암호화 (전화번호, 주소 등) | 3-1 | 4시간 |
| 16 | CSP(Content-Security-Policy) 상세 설정 | 6-1 | 1시간 |
| 17 | 2단계 인증(2FA) 도입 (관리자 계정) | 1-4 | 2시간 |
| 18 | 보안 감사 로그 시스템 구축 | - | 4시간 |

---

## 부록: SQL 인젝션 상세 분석

### 분석 방법
`$queryRawUnsafe` / `$executeRawUnsafe` 사용하는 모든 코드를 검토하여, 사용자 입력이 SQL 문자열에 직접 삽입되는지 확인.

### 결과: 안전

**전형적 패턴 (안전):**
```typescript
// admin.ts — 파라미터 바인딩 사용
await prisma.$executeRawUnsafe(
  `INSERT INTO "Program" (...) VALUES ($1, $2, $3, ...)`,
  name, targetAge, description, ...  // 값은 $1, $2로 바인딩
);
```

**동적 SQL이지만 안전한 경우:**
```typescript
// schedule.ts updateCustomSlot — 동적 SET 절
const fields: string[] = [];
const values: any[] = [];
if (data.dayKey !== undefined) add("dayKey", data.dayKey);
// 컬럼명은 코드 내 하드코딩, 값은 $N 바인딩
await prisma.$executeRawUnsafe(
  `UPDATE "CustomClassSlot" SET ${fields.join(", ")} WHERE id = $${idx}`,
  ...values
);
```
- `fields` 배열에 들어가는 컬럼명은 코드에서 하드코딩된 문자열(`"dayKey"`, `"startTime"` 등)이므로 사용자 입력이 아님.
- 값은 모두 `$N` 파라미터 바인딩으로 전달.

**유일한 미세 주의점:**
```typescript
// admin.ts rawUpsertAcademySettings
const setClauses = colsToUpdate.map((col, i) => `"${col}" = $${i + 1}`).join(", ");
```
- `colsToUpdate`는 `ALLOWED_SETTINGS_COLUMNS` 화이트리스트에서 필터링된 값만 사용.
- 외부 입력이 컬럼명에 들어갈 수 없으므로 안전.

---

## 부록: 현재 인증 흐름 요약

```
[사용자 요청]
    |
    v
[src/middleware.ts] -- 파일 미존재! → 미들웨어 건너뜀
    |
    v
[/admin/*/page.tsx (Server Component)]
    |-- 일부 페이지에서 supabase.auth.getUser() 호출
    |-- 미인증 시 리다이렉트 또는 빈 페이지
    |
    v
[Server Action (actions/admin.ts)]
    |-- 인증 체크 없음!
    |-- 누구나 직접 HTTP POST로 호출 가능
```

미들웨어가 활성화되면:
```
[사용자 요청]
    |
    v
[src/middleware.ts] → updateSession()
    |-- /admin/* → 미인증 시 /login 리다이렉트
    |-- 세션 토큰 갱신
    |
    v
[Server Action]
    |-- requireAdmin() → 인증 + 역할 확인
```
