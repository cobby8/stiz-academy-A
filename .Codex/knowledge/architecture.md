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
- 관리자 사이트 관리: 학원 소개, 코치, 프로그램, 시간표, 일정, 공지, 갤러리, FAQ, 후기, 약관
- 관리자 운영 관리: 원생, 출결, 수납, 청구, 요청, 피드백, 체험 CRM, 대기자, 보강, 스킬, 통계, SMS, 수강생 이관, 스태프

## 주요 데이터 모델
- 사용자/권한: `User`, `StaffInvitation`, `Role`
- 수강생/보호자: `Student`, `Guardian`, `Enrollment`
- 수업 운영: `Program`, `Class`, `Session`, `Attendance`, `StudentSessionNote`
- 결제/청구: `Payment`, `BillingTemplate`
- 홈페이지 콘텐츠: `AcademySettings`, `Coach`, `AnnualEvent`, `GalleryPost`, `Notice`, `Faq`, `Testimonial`
- 커뮤니케이션: `Notification`, `PushSubscription`, `SmsTemplate`, `ParentRequest`, `Feedback`
- 신청/운영 확장: `TrialLead`, `EnrollmentApplication`, `Waitlist`, `MakeupSession`, `SkillCategory`, `SkillRecord`

## 현재 확인된 상태
- 타입 체크는 통과한다.
- 전체 lint는 실패한다. 주된 원인은 `any` 타입, 루트 임시 JS 스크립트의 `require()`, React 19 lint 규칙 위반이다.
- 개발 서버 기본 포트는 4000이다.
- 현재 4000번 포트에 실행 중인 프로세스는 확인되지 않았다.
