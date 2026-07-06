# 프로젝트 구조 지식
<!-- 담당: planner-architect, developer | 최대 30항목 -->
<!-- 프로젝트의 폴더 구조, 파일 역할, 핵심 패턴을 기록 -->

### 2026-03-22 시간표 데이터 파이프라인
- **분류**: architecture
- **발견자**: planner-architect
- **내용**: 시간표 데이터는 3단계로 조합된다. (1) Google Sheets CSV -> SheetClassSlot[] (SheetSlotCache DB 캐시 or 직접 fetch), (2) ClassSlotOverride 테이블로 라벨/코치/시간/정원 오버라이드, (3) CustomClassSlot 테이블로 시트에 없는 커스텀 슬롯 추가. 최종 결과는 MergedSlot[] 배열. schedule/page.tsx에서 이 조합 로직이 구현되어 있고, ScheduleClient.tsx에서 MergedSlot 타입이 export된다.
- **참조횟수**: 0

### 2026-03-22 공개 페이지 공통 패턴
- **분류**: architecture
- **발견자**: planner-architect
- **내용**: 공개 페이지는 (1) PublicPageLayout 래퍼, (2) 히어로 섹션 (gradient + 장식도형 + AnimateOnScroll), (3) 본문 섹션, (4) CTABanner 하단 CTA 구조를 따른다. ISR 캐싱 적용 (공개=300초, 관리자=30초). 서버 컴포넌트에서 queries.ts 함수로 데이터 조회 후 클라이언트 컴포넌트에 props로 전달하는 패턴.
- **참조횟수**: 0

### 2026-03-22 학년 체계 (GRADE_ORDER)
- **분류**: architecture
- **발견자**: planner-architect
- **내용**: googleSheetsSchedule.ts에 GRADE_ORDER 배열이 정의됨: ["6세","7세","초1"~"초6","중1"~"중3","고1"~"고3","성인"]. MergedSlot.gradeRange는 "초4~중1" 형태의 문자열. formatGradeRange() 함수로 생성. 학년 범위 판별 시 GRADE_ORDER 인덱스 비교 방식 사용.
- **참조횟수**: 0

### 2026-03-29 알림 시스템 아키텍처
- **분류**: architecture
- **발견자**: planner-architect
- **내용**: 알림 시스템은 2계층 구조. (1) DB 인앱 알림: Notification 테이블에 INSERT -> 사용자가 /mypage 접속 시 조회. (2) 웹 Push: PushSubscription 테이블에 저장된 구독으로 web-push 라이브러리가 브라우저 푸시 발송. createNotificationRecord(admin.ts:1080)가 두 계층을 동시 처리. 관리자 알림 패턴: SELECT id FROM "User" WHERE role='ADMIN' -> for loop으로 각 관리자에게 createNotificationRecord 호출 (createParentRequest:1188에 구현됨). sendPushToUser(pushNotification.ts)는 VAPID 키로 서명, 구독 만료(410) 시 자동 삭제. Coach 모델에 userId 없어 코치에게 직접 알림 불가.
- **참조횟수**: 0

### 2026-07-06 리치 텍스트 에디터 구조 (TipTap)
- **분류**: architecture
- **발견자**: planner-architect
- **내용**: 리치 에디터는 `src/components/RichTextEditor.tsx`(TipTap 3.20, "use client") 하나. 등록 확장 = StarterKit/TextStyle/Color/Underline/TextAlign. `src/components/extensions/FontSize.ts`는 구현됐으나 미등록. prop: value(HTML string)/onChange/name(hidden input)/placeholder. 출력은 editor.getHTML(). **사용처는 설정 페이지 단 1곳**(admin/settings/AdminSettingsClient.tsx의 소개글/이념/시설 3곳, value+onChange 바인딩). **공지사항은 이 에디터 미사용** — NoticesAdminClient는 순수 textarea+plain text 저장, notices/[id]/page.tsx는 toNoticeHtml(전부 escape+URL만 <a>)로 렌더+whitespace-pre-wrap. 이미지는 본문이 아니라 attachmentsJSON으로 하단 별도 <img> 노출. StarterKit 3.20에는 blockquote·bullet/ordered-list·horizontal-rule·link·dropcursor·gapcursor·underline이 이미 내장(별도 패키지 불필요). 표(extension-table)·유튜브(extension-youtube)만 미설치. 이미지 업로드는 공용 `/api/upload`(버킷 uploads, folder 파라미터, 5MB·이미지타입, 로그인 인증, 반환 {url}) 재사용. sanitize.ts(sanitize-html)는 table/list/blockquote/hr 이미 허용, iframe만 미허용.
- **참조횟수**: 0

### 2026-03-26 관리자 페이지 데이터 로딩 패턴 분석
- **분류**: architecture
- **발견자**: planner-architect
- **내용**: admin 15개 페이지 전체가 revalidate:30 ISR 사용 (force-dynamic 0개). 서버 컴포넌트에서 queries.ts(react.cache) 함수로 데이터 조회 후 *Client.tsx에 props 전달하는 패턴 통일. 대시보드만 Suspense 스트리밍 적용. 대부분 페이지에서 Promise.all 병렬 쿼리 완료. 남은 병목: (1) 대시보드 getDashboardExtendedStats 이중 호출, (2) getClassWithStudents/getStudentActivity 직렬 쿼리, (3) schedule 페이지 Google Sheets 직렬 대기.
- **참조횟수**: 0
