# STIZ Knowledge Index

## 기준
- 기준일: 2026-07-15
- 문서 수: 5
- 프로젝트: STIZ 농구교실 다산점 홈페이지 및 관리자 시스템

## 최근 지식
- 현재 수강 상태(`Enrollment.status = ACTIVE`)는 최신 완료 수강생 배치의 최신 월 기준으로 맞춘다. 2026년 전체 월별 반복 행은 학생별 히스토리로 보존하고, 시간표 인원에는 최신 월만 반영한다.
- 관리자 수납 월별 청구서는 `청구 대상 확인 → 청구서 생성` 흐름으로 분리한다. 생성 전 대상 학생, 금액, 기존 유지 건을 먼저 확인하고, 청구서 생성 시 학부모 SMS는 자동 발송하지 않는다.
- 미납 알림은 청구서 생성과 분리된 별도 버튼으로 처리한다. 자동 발송보다 관리자 확인 후 발송하는 방식이 실사용 안정성이 높다.
- 학생 상세 화면에서는 수강 반별 `ACTIVE/PAUSED/WITHDRAWN` 상태를 직접 변경할 수 있다. 서버 액션에서 허용 상태값만 검증하고 관련 캐시를 무효화한다.
- 관리자 수납/결제 화면에는 최신 시트 저장 배치 기준 수납 대조 기능이 있다. 생성/수정/동일/확인 필요를 분리하고, 확인 필요 건은 자동 변경하지 않는다.
- 시간표는 `ScheduleSlot` DB 원본을 우선 사용한다. DB 데이터가 없을 때만 기존 시트 캐시로 fallback한다.
- 2026년 수강생 데이터는 스프레드시트 원본 보존 모델과 실제 `Student`/`Enrollment` 운영 모델을 함께 사용한다.

## 목차
- [architecture.md](architecture.md): 프로젝트 구조와 주요 기능
- [conventions.md](conventions.md): 작업, 코딩, 디자인 규칙
- [decisions.md](decisions.md): 기술 결정 이력
- [errors.md](errors.md): 에러와 주의할 함정
- [lessons.md](lessons.md): 작업 중 배운 교훈

## 현재 요약
- DB는 Supabase PostgreSQL이고 Prisma를 사용한다.
- Supabase PgBouncer 호환 때문에 DB 구조 보강은 raw SQL 보장 패턴을 자주 사용한다.
- 공개 홈페이지와 관리자 페이지가 같은 Next.js 앱 안에 있다.
- 관리자 속도 개선 방향은 서버 초기 payload 축소, 지연 로딩, 서버 캐시, 불필요한 prefetch 제거를 우선한다.
- 스프레드시트는 2026년 7월 기준 이관 자료로 사용하고, 8월 이후 운영은 DB 중심으로 전환하는 방향이다.

## 2026-07-15 추가 지식
- 결제 운영은 기존 Payment 153건을 PaymentInvoice와 1:1로 백필했고, PaymentTransaction/PaymentWebhookEvent/PaymentAuditLog로 온라인 납부와 추적 기록을 분리한다.
