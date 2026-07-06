# 작업 스크래치패드

## 현재 작업
- **요청**: 공지사항 글쓰기 에디터를 "완성도 높은 리치 에디터"로 강화 (기획 단계)
- **상태**: 기획설계 완료 → 사용자 결정 대기 → developer 대기
- **현재 담당**: planner-architect 완료
- **마지막 세션**: 2026-07-06

## 진행 현황
| 항목 | 상태 |
|------|------|
| 공지 리치에디터 강화 기획 | 완료 (사용자 결정 2건 대기) |
| 미푸시 커밋 | 별도 확인 필요 |

---

## 기획설계 (planner-architect) — 공지 리치 에디터 강화

🎯 **목표**: 공지사항 작성을 순수 textarea에서 "이미지 위치/정렬/크기 + 표/리스트/인용/구분선 + 링크UI/유튜브 + 드래그·붙여넣기 업로드"가 되는 완성도 높은 리치 에디터로 강화한다.

### 📌 현황 요약 (코드 재확인 완료)
- **공지 작성**(`src/app/admin/notices/NoticesAdminClient.tsx`): 순수 `<textarea>` + content는 **plain text** 저장. 이미지는 본문이 아니라 "첨부파일"(attachmentsJSON)로 하단 별도 노출.
- **공지 렌더**(`src/app/notices/[id]/page.tsx`): `dangerouslySetInnerHTML={{__html: toNoticeHtml(content)}}` + `whitespace-pre-wrap`. toNoticeHtml은 전부 escape + URL만 `<a>`로 변환(HTML 아님).
- **TipTap 에디터**(`src/components/RichTextEditor.tsx`): **설정 페이지(소개글/이념/시설) 단 1곳만** 사용. 공지에는 미적용. 등록 확장 = StarterKit/TextStyle/Color/Underline/TextAlign 뿐. FontSize.ts는 구현됐으나 미등록.
- **StarterKit 3.20 내장 확인**: blockquote·bullet/ordered-list·horizontal-rule·**link**·dropcursor·gapcursor·underline 전부 포함 → 리스트/인용/구분선/링크는 **패키지 추가 없이** 툴바 버튼만 필요. 표·유튜브만 신규 설치.
- **이미지 업로드 인프라 완비**: `/api/upload`(POST) — 버킷 `uploads`, folder 파라미터(notices), 5MB·이미지타입 제한, 로그인 인증, 반환 `{url}`. 에디터 인라인 삽입에 그대로 재사용 가능.
- **sanitize**(`src/lib/sanitize.ts`): sanitize-html 기반. defaults에 table/thead/tbody/tr/td/th·blockquote·hr·ul/ol/li **이미 허용**. iframe만 없음 → 유튜브용 추가 필요.

### ⚠️ 사용자 결정 필요 2건 (진행 전 확인)
1. **공지 저장 포맷 전환**: plain text → HTML. 기존 공지(plain)와 새 공지(HTML) 혼재 → 렌더에서 판별(HTML 태그 유무). 기존 공지는 그대로 보임(안전). **동의 필요**.
2. **하단 이미지 첨부 유지 여부**: 본문 삽입이 가능해지면 기존 "첨부→하단 노출"과 중복. 권장 = **첨부 기능 유지 + 본문 삽입 추가(공존)**. 기존 UX 보존.

### 📦 필요 패키지 (TipTap 3.20 호환)
| 패키지 | 용도 | 신규? |
|--------|------|-------|
| @tiptap/extension-table | 표(Table/Row/Cell/Header 포함) | 신규 설치 |
| @tiptap/extension-youtube | 유튜브 임베드(iframe) | 신규 설치 |
| (기존) @tiptap/extension-image | 이미지 노드 | 설치됨, 등록만 |
| (기존) StarterKit 내장 Link/List/Blockquote/Hr/Dropcursor | 링크·리스트·인용·구분선 | 설치됨, 툴바만 |
| (기존) re-resizable | 이미지 드래그 리사이즈 핸들 | 설치됨(빌더용), 재활용 |
| 커스텀 ResizableImage 확장 | 이미지 정렬(좌/중/우)+크기 | 신규 코드(NodeView) |

### 🖼️ 이미지 업로드 방식
- 기존 `/api/upload` 재사용(folder=`notices`, 버킷 `uploads`). 신규 스토리지·API 불필요.
- 3경로: (1)툴바 이미지 버튼→파일선택, (2)에디터에 파일 드래그&드롭, (3)클립보드 붙여넣기. 셋 다 업로드 후 반환 url을 에디터에 삽입.
- 정렬/크기: 커스텀 ResizableImage NodeView가 `data-align`(class) + `width`(style/attr) 저장. 드래그 핸들은 re-resizable 재활용.

### 🔒 sanitize.ts 확장안 (보안 핵심)
- **iframe 추가**: allowedTags에 `iframe`, 속성 `src·width·height·frameborder·allow·allowfullscreen·class·style`.
- **유튜브만 허용**: `allowedIframeHostnames: ['www.youtube.com','youtube.com','www.youtube-nocookie.com','youtu.be']` (sanitize-html 옵션) → 그 외 도메인 iframe 전부 제거.
- **img 정렬/크기**: `data-align` 속성 허용(정렬은 class 기반 권장, style 최소화). width/height는 이미 허용.
- **표**: colspan/rowspan(td/th) 허용. 나머지 표 태그는 이미 defaults.
- allowedStyles에 이미지/표 폭 등 필요 최소만 추가. script·onclick·javascript: 차단은 현행 유지.

### 🎨 렌더 파이프라인 영향
- **판별 렌더**: content에 HTML 태그(`<p`,`<img`,`<table` 등) 있으면 `sanitizeHtml(content)`, 없으면 기존 `toNoticeHtml(content)`(plain 공지 하위호환).
- HTML 공지는 `whitespace-pre-wrap` 제거 + `.notice-content` prose 스타일 적용(표 테두리, 유튜브 16:9 반응형, 이미지 정렬 class, 리스트 마커, blockquote 좌측선). 하드코딩 색상 금지 → CSS 변수.

### 📋 실행 계획 (위험 낮은 순, 각 단계 developer 후 소검증)
| 순서 | 작업 | 담당 | 위험도 | 선행 |
|------|------|------|--------|------|
| 1 | 패키지 설치 + 에디터 확장/툴바 강화(리스트·인용·구분선·링크UI팝업 + FontSize 등록). 설정 페이지에서 먼저 검증 | developer | 낮음 | 없음 |
| 2 | 이미지 업로드 3경로(툴바버튼+드래그&드롭+붙여넣기), /api/upload 재사용 | developer | 중 | 1 |
| 3 | 이미지 정렬(좌/중/우)+드래그 크기조절 커스텀 ResizableImage NodeView | developer | 높음 | 2 |
| 4 | 표 삽입 + 유튜브 URL 임베드(extension-table/youtube + 툴바) | developer | 중 | 1 |
| 5 | sanitize.ts 보안 확장(iframe youtube 화이트리스트+img/표 속성) + 공개 렌더 .notice-content 스타일 | developer | 중(보안) | 3,4 |
| 6 | 공지 적용(textarea→RichTextEditor) + 렌더 plain/HTML 판별 + 첨부 공존 | developer | 높음 | 5 |
| 7 | 붙여넣기 정제(transformPastedHTML) + 통합 검증 | tester + reviewer (병렬) | 낮음 | 6 |

### ⚠️ developer 주의사항
- **RichTextEditor는 공유 컴포넌트** — 강화하면 설정 페이지 소개글 에디터도 같이 강화됨(이득이나, 설정 저장/렌더 회귀 확인). 공지 전용 옵션이 필요하면 prop(예: `variant`)로 분기.
- 기존 plain 공지 렌더 **절대 깨뜨리지 말 것**(판별 렌더로 하위호환).
- 하단 이미지 첨부(attachmentsJSON) 기능 **보존**.
- iframe은 **반드시 youtube 도메인 화이트리스트** — 임의 iframe 삽입 차단(XSS).
- 하드코딩 색상 금지(CSS 변수), 아이콘은 기존 에디터가 lucide/인라인 SVG 사용 중 → 공개 페이지 신규 UI는 Material Symbols 규칙 확인.
- DB content 컬럼 재사용(스키마 변경 불필요). 저장 시 서버 sanitize는 렌더에서 하므로 저장은 raw 유지 가능(현행 패턴).

---

## 구현 기록 (developer)

### 구현 기록 — 공지 리치 에디터 강화 1~2단계 (2026-07-06)

📝 구현한 기능: 공유 TipTap 에디터(RichTextEditor)에 **툴바 강화(1단계)** + **이미지 업로드 3경로(2단계)** 추가. 신규 패키지 설치 **없음**(StarterKit 3.20 내장 + 설치된 extension-image 재활용).

**상태: 1~2단계 완료, 3단계(이미지 정렬/드래그 크기조절 NodeView) 대기.**

| 파일 경로 | 변경 내용 | 신규/수정 |
|----------|----------|----------|
| src/components/RichTextEditor.tsx | 툴바에 목록/인용/구분선/링크팝업/글자크기 추가, Image 확장 등록, 이미지 업로드 3경로(버튼·드래그·붙여넣기) + 로딩 오버레이 | 수정 |
| src/app/globals.css | .ProseMirror 목록/인용/구분선/링크 스타일 추가(Tailwind reset 복원, CSS변수 사용) | 수정 |

**1단계 상세:**
- 글자 크기 드롭다운(FontSize 확장 연결 — 기존 미등록이던 것을 등록+툴바 노출), 글머리표/순서 목록, 인용구, 가로 구분선, 링크 팝업(툴바 아래 인라인 입력 한 줄: 적용/링크제거/취소).
- 링크는 http/https/mailto만 허용(스킴 없으면 https:// 자동 부여, 그 외 차단). StarterKit 내장 Link를 openOnClick:false/target=_blank/rel=noopener로 구성.
- 기존 버튼(굵게/기울임/밑줄/색상/정렬)은 그대로 보존.

**2단계 상세:**
- @tiptap/extension-image 등록(inline:false). 3경로 모두 기존 `/api/upload` 재사용(FormData: file+folder, 응답 {url}, 5MB·이미지타입·관리자인증).
  1. 툴바 이미지 버튼 → 숨은 file input → 업로드 → 커서 위치 삽입
  2. 드래그&드롭 → editorProps.handleDrop, 놓은 좌표(posAtCoords)에 삽입(내부 이동 moved는 통과)
  3. Ctrl+V 붙여넣기 → editorProps.handlePaste, 클립보드 이미지 감지 시 업로드 후 삽입
- 업로드 중 반투명 로딩 오버레이 표시. 검증/실패 시에만 alert(정상 시 무알림).
- uploadFolder prop 추가(기본 "editor", 공지 적용 시 "notices" 전달용) — 설정 페이지는 기본값 사용.

💡 tester 참고:
- 테스트 방법: 개발서버(포트 4000) → `/admin/settings` 접속 → 소개글/이념/시설 에디터에서 검증.
- 정상 동작: (1)목록/인용/구분선/글자크기 버튼 클릭 시 서식 적용·해제, (2)링크 버튼→URL 입력 후 적용 시 링크 생성, 링크제거 동작, (3)이미지 버튼으로 파일 선택 업로드, (4)이미지 파일을 에디터에 드래그, (5)이미지 캡처 후 Ctrl+V — 셋 다 본문에 이미지 삽입 + 업로드 중 오버레이.
- 주의할 입력: 5MB 초과/비이미지 파일(거부 alert), 링크에 `javascript:...`(차단), 스킴 없는 도메인(자동 https://), mailto: 주소(허용).
- **회귀 확인 필수**: 설정 페이지 소개글 저장/재로드가 기존처럼 동작하는지(공유 컴포넌트라 같이 강화됨).

⚠️ reviewer 참고:
- 특별히 봐줄 부분: (1)handleDrop/handlePaste에서 view 직접 조작(schema.nodes.image.create + tr.insert) — 위치 계산·XSS 관점, (2)링크 스킴 검증 로직(http/https/mailto 화이트리스트)이 충분한지, (3)기존 Underline이 StarterKit 3.20에도 내장돼 중복 등록 상태(기존부터 존재, 동작엔 무해)이나 정리 여부 판단.
- 검증: `npx tsc --noEmit` EXIT=0, `npm run build` EXIT=0.
- 범위 밖(미구현): 이미지 정렬/크기조절(3), 표/유튜브(4), sanitize 확장(5), 공지 적용(6), 붙여넣기 정제(7).

## 테스트 결과 (tester)

### 테스트 결과 — 공지 리치 에디터 1~2단계 검증 (2026-07-06)

| 테스트 항목 | 결과 | 비고 |
|-----------|------|------|
| tsc --noEmit | ✅ 통과 | EXIT=0 |
| npm run build | ✅ 통과 | EXIT=0, /admin/settings 정상 컴파일(○ static, revalidate 30s) |
| 링크 스킴 제한(javascript: 차단) | ✅ 통과 | 이중 방어: 앱 레벨(스킴없으면 https:// 자동 후 http/https/mailto 화이트리스트 검증) + StarterKit Link protocols:['http','https','mailto']. `javascript:alert(1)` → `https://javascript:alert(1)`로 무해화 |
| 이미지 업로드 3경로 /api/upload 정합성 | ✅ 통과 | 버튼/handleDrop/handlePaste 모두 FormData(file+folder)→{url} 계약 일치. route.ts 필드명·응답형식 동일 |
| Image 확장 등록 | ✅ 통과 | Image.configure({inline:false}). @tiptap/extension-image ^3.20.0 설치 확인 |
| Link 확장 등록 | ✅ 통과 | StarterKit이 Link 항상 등록(dist line 70). configure({link}) 정상 반영 |
| FontSize 확장 등록 | ✅ 통과 | 미등록→등록+툴바 드롭다운 연결(setFontSize/unsetFontSize) |
| Underline 중복 등록 에러 여부 | ✅ 통과 | StarterKit이 Underline 기본 내장(dist line 84-85) + 별도 import 중복. 빌드/타입 에러 없음(런타임 console.warn 수준, 치명 아님) |
| 설정 페이지 회귀(인터페이스 유지) | ✅ 통과 | value/onChange/placeholder 그대로. name/uploadFolder는 optional·기본값("editor") 하위호환. 소개글/이념/시설 3곳 로직 불변 |
| CSS 하드코딩 색상 여부 | ✅ 통과 | globals.css 신규 스타일 모두 var(--color-*)/currentColor |
| 실제 dev 렌더 확인 | ⚠️ 미실시 | /admin/settings 관리자 로그인 벽으로 브라우저 렌더 확인 불가(비치명). build 컴파일 성공으로 렌더 가능성 확인 |

📊 종합: 11개 중 10개 통과 / 1개 미실시(로그인 벽, 비치명) / 0개 실패

**판정: 1~2단계 커밋 가능.** 코드 정합성·타입·빌드 통과, 설정 페이지 회귀 없음. (Underline 중복 등록은 reviewer 권장수정과 동일 — 비치명 정리 후보)

## 리뷰 결과 (reviewer) — 공지 리치 에디터 1~2단계 (2026-07-06)

📊 **종합 판정: 통과 (커밋 OK)** — 치명 이슈 없음. 링크 보안·업로드 견고성·인터페이스 보존 모두 양호.

✅ 잘된 점:
- **링크 스킴 검증이 안전**: "스킴 없으면 https:// 부여 → 그다음 검증" 순서라 `javascript:`/`data:`가 우회 불가. 예) `javascript:alert(1)` → `https://javascript:alert(1)`(무해한 깨진 https)로 중화됨. StarterKit `protocols:['http','https','mailto']` 화이트리스트로 autolink까지 이중 방어.
- **업로드 상태 정리 확실**: uploadImageFile이 try/catch/finally로 성공·실패 무관 `setUploading(false)`. 사전 타입/크기 검증(서버와 동일 기준)으로 불필요한 요청 차단.
- **3경로 공통 함수화**(uploadImageFile)로 중복 제거, moved 체크로 내부 드래그 이동 보존, 비이미지 파일은 false 반환해 기본 동작에 위임.
- **인터페이스 보존**: value/onChange/name/placeholder 유지 + uploadFolder는 optional 기본값 → 설정 페이지(AdminSettingsClient) 회귀 없음.
- **CSS 변수/currentColor 사용**(globals.css .ProseMirror)로 하드코딩 색상 회피, Tailwind reset 복원 주석 명확.

🔴 필수 수정: 없음

🟡 권장 수정:
- [RichTextEditor.tsx:7,90] **Underline 중복 등록** — StarterKit 3.20에 underline 내장이므로 별도 `Underline` import+등록은 중복. 콘솔에 "Duplicate extension names" 경고 발생 가능(동작은 무해). import/extensions에서 제거 권장.

🔵 사소 (선택, 커밋 무관):
- [uploadImageFile] 동시 업로드 시 `uploading` 불리언이 먼저 끝난 요청의 finally에서 조기 해제 → 오버레이가 남은 업로드 전에 사라질 수 있음. 카운터(useRef)로 개선 가능(희박한 케이스).
- [handleDrop:131] `pos`를 업로드 전에 캡처 → 업로드 지연 중 문서가 줄어들면 `tr.insert(pos, …)` 범위 초과 가능(RangeError, 매우 희박). `Math.min(pos, doc.content.size)` 클램프로 방어 가능.
- 중복 업로드 요청 가드 없음(이미지 버튼 연타/업로드 중 드롭). 필요 시 uploading 중 무시.
- 툴바 `iconBtn`·`hover:bg-gray-200` 등 dark: variant 부재(기존 패턴 답습) — 다크모드 미세 부조화.
- 아이콘이 인라인 SVG(비-lucide). admin 내부라 허용 범위지만 프로젝트 컨벤션은 Material Symbols → 후속 단계에서 통일 고려.
- 퀵컬러 하드코딩 hex(`#f97316`,`#1e3a8a`)는 **콘텐츠에 저장되는 실제 색상값**이라 CSS 변수로 대체 불가(불가피). 브랜드 토큰과 값 일치만 확인.

📌 범위 밖(미구현 정상): 이미지 정렬/크기(3), 표/유튜브(4), sanitize 확장(5), 공지 적용(6), 붙여넣기 정제(7).

## 미해결 리뷰 수정 사항 (이월)
| 번호 | 파일 | 심각도 | 내용 | 상태 |
|------|------|--------|------|------|
| R-1 | api/admin/trial-count/route.ts | 필수 | 인증 가드 추가 | 미처리 |
| R-2 | actions/public.ts | 권장 | source/referralSource 서버 화이트리스트 검증 | 미처리 |
| R-3 | actions/public.ts:353 | 권장 | shuttleNeeded: `\|\|` → `??` 변경 | 미처리 |

---

## 작업 로그 (최근 10건)

| 날짜 | 작업 내용 | 상태 |
|------|----------|------|
| 2026-07-06 | 공지 리치에디터 1~2단계 리뷰 — 링크보안/업로드견고성/인터페이스 통과, 치명0·권장1(Underline중복) | 리뷰통과(커밋OK) |
| 2026-07-06 | 공지 리치에디터 1~2단계 구현 — 툴바(목록/인용/구분선/링크/글자크기)+이미지업로드 3경로, 무설치, tsc/build EXIT=0 | 구현완료(tester대기) |
| 2026-07-06 | 공지 리치 에디터 강화 기획 — 7단계 계획+sanitize확장안+패키지목록, 사용자 결정 2건 대기 | 기획완료 |
| 2026-07-06 | 공지 500 근본 해결 리뷰 — XSS 런타임 검증, 통과 판정 | 완료 |
| 2026-07-06 | 공지 500 근본 해결 — sanitize.ts를 sanitize-html로 교체(jsdom 제거), build EXIT=0 | 완료 |
| 2026-07-06 | 공지 상세 500 원인 규명 — isomorphic-dompurify(jsdom) ERR_REQUIRE_ESM | 완료 |
| 2026-04-06 | 라이트/다크모드 가시성 전수조사 — 14파일 수정 | 완료 |
| 2026-04-06 | 다크모드 focus:bg-white 포커스 배경 수정 — 8파일 16곳 | 완료 |
| 2026-04-06 | 구글폼 전환 ON/OFF — AcademySettings 플래그, 14항목 검증 통과 | 완료 |
| 2026-03-29 | 수강신청 3필드 추가 + 신청폼 UI 정리 | 완료 |
| 2026-03-29 | 권한 5단계 + 코치 SMS 타겟팅 + SMS 템플릿 | 완료 |
| 2026-03-29 | 솔라피 SMS + 시간표 UI 리디자인 + 알림 시스템 | 완료 |
