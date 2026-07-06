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
- 관리자 운영 관리: 원생, 출결, 수납, 청구, 요청, 피드백, 체험 CRM, 대기자, 보강, 통계, SMS, 수강생 이관, 스태프

## 주요 데이터 모델
- 사용자/권한: `User`, `StaffInvitation`, `Role`
- 수강생/보호자: `Student`, `Guardian`, `Enrollment`
- 수업 운영: `Program`, `Class`, `Session`, `Attendance`, `StudentSessionNote`
- 결제/청구: `Payment`, `BillingTemplate`
- 홈페이지 콘텐츠: `AcademySettings`, `Coach`, `AnnualEvent`, `GalleryPost`, `Notice`, `Faq`, `Testimonial`
- 커뮤니케이션: `Notification`, `PushSubscription`, `SmsTemplate`, `ParentRequest`, `Feedback`
- 신청/운영 확장: `TrialLead`, `EnrollmentApplication`, `Waitlist`, `MakeupSession`, `SkillCategory`, `SkillRecord`

## 홈페이지-관리자 연결 상태
- 메인 홈 활동 사진 섹션은 공개 `GalleryPost` 이미지 데이터를 사용한다.
- `/gallery`도 `GalleryPost`를 사용하므로 홈과 갤러리 페이지의 기준 데이터가 통합됐다.
- `AcademySettings.galleryImagesJSON`은 아직 DB/관리자에 남아 있지만 홈 표시 기준에서는 제외됐다.
- 공개 페이지 상단 바와 푸터 운영시간은 `AcademySettings.operatingHours`를 사용한다.
- 운영시간 값이 비어 있으면 기본 문구를 보여주므로, 설정 입력 전에도 공개 페이지가 깨지지 않는다.

## 현재 확인된 상태
- 타입 체크는 통과한다.
- 전체 lint는 실패한다. 주된 원인은 기존 `any`, 루트 임시 JS 스크립트의 `require()`, React 19 lint 규칙 위반이다.
- 개발 서버 기본 포트는 4000이다.
