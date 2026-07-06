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

### 구현 기록 — 공지 리치 에디터 강화 3단계 (2026-07-06)

📝 구현한 기능: 본문 이미지의 **좌/중/우 정렬 + 드래그 크기조절**. `@tiptap/extension-image`를 확장한 커스텀 `ResizableImage`(React NodeView)로 교체. **Underline 중복 등록 제거**(reviewer 권장 반영). 신규 패키지 설치 **없음**.

**상태: 3단계 완료, 4단계(표/유튜브) 대기.**

| 파일 경로 | 변경 내용 | 신규/수정 |
|----------|----------|----------|
| src/components/extensions/ResizableImage.tsx | Image 확장 + width/align 속성 + React NodeView(정렬 툴바·모서리 리사이즈 핸들) | 신규 |
| src/components/RichTextEditor.tsx | Image→ResizableImage 교체, Underline import/등록 제거(StarterKit 내장) | 수정 |

**★ 정렬/크기 마크업 표현 방식 (5단계 sanitize 허용목록에 반드시 반영할 것):**
- **정렬**: `<img class="align-left|align-center|align-right" data-align="left|center|right">` — class(스타일용)와 data-align(파싱용)을 **둘 다** 렌더. 정렬 미지정(기본) 이미지는 두 속성 모두 없음(하위호환 유지).
  → sanitize: `allowedClasses.img = ['align-left','align-center','align-right']` + `allowedAttributes.img += ['data-align']` 필요.
- **크기**: `<img width="320">` — 정수 px, HTML `width` 속성. (sanitize-html 기본 img width 허용됨 → 별도 추가 불필요 예상, 5단계에서 확인만)
- 가드: 최소 40px, 최대 = 에디터 본문 폭(`editor.view.dom.clientWidth`). 비율은 height:auto로 자동 유지.
- 정렬 구현: NodeView 바깥 래퍼 div의 `text-align`으로 인라인블록 이미지를 좌/중/우 배치. **기본값(align=null)은 가운데 정렬**(기존 `.ProseMirror img{margin:0 auto}` 동작 보존). 5·6단계 공개 렌더 CSS는 `.notice-content img.align-left{margin-right:auto}` 등으로 대응 예정.

**의존성 판단(re-resizable)**: 설치돼 있으나 **사용 안 함**. NodeView 안에서 라이브러리가 자체 크기 state를 관리해 노드 속성(단일 진실 원천)과 동기화가 복잡·불안정. 무의존 커스텀 핸들(mousedown→document mousemove/mouseup→updateAttributes)이 더 단순·안전하여 채택.

💡 tester 참고:
- 테스트 방법: dev(포트 4000) → `/admin/settings` 소개글/이념/시설 에디터. (관리자 로그인 벽이면 빌드/코드로 확인)
- 정상 동작: (1)본문 이미지 클릭 시 주황 테두리 + 위쪽에 정렬 툴바(좌/중/우, Material Symbols) + 네 모서리 핸들 표시, (2)정렬 버튼 클릭 시 이미지가 좌/중/우로 이동(같은 버튼 재클릭 시 기본=중앙으로 토글 해제), (3)모서리 핸들 드래그로 폭 조절(오른쪽 끌면 커지고 왼쪽 핸들은 반대), (4)폭 40px 미만/본문폭 초과로는 안 커짐.
- 회귀 확인 필수: 밑줄 버튼(U)이 여전히 켜짐/꺼짐 동작(StarterKit 내장으로 전환됨). 이미지 삽입 3경로(버튼·드래그·붙여넣기)와 setImage가 그대로 동작. 설정 페이지 저장/재로드 정상.
- 주의할 입력: 기존에 정렬/폭 없이 삽입된 이미지(하위호환, 가운데 정렬로 표시돼야 함).

⚠️ reviewer 참고:
- 봐줄 부분: (1)startResize의 document mousemove/mouseup 리스너 등록·해제(누수 없는지), (2)width 가드(min 40 / max 본문폭) 및 좌측 핸들 부호 반전, (3)align 토글(같은 값 재클릭 시 null) UX, (4)NodeView props 타입(ReactNodeViewProps) 사용, (5)Underline 제거 후 밑줄 정상 동작 여부.
- 검증: `npx tsc --noEmit` EXIT=0, `npm run build` EXIT=0.
- 범위 밖(미구현): 표/유튜브(4), sanitize 확장(5), 공지 적용(6), 붙여넣기 정제(7). ★정렬/크기 마크업이 현재 sanitize.ts를 통과 못 해 설정 소개글 저장 시 잘릴 수 있음(5단계에서 해결 예정, 정상).

### 구현 기록 — 공지 리치 에디터 강화 4단계 (2026-07-06)

📝 구현한 기능: 공유 TipTap 에디터에 **표(table) 삽입/편집 + 유튜브 임베드** 추가.

**상태: 4단계 완료, 5단계(sanitize.ts 보안 확장) 대기.**

**설치 패키지 (TipTap 3.20.0 정확 일치, package.json 반영 `^3.20.0`):**
- `@tiptap/extension-table@3.20.0` — v3에서 `TableKit`(Table+TableRow+TableHeader+TableCell 전부) 한 패키지에 통합. 기획서의 서브패키지 3개(table-row/header/cell)는 v3에서 불필요 → 미설치.
- `@tiptap/extension-youtube@3.20.0`

| 파일 경로 | 변경 내용 | 신규/수정 |
|----------|----------|----------|
| package.json | @tiptap/extension-table, @tiptap/extension-youtube 추가 | 수정 |
| src/components/RichTextEditor.tsx | TableKit(resizable)·Youtube 확장 등록, 툴바 "표 삽입"(3x3 헤더행)·"유튜브" 버튼, 표 편집도구(행+/행−/열+/열−/표삭제, 표 안일 때만 노출), 유튜브 URL 입력줄(도메인검증) | 수정 |
| src/app/globals.css | .ProseMirror 표 스타일(테두리/헤더배경 color-mix, selectedCell, column-resize-handle, tableWrapper) + 유튜브 16:9 반응형(div[data-youtube-video]) | 수정 |

**구현 상세:**
- 표: `insertTable({rows:3, cols:3, withHeaderRow:true})`. `TableKit.configure({table:{resizable:true}})`로 열 너비 드래그 조절. 편집도구는 `editor.isActive('table')`일 때만 툴바에 인라인 노출(addRowAfter/deleteRow/addColumnAfter/deleteColumn/deleteTable).
- 유튜브: 툴바 버튼 → 링크와 동일한 인라인 입력줄 → `isYoutubeUrl()`(youtube.com/youtu.be만) 앱검증 후 `setYoutubeVideo({src})`. 확장 내부에서도 재검증(이중 방어). controls:true, nocookie:false, 640x360.
- 아이콘: Material Symbols Outlined(grid_on, smart_display) — 컨벤션 준수. 표편집/유튜브입력줄은 기존 링크팝업 패턴 답습.
- CSS 색상: 하드코딩 hex 없음. 테두리/헤더배경은 `color-mix(in srgb, currentColor N%, transparent)`(라이트/다크 자동), 하이라이트·리사이즈핸들은 `var(--color-brand-orange-500)`.

**★★ 5단계 sanitize.ts 대비 — 실제 생성 마크업 (확장 dist 소스 직접 확인) ★★**

▶ **표** (`editor.getHTML()` 직렬화 결과):
```html
<table style="min-width: 75px">          <!-- 열 조절 시 style="width: Npx" -->
  <colgroup>
    <col>                                 <!-- 열마다 1개. 조절하면 <col style="width: 120px"> -->
  </colgroup>
  <tbody>
    <tr>
      <th colspan="1" rowspan="1"><p>...</p></th>   <!-- 헤더행: <th> -->
    </tr>
    <tr>
      <td colspan="1" rowspan="1"><p>...</p></td>
    </tr>
  </tbody>
</table>
```
- ⚠️ **`<thead>` 미생성** — 헤더 셀도 `<tbody>` 안 첫 `<tr>`에 `<th>`로 들어감. (기획서엔 thead 언급됐으나 실제로 안 나옴)
- 태그: `table, colgroup, col, tbody, tr, th, td` (기획서엔 colgroup/col 누락 — 반드시 추가!)
- 속성: **th/td** → `colspan`, `rowspan`, `colwidth`(리사이즈 시 생기는 쉼표구분 정수, 예 `colwidth="120"` 또는 `"120,80"`); **table** → `style`(min-width/width); **col** → `style`(width:Npx).
- 5단계 sanitize 할 일: allowedTags에 `colgroup`,`col` 추가(table/tbody/tr/th/td는 sanitize-html defaults에 이미 있음). `allowedAttributes`의 td/th에 `colspan,rowspan,colwidth` 추가. `allowedStyles`에 table/col의 `width`,`min-width` 허용(px). thead는 defaults에 있으니 미생성이라도 무해.

▶ **유튜브** (`editor.getHTML()` 직렬화 결과):
```html
<div data-youtube-video="">
  <iframe width="640" height="360" allowfullscreen="true"
          src="https://www.youtube.com/embed/VIDEO_ID?..."></iframe>
</div>
```
- **src 도메인(화이트리스트 핵심)**: 항상 `https://www.youtube.com/embed/<VIDEO_ID>` 로 **정규화**됨(입력이 youtu.be/watch?v= 무엇이든). nocookie:true였다면 `https://www.youtube-nocookie.com/embed/`. 현재 설정 nocookie:false → **`www.youtube.com`만** 나옴.
- 태그: `div`(data-youtube-video 속성), `iframe`.
- iframe 속성: `src, width, height, allowfullscreen`(옵션 더 켜면 추가 가능하나 현재 이 4개).
- 5단계 sanitize 할 일: allowedTags에 `iframe` 추가; div에 `data-youtube-video` 속성 허용; iframe에 `src,width,height,allowfullscreen,frameborder,allow` 허용; **`allowedIframeHostnames: ['www.youtube.com','www.youtube-nocookie.com']`** (실제 src가 www.youtube.com/embed로 정규화되므로 youtu.be는 화이트리스트에 불필요). script/onclick/javascript: 차단은 현행 유지.

💡 tester 참고:
- 테스트: dev(포트 4000) → `/admin/settings` 소개글/이념/시설 에디터. (관리자 로그인 벽이면 build/코드로 확인)
- 정상 동작: (1)"표" 버튼(grid_on) 클릭 → 3x3 표(첫 행 헤더 굵게·배경) 삽입, (2)표 안 클릭 시 툴바에 행+/행−/열+/열−/표삭제 노출·동작, (3)열 경계 드래그로 너비 조절, (4)"유튜브" 버튼(smart_display) → 입력줄에 유튜브 URL 넣고 삽입 → 16:9 영상 임베드, (5)유튜브 아닌 URL(예 vimeo)·빈값 → "유튜브 주소만" 안내 후 거부.
- 주의할 입력: `https://youtu.be/xxx`, `https://www.youtube.com/watch?v=xxx`, `https://m.youtube.com/...`, `music.youtube.com` (모두 허용) / `https://evil.com`, `javascript:...` (거부).
- **회귀 확인 필수**: 설정 페이지 저장/재로드 정상, 기존 1~3단계 기능(툴바·이미지업로드·정렬/리사이즈) 불변.
- ⚠️ **표/유튜브는 현재 sanitize.ts 미통과** → 설정 소개글 저장 시 잘림(정상, 5단계에서 해결). 편집화면 표시·삽입 동작만 이번 검증 대상.

⚠️ reviewer 참고:
- 봐줄 부분: (1)isYoutubeUrl 정규식이 youtube 도메인만 정확히 통과시키는지(우회 여부), (2)표 편집도구 조건부 노출(isActive('table')) 리렌더 동작, (3)color-mix 색상이 하드코딩 규칙 위반 아닌지(currentColor 파생), (4)TableKit resizable 등록이 기존 확장과 충돌 없는지.
- 검증: `npx tsc --noEmit` EXIT=0, `npm run build` EXIT=0, /admin/settings ○ static 30s(회귀 없음).
- 범위 밖(미구현): sanitize 확장(5), 공지 적용(6), 붙여넣기 정제(7).

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

### 테스트 결과 — 공지 리치 에디터 3단계 검증 (2026-07-06)

| 테스트 항목 | 결과 | 비고 |
|-----------|------|------|
| tsc --noEmit | ✅ 통과 | EXIT=0 |
| npm run build | ✅ 통과 | EXIT=0 |
| /admin/settings 컴파일 | ✅ 통과 | ○ static, revalidate 30s |
| Underline 회귀(import 제거 후 밑줄 동작) | ✅ 통과 | StarterKit 3.20 내장(dist L84-85 `if(this.options.underline!==false) push(Underline)`). toggleUnderline/isActive('underline') 그대로 동작. RichTextEditor에서 Underline import/등록 완전 제거 → 중복경고 해소 |
| 2단계 3경로 호환(버튼/드래그/붙여넣기) | ✅ 통과 | ResizableImage.extend가 Image의 node name="image" + setImage 명령 상속. handlePaste/handleDrop의 `schema.nodes.image.create`, onPickImage의 `setImage` 모두 유효(tsc EXIT=0이 setImage 타입 존재 방증) |
| 리사이즈 리스너 등록/해제 | ⚠️ 조건부통과 | 정상흐름 무누수: 리스너는 mousedown 시점에만 등록, onUp(mouseup)에서 mousemove/mouseup 둘 다 removeEventListener. 다만 드래그 중(마우스 누른 채) NodeView 언마운트 시 mouseup 전까지 리스너 잔존(mouseup에 자가치유). useEffect cleanup 없음 — 극희박 케이스, 비치명 |
| width 가드(min40/max본문폭) | ✅ 통과 | MIN_WIDTH=40, max=editor.view.dom.clientWidth. Math.max/min 클램프. 좌측핸들 부호반전(sign=-1) 적용 |
| 비율 유지 / updateAttributes | ✅ 통과 | img style height:auto(비율 자동), updateAttributes({width:next}) 호출 |
| align/width 저장→재로드 왕복 | ✅ 통과 | width: parseHTML(getAttribute→parseInt)↔renderHTML({width}). align: parseHTML(data-align 우선, class fallback)↔renderHTML({class:'align-N','data-align':N}). getHTML은 renderHTML(toDOM) 사용 → img에 width/class/data-align 직렬화. 정렬 미지정 시 두 속성 모두 미출력(하위호환) |
| 정렬툴바 아이콘(Material Symbols) | ✅ 통과 | material-symbols-outlined 폰트 layout.tsx L112 전역 로드 |
| 실제 dev 렌더(클릭/드래그) | ⚠️ 미실시 | /admin/settings 관리자 로그인 벽으로 브라우저 조작 불가(비치명, 사전 보고됨). build 컴파일 성공으로 렌더 가능성 확인 |

📊 종합: 11개 중 9개 통과 / 2개 조건부·미실시(비치명) / 0개 실패

**판정: 3단계 커밋 가능.** 타입·빌드·설정페이지 컴파일 통과, Underline 회귀 없음(내장 전환 정상), 2단계 3경로 호환 유지, align/width 왕복 및 width 가드 정상. 참고: 정렬/크기 마크업(class/data-align)이 현 sanitize.ts 미통과로 저장 시 잘리는 것은 5단계 범위(정상). 리스너 언마운트 cleanup 부재는 극희박·자가치유 케이스로 비치명(개선 후보).

### 테스트 결과 — 공지 리치 에디터 4단계 검증 (표+유튜브) (2026-07-06)

| 테스트 항목 | 결과 | 비고 |
|-----------|------|------|
| tsc --noEmit | ✅ 통과 | EXIT=0 |
| npm run build | ✅ 통과 | EXIT=0, ✓ Compiled successfully |
| /admin/settings 컴파일(회귀) | ✅ 통과 | ○ static, revalidate 30s (변동 없음) |
| 패키지 설치(table/youtube @3.20.0) | ✅ 통과 | node_modules 실측 둘 다 3.20.0. v3 TableKit 1개가 table/row/header/cell 통합(서브패키지 3개 불필요 확인) |
| 유튜브 도메인 검증(보안) | ✅ 통과 | 공격벡터 15/15. evil.com·youtube.com.evil.com·youtu.be.evil.com·myyoutube.com·javascript:·vimeo·data: 전부 거부. app정규식(youtube.com/youtu.be만)+확장 isValidYoutubeUrl 이중 AND 게이트 |
| iframe src 정규화 | ✅ 통과 | 확장 getYoutubeEmbedUrl: nocookie:false→항상 `https://www.youtube.com/embed/<ID>`로 정규화(입력이 youtu.be/watch?v= 무엇이든). 임의 도메인 src 불가 |
| setYoutubeVideo 명령 존재 | ✅ 통과 | dist L176 setYoutubeVideo, L177 내부 isValidYoutubeUrl 재검증(이중 방어) |
| 표 명령어 TableKit 일치 | ✅ 통과 | insertTable/addRowAfter/deleteRow/addColumnAfter/deleteColumn/deleteTable 전부 dist 존재. TableKit export 확인 |
| 표 편집도구 조건부 노출 | ✅ 통과 | node name="table" 확인 → `editor.isActive('table')` 유효. 표 안일 때만 행+/행−/열+/열−/표삭제 렌더(useEditor 선택변경 리렌더 표준 패턴) |
| 1~3단계 회귀(확장 등록 순서/충돌) | ✅ 통과 | StarterKit/TextStyle/FontSize/Color/TextAlign/ResizableImage/TableKit/Youtube 순 충돌 없음. StarterKit에 table/youtube 미포함 |
| 밑줄(Underline) 회귀 | ✅ 통과 | StarterKit 3.20 내장 유지, 별도 import 없음. toggleUnderline 동작 |
| 이미지 3경로 회귀 | ✅ 통과 | ResizableImage=Image.extend라 name='image' 유지 → 버튼/드래그/붙여넣기 setImage·schema.nodes.image 그대로. tsc EXIT=0 |
| CSS 하드코딩 색상(표/유튜브 블록) | ✅ 통과 | globals.css 252~320 블록: color-mix(currentColor)·var(--color-brand-orange-500)만. 하드코딩 hex 없음(7~40행 hex는 CSS변수 정의 자체) |
| 설정 페이지 인터페이스 불변 | ✅ 통과 | RichTextEditor props(value/onChange/name/placeholder/uploadFolder) 변동 없음 |
| 실제 dev 렌더(클릭/삽입) | ⚠️ 미실시 | /admin/settings 관리자 로그인 벽(비치명, 사전 합의됨). build 컴파일 성공으로 렌더 가능성 확인. dev서버 미기동(정리 불필요) |

📊 종합: 15개 중 14개 통과 / 1개 미실시(로그인 벽, 비치명) / 0개 실패

**판정: 4단계 커밋 가능.** 타입·빌드·설정페이지 컴파일 통과, 유튜브 도메인 화이트리스트가 공격벡터 15/15 차단 + src를 www.youtube.com/embed로 강제 정규화(보안 견고), 표 명령어 TableKit 일치, 1~3단계 회귀 없음. 참고: 표/유튜브 마크업이 현 sanitize.ts 미통과로 설정 소개글 저장 시 잘리는 것은 **5단계 범위(정상)** — 이번 검증은 편집화면 삽입/동작 대상.

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

## 리뷰 결과 (reviewer) — 공지 리치 에디터 3단계 (이미지 정렬/크기조절) (2026-07-06)

📊 **종합 판정: 통과 (커밋 OK)** — 치명 이슈 없음. 리스너 누수 없음(자기정리 보장). 속성 왕복·크기가드·기존경로 호환 양호.

🔦 **리스너 누수 여부 (최우선) — 누수 없음**:
- `startResize`가 document에 `mousemove`/`mouseup` 등록, `onUp`이 **둘 다** removeEventListener. `mouseup`은 document 전역이라 마우스를 이미지 밖·에디터 밖·창 안 어디서 놓아도 반드시 발화 → 정상 종료 경로에서 리스너 확실히 제거.
- 리스너 중복 등록: 1 mousedown → 1쌍만 등록, onUp이 자기 클로저를 제거하므로 세션 간 누적 없음(좀비 핸들러 자기치유).
- 유일한 이론적 틈: **드래그 도중 NodeView/에디터 언마운트**. useEffect cleanup이 없어 mouseup 전까지 핸들러 잔존하나, document mouseup이 뒤이어 발화하면 즉시 정리됨. 그 사이 onMove의 updateAttributes는 삭제된 노드에 대해 TipTap이 no-op 처리(throw 안 함) → 무해·자기치유. 지속 누수 아님.
- → 커밋 차단 사유 아님. 방어적 강화(useEffect cleanup)는 권장 수준.

✅ 잘된 점:
- **크기 가드 견고**: MIN_WIDTH 40 + max=`editor.view.dom.clientWidth`로 clamp(`Math.max/min`), 좌측핸들(nw/sw) sign 반전 정확, height:auto+maxWidth:100%로 비율유지·컨테이너 넘침 방지 3중.
- **속성 왕복 안전**: width parseHTML(parseInt)↔renderHTML(값 있을 때만 width), align은 data-align 우선+class fallback 이중 파싱. 기본(null)이면 두 속성 모두 미출력 → 기존 이미지 하위호환 유지.
- **불량값 자기치유**: width가 0/NaN이면 renderHTML·NodeView 모두 falsy로 처리해 미적용(자연폭). 드래그론 음수 생성 불가(clamp). 손편집 음수만 무해하게 무시됨.
- **기존 3경로 호환**: Image 확장이라 name='image' 유지 → `schema.nodes.image.create`(드롭·붙여넣기)·`setImage`(툴바) 그대로 동작. width/align default=null이라 삽입 마크업 불변.
- **Underline 제거 정상**: StarterKit 3.20 내장으로 toggleUnderline/isActive('underline') 유지, 밑줄 회귀 없음(tester 확인).
- Material Symbols 아이콘(정렬 툴바), 정렬 버튼 title 제공, 브랜드색 CSS변수(var(--color-brand-orange-500)) 사용.

🔴 필수 수정: 없음

🟡 권장 수정:
- [ResizableImage.tsx:45~72] 리사이즈 리스너에 **useEffect cleanup(또는 Pointer Events + setPointerCapture)** 방어 추가 — 언마운트-도중-드래그 시 확실 정리. 현재도 mouseup 자기정리로 실무상 안전하나, 방어적 견고성 향상.
- [ResizableImage.tsx:58 onMove] onMove에서 `ev.preventDefault()` 미호출 → 드래그 중 브라우저 텍스트/이미지 네이티브 선택이 겹쳐 UX 지터 가능. preventDefault로 매끈해짐.

🔵 사소 (선택, 커밋 무관):
- [ResizableImage.tsx:89] 핸들 `border: '2px solid #fff'` 하드코딩(대비용 흰 테두리, 불가피 성격). rgba 효과색(그림자/눌림)도 마찬가지 — CSS변수 대체 불필요.
- 리사이즈 핸들(span)에 title/aria-label 없음 — 정렬 버튼과 달리 접근성 라벨 부재. `role/aria-label="크기 조절"` 고려.
- 핸들은 onMouseDown만 → 터치기기 리사이즈 미지원(admin 데스크톱 위주라 허용 범위).
- [handle의 maxWidth=clientWidth] 드래그 중 창 리사이즈 시 max 값이 시작시점 고정(무시 가능).

📌 범위 밖(정상): 정렬/크기 마크업의 sanitize 미통과는 5단계 사안. 표/유튜브(4)·공지적용(6)·붙여넣기정제(7) 이후 단계.

## 리뷰 결과 (reviewer) — 공지 리치 에디터 4단계 (표+유튜브) (2026-07-06)

📊 **종합 판정: 통과 (커밋 OK)** — 치명 이슈 없음. 유튜브 도메인 검증 **우회 불가**(3중 방어), 1~3단계 회귀 없음, 표 편집도구 안전.

🔐 **유튜브 도메인 검증 (최우선) — 우회 불가 결론**:
- **앱 검증(isYoutubeUrl)**: `/^(?:https?:\/\/)?(?:(?:www|m|music)\.)?(?:youtube\.com|youtu\.be)\/.+/i` — `^` 앵커 + 호스트 직후 `/` 강제라 서브도메인 사칭·userinfo 트릭 모두 차단.
  - `evil-youtube.com` → `youtube.com`이 문자열 시작에서 안 맞음 → **거부** ✅
  - `youtube.com.evil.com/` → `youtube.com` 뒤가 `.`(슬래시 아님) → **거부** ✅
  - `youtube.com@evil.com/` → `youtube.com` 뒤 `@` → **거부** ✅ (실제 host=evil.com인 userinfo 트릭 방어)
  - `javascript:youtube.com/x`, `data:...youtube.com/` → 시작이 `j`/`d` → **거부** ✅
- **확장 정규화(2차 방어)**: extension-youtube 3.20 `getEmbedUrlFromYoutubeUrl`가 자체 YOUTUBE_REGEX(host=youtube.com/youtu.be/youtube-nocookie.com로 앵커)로 재검증 후 **항상 `https://www.youtube.com/embed/<ID>`로 정규화**. `/embed/` 포함 URL을 원본 반환하는 분기도 그 앞의 host 앵커 정규식을 통과해야만 도달 → 임의 도메인 iframe src 생성 경로 없음. 검증 실패 시 null 반환 → 삽입 안 됨(거부).
- **sanitize allowedIframeHostnames(3차, 5단계)**: 최종 렌더 방어선. 위 2중을 뚫어도 여기서 차단.
- → **입력→정규화→sanitize 3중 방어 모두 youtube host로 수렴. 우회 경로 발견 못 함.**

✅ 잘된 점:
- 표/유튜브 확장 등록 이름 충돌 없음(table/tableRow/tableCell/tableHeader, youtube, image 각기 고유). tsc/build EXIT=0로 확장 조합 정상.
- 표 편집도구가 `editor.isActive('table')` 조건부 렌더 → 표 밖에서는 버튼 자체가 안 보여 no-op 걱정 없음. insertTable은 어디서든 안전 실행.
- 유튜브 입력줄이 링크 팝업과 동일 패턴(일관성), 빈값/`https://`만 입력 시 조기 종료 가드.
- CSS: 하드코딩 hex 0개. 테두리/헤더배경 `color-mix(in srgb, currentColor N%, transparent)`(라이트/다크 자동 적응 — color-mix 사용 적정), 하이라이트/리사이즈핸들 `var(--color-brand-orange-500)`. 유튜브 16:9 `aspect-ratio` 반응형 + tableWrapper `overflow-x:auto`(가로 스크롤 격리) 양호.
- 표/유튜브 신규 버튼 아이콘 Material Symbols(grid_on, smart_display) — conventions 준수.

🔴 필수 수정: 없음

🟡 권장 수정: 없음 (치명·기능결함 없음)

🔵 사소 (선택, 커밋 무관):
- [RichTextEditor.tsx:236 applyYoutube] 앱 검증은 통과하나 확장이 video ID를 못 뽑는 URL(예 `youtube.com/channel/UCxxx`, `list=` 없는 재생목록 URL)은 확장이 null 반환 → **조용히 미삽입**(팝업만 닫힘, 안내 없음). 드물지만 사용자가 "왜 안 들어가지" 혼란 가능. `setYoutubeVideo().run()` 반환값(false) 확인해 실패 시 alert 하면 개선. 보안·기능결함 아님.
- [452~456 표편집 버튼, 260 iconBtn 등] `hover:bg-gray-200`에 `dark:` variant 부재 → 다크모드 미세 부조화. 기존 툴바 패턴 답습이라 이번 신규만의 문제 아님(전체 후속 통일 후보).
- 표편집 텍스트 버튼(행+/행−/열+/열−/표삭제)은 Material Symbols 아닌 텍스트 라벨 — admin 내부 소형 컨트롤이라 허용 범위. 접근성 title은 제공됨.

📌 범위 밖(정상): 표/유튜브 마크업의 sanitize 통과는 5단계(colgroup/col·iframe·allowedIframeHostnames 추가). 현재 설정페이지 저장 시 잘리는 것은 예정된 동작. 공지 적용(6)·붙여넣기 정제(7) 후속.

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
| 2026-07-06 | 공지 리치에디터 4단계 리뷰 — 유튜브검증 우회불가(앱앵커+확장정규화+sanitize 3중방어), 표편집 조건부노출 안전, 확장이름 무충돌, color-mix/CSS변수 준수. 치명0·권장0·사소2 | 리뷰통과(커밋OK) |
| 2026-07-06 | 공지 리치에디터 4단계 테스트 — tsc/build EXIT=0, /admin/settings 회귀無, 유튜브 도메인검증 공격벡터 15/15 차단+src www.youtube.com/embed 정규화, 표 명령어 TableKit 일치, 1~3단계 회귀無. 14/15통과·0실패 | 테스트통과(커밋OK) |
| 2026-07-06 | 공지 리치에디터 4단계 구현 — 표(TableKit resizable 3x3+행/열편집)+유튜브임베드(도메인검증). extension-table/youtube@3.20.0 설치, tsc/build EXIT=0. 5단계 마크업(colgroup/col·thead없음·iframe src정규화) 기록 | 구현완료(tester대기) |
| 2026-07-06 | 공지 리치에디터 3단계 테스트 — tsc/build EXIT=0, Underline회귀無, 2단계 3경로 호환, align/width 왕복·가드 정상, 9/11통과·0실패 | 테스트통과(커밋OK) |
| 2026-07-06 | 공지 리치에디터 3단계 리뷰 — 리스너누수 없음(자기정리 보장), 크기가드/속성왕복/기존경로 양호, 치명0·권장2(cleanup·preventDefault) | 리뷰통과(커밋OK) |
| 2026-07-06 | 공지 리치에디터 3단계 구현 — 이미지 정렬(좌/중/우)+드래그 크기조절 커스텀 ResizableImage NodeView, Underline중복제거, 무설치, tsc/build EXIT=0 | 구현완료(tester대기) |
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
