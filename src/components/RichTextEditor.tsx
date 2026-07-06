"use client";

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Color } from '@tiptap/extension-color'
import { TextStyle } from '@tiptap/extension-text-style'
import { TextAlign } from '@tiptap/extension-text-align'
import { ResizableImage } from '@/components/extensions/ResizableImage'
import { FontSize } from '@/components/extensions/FontSize'
// 표: TableKit 하나로 표/행/헤더/셀 4개 확장을 한 번에 묶어 등록한다 (v3에서 통합됨)
import { TableKit } from '@tiptap/extension-table'
// 유튜브: URL을 넣으면 <iframe> 임베드로 바꿔주는 확장
import { Youtube } from '@tiptap/extension-youtube'
import { useEffect, useRef, useState } from 'react'

// 업로드 사전 검증 기준 — 서버(/api/upload)와 동일하게 맞춰 잘못된 파일을 미리 거른다.
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

// 글자 크기 드롭다운 선택지 — "기본"은 fontSize를 제거(원래 크기)한다는 의미
const FONT_SIZES = ['기본', '12px', '14px', '16px', '18px', '20px', '24px', '30px'];

// ── 외부(워드/한글/웹) 붙여넣기 HTML 정제 ──
// 왜? 워드나 웹페이지에서 복사하면 인라인 style, 클래스, 메타 태그, 빈 태그,
// 워드 조건부 주석 등 지저분한 잔재가 잔뜩 딸려온다. 이를 걷어내 "깔끔한 편집 경험"을 만든다.
// (보안 최종 방어는 렌더 시 sanitizeHtml이 한 번 더 하므로, 여기선 편집 편의가 목적)
// ⚠️ DOMParser는 브라우저 전용 API — 이 컴포넌트가 "use client"라 안전하게 쓸 수 있다.
//    jsdom/isomorphic-dompurify는 서버 500 이력이 있어 절대 도입하지 않는다.

// 붙여넣기 후에도 "남길" 인라인 style 속성 — 에디터가 실제로 지원하는 서식만.
// (굵게=font-weight, 기울임=font-style, 밑줄=text-decoration, 색상=color, 정렬=text-align)
const KEEP_STYLE_PROPS = new Set([
    'color', 'text-align', 'font-weight', 'font-style', 'text-decoration', 'text-decoration-line',
]);

// 붙여넣기 후에도 "남길" 요소 속성 — 그 외(class, id, lang, on* 등)는 전부 제거.
// data-pm-slice는 에디터 내부 복사-붙여넣기의 구조 정보라 유지(내부 붙여넣기 정확도 보존).
const KEEP_ATTRS = new Set([
    'href', 'src', 'alt', 'title', 'colspan', 'rowspan', 'colwidth',
    'width', 'height', 'data-align', 'data-youtube-video', 'data-pm-slice',
]);

// 요소의 껍데기만 벗기고 자식(내용)을 부모로 끌어올린다. (예: <o:p>텍스트</o:p> → 텍스트)
function unwrapElement(el: Element) {
    const parent = el.parentNode;
    if (!parent) return;
    while (el.firstChild) parent.insertBefore(el.firstChild, el);
    parent.removeChild(el);
}

// 붙여넣은 HTML 문자열을 받아 정제된 HTML 문자열을 돌려준다.
function cleanPastedHtml(html: string): string {
    // 브라우저가 아니거나 DOMParser가 없으면(만약의 SSR 경로) 원본 그대로 반환
    if (typeof window === 'undefined' || typeof DOMParser === 'undefined') return html;
    try {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const body = doc.body;
        if (!body) return html;

        // 1) 통째로 제거: 스타일/스크립트/메타/링크/제목 (내용까지 삭제)
        body.querySelectorAll('style, script, meta, link, title').forEach(el => el.remove());

        // 2) 주석 노드 제거 — 워드 조건부 주석 <!--[if gte mso 9]> ... <![endif]--> 포함
        const walker = doc.createTreeWalker(body, NodeFilter.SHOW_COMMENT);
        const comments: Comment[] = [];
        while (walker.nextNode()) comments.push(walker.currentNode as Comment);
        comments.forEach(c => c.parentNode?.removeChild(c));

        // 3) 모든 요소 순회하며 정리 (정적 스냅샷 후 처리 — 순회 중 DOM을 바꿔도 안전)
        const els = Array.from(body.querySelectorAll('*'));
        for (const el of els) {
            const tag = el.tagName.toLowerCase();

            // 3-1) 워드 네임스페이스 태그(o:p, w:*, v:* 등 콜론 포함)는 껍데기만 벗겨 텍스트 보존
            if (tag.includes(':')) { unwrapElement(el); continue; }

            // 3-2) 속성 정리 — 화이트리스트 밖은 전부 제거, style은 지원 속성만 재구성
            for (const attr of Array.from(el.attributes)) {
                const name = attr.name.toLowerCase();
                if (name === 'style') continue; // style은 아래에서 별도 처리
                if (!KEEP_ATTRS.has(name)) el.removeAttribute(attr.name);
            }
            const style = el.getAttribute('style');
            if (style) {
                // "color:red; mso-x:y; margin:0" → 지원 속성만 남기고 mso-* 제거
                const kept = style.split(';')
                    .map(s => s.trim())
                    .filter(Boolean)
                    .filter(decl => {
                        const prop = decl.split(':')[0].trim().toLowerCase();
                        return KEEP_STYLE_PROPS.has(prop) && !/mso-/i.test(decl);
                    });
                if (kept.length) el.setAttribute('style', kept.join('; '));
                else el.removeAttribute('style');
            }
        }

        // 4) 속성이 하나도 없는 빈 <span>은 껍데기 제거(워드가 만드는 중첩 span 정리) — 텍스트 보존
        Array.from(body.querySelectorAll('span')).forEach(span => {
            if (span.attributes.length === 0) unwrapElement(span);
        });

        return body.innerHTML;
    } catch {
        // 어떤 이유로든 정제가 실패해도 붙여넣기 자체가 막히지 않도록 원본 반환
        return html;
    }
}

export default function RichTextEditor({
    value,
    onChange,
    name,
    placeholder,
    uploadFolder = "editor", // 업로드된 이미지를 저장할 Storage 폴더명 (공지에서는 "notices"를 넘길 수 있음)
    onUploadingChange, // 본문 이미지 업로드 진행 상태를 부모에게 알림 (제출 버튼 잠금용)
}: {
    value: string;
    onChange?: (val: string) => void;
    name?: string;
    placeholder?: string;
    uploadFolder?: string;
    onUploadingChange?: (uploading: boolean) => void;
}) {
    // 마지막으로 에디터가 직접 emit한 HTML 추적 (외부 value 변경과 구분)
    const lastEmittedHTML = useRef<string>("");
    // 툴바 이미지 버튼이 여는 숨은 파일 선택창 참조
    const fileInputRef = useRef<HTMLInputElement>(null);
    // 이미지 업로드 진행 중 여부 (에디터 위에 로딩 오버레이 표시용)
    const [uploading, setUploading] = useState(false);
    // 링크 입력 팝업 열림 상태 + 입력 중인 URL 값
    const [linkPopupOpen, setLinkPopupOpen] = useState(false);
    const [linkUrl, setLinkUrl] = useState("");
    // 유튜브 입력 팝업 열림 상태 + 입력 중인 URL 값 (링크 팝업과 같은 패턴)
    const [ytPopupOpen, setYtPopupOpen] = useState(false);
    const [ytUrl, setYtUrl] = useState("");

    // ── 이미지 파일 1개를 서버에 업로드하고 최종 URL을 돌려준다. 실패 시 null ──
    // 왜 함수로 분리? 툴바 버튼/드래그&드롭/붙여넣기 3경로가 같은 업로드 로직을 공유하기 때문.
    async function uploadImageFile(file: File): Promise<string | null> {
        // 1) 타입/크기 사전 검증 — 서버까지 안 가고 즉시 안내
        if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
            alert('이미지 파일만 넣을 수 있어요 (JPG, PNG, WebP, GIF)');
            return null;
        }
        if (file.size > MAX_IMAGE_SIZE) {
            alert('이미지 용량은 5MB 이하만 가능해요');
            return null;
        }
        // 2) 기존 /api/upload 재사용 — FormData에 file + folder를 담아 전송
        const fd = new FormData();
        fd.append('file', file);
        fd.append('folder', uploadFolder);
        setUploading(true); // 로딩 표시 시작
        try {
            const res = await fetch('/api/upload', { method: 'POST', body: fd });
            const data = await res.json();
            if (!res.ok || !data.url) {
                alert(data.error || '이미지 업로드에 실패했어요');
                return null;
            }
            return data.url as string;
        } catch {
            alert('이미지 업로드 중 오류가 발생했어요');
            return null;
        } finally {
            setUploading(false); // 성공/실패 상관없이 로딩 종료
        }
    }

    const editor = useEditor({
        extensions: [
            // StarterKit에 내장된 Link를 새 탭·안전 속성으로 구성 (별도 패키지 불필요)
            StarterKit.configure({
                link: {
                    openOnClick: false, // 편집 중 클릭으로 링크 열리지 않게
                    autolink: true, // 붙여넣은 URL을 자동 링크화
                    protocols: ['http', 'https', 'mailto'], // 허용 스킴 제한 (javascript: 등 차단)
                    HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
                },
            }),
            TextStyle,
            FontSize, // 글자 크기 확장 (TextStyle 기반) — 이제 툴바에 연결됨
            Color,
            // Underline은 StarterKit 3.20에 내장되어 있어 별도 등록을 제거함(중복 방지).
            // 밑줄 버튼(toggleUnderline / isActive('underline'))은 그대로 동작한다.
            TextAlign.configure({ types: ['heading', 'paragraph'] }),
            // 본문 이미지 노드 — 좌/중/우 정렬 + 드래그 크기조절을 지원하는 커스텀 확장.
            // 삽입/드롭/붙여넣기(setImage, schema.nodes.image)는 그대로 유지됨.
            ResizableImage.configure({ inline: false }),
            // 표 — resizable:true 로 열 너비를 드래그로 조절할 수 있게 한다.
            // TableKit 하나가 table/tableRow/tableHeader/tableCell 노드를 모두 등록한다.
            TableKit.configure({
                table: { resizable: true },
            }),
            // 유튜브 임베드 — 16:9 반응형은 globals.css(div[data-youtube-video])에서 처리.
            // width/height 는 iframe 기본값이며 CSS가 컨테이너 비율로 덮어쓴다.
            Youtube.configure({
                controls: true,   // 재생 컨트롤 표시
                nocookie: false,  // 표준 youtube.com/embed 도메인 사용 (5단계 sanitize 화이트리스트 대상)
                width: 640,
                height: 360,      // 16:9 기본 비율
            }),
        ],
        content: value,
        immediatelyRender: false,
        // ProseMirror 레벨에서 드래그&드롭 / 붙여넣기 이미지를 가로채 업로드 처리
        editorProps: {
            // ── 외부 붙여넣기 HTML 정제 ──
            // 이미지 파일 붙여넣기는 아래 handlePaste가 먼저 처리(true 반환)하므로 이 경로로 안 온다.
            // 여기는 워드/한글/웹의 "HTML 텍스트" 붙여넣기만 통과 → cleanPastedHtml로 잔재 제거.
            transformPastedHTML(html) {
                return cleanPastedHtml(html);
            },
            // ── 경로 3: 클립보드 이미지 붙여넣기(Ctrl+V) ──
            handlePaste(view, event) {
                const items = event.clipboardData?.items;
                if (!items) return false;
                // 클립보드 항목 중 이미지 파일을 찾는다
                const imageItem = Array.from(items).find(i => i.type.startsWith('image/'));
                const file = imageItem?.getAsFile();
                if (!file) return false; // 이미지가 아니면 기본 붙여넣기(텍스트 등)에 맡김
                event.preventDefault();
                uploadImageFile(file).then(url => {
                    if (!url) return;
                    // 업로드 완료 후 현재 커서 위치에 이미지 삽입
                    const { schema } = view.state;
                    const node = schema.nodes.image.create({ src: url });
                    view.dispatch(view.state.tr.insert(view.state.selection.from, node));
                });
                return true; // 우리가 처리했으므로 기본 동작 중단
            },
            // ── 경로 2: 파일 드래그&드롭 ──
            handleDrop(view, event, _slice, moved) {
                if (moved) return false; // 에디터 내부 요소 이동(드래그)은 기본 동작 유지
                const files = event.dataTransfer?.files;
                const file = files && Array.from(files).find(f => f.type.startsWith('image/'));
                if (!file) return false; // 이미지 파일이 아니면 기본 처리
                event.preventDefault();
                // 마우스를 놓은 위치를 문서 좌표로 변환 (없으면 현재 커서)
                const coords = view.posAtCoords({ left: (event as DragEvent).clientX, top: (event as DragEvent).clientY });
                const pos = coords ? coords.pos : view.state.selection.from;
                uploadImageFile(file).then(url => {
                    if (!url) return;
                    const { schema } = view.state;
                    const node = schema.nodes.image.create({ src: url });
                    view.dispatch(view.state.tr.insert(pos, node));
                });
                return true;
            },
        },
        onUpdate: ({ editor }) => {
            const html = editor.getHTML();
            lastEmittedHTML.current = html;
            onChange?.(html);
        },
    });

    // 외부에서 value가 변경될 때만(초기 로드 등) 에디터 내용 업데이트
    // 사용자 편집으로 생긴 value 변경(= lastEmittedHTML과 동일)은 무시
    useEffect(() => {
        if (!editor || editor.isFocused) return;
        if (lastEmittedHTML.current && value === lastEmittedHTML.current) return;
        const editorHTML = editor.getHTML();
        if (value !== editorHTML) {
            editor.commands.setContent(value || "", { emitUpdate: false });
            lastEmittedHTML.current = editor.getHTML();
        }
    }, [editor, value]);

    // 본문 이미지 업로드 진행 상태를 부모(공지 폼 등)에 전달 — 업로드 중 제출을 막기 위함
    useEffect(() => {
        onUploadingChange?.(uploading);
    }, [uploading, onUploadingChange]);

    // ── 경로 1: 툴바 이미지 버튼 → 파일 선택창에서 고른 파일 업로드 후 삽입 ──
    async function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        e.target.value = ''; // 같은 파일 재선택 가능하도록 초기화
        if (!file || !editor) return;
        const url = await uploadImageFile(file);
        if (url) editor.chain().focus().setImage({ src: url }).run();
    }

    // ── 링크 팝업 열기: 선택 영역에 이미 링크가 있으면 그 URL을 미리 채운다 ──
    function openLinkPopup() {
        if (!editor) return;
        const prev = editor.getAttributes('link').href as string | undefined;
        setLinkUrl(prev || 'https://');
        setLinkPopupOpen(true);
    }

    // ── 링크 적용: http/https/mailto만 허용, 스킴 없으면 https:// 자동 부여 ──
    function applyLink() {
        if (!editor) return;
        let url = linkUrl.trim();
        if (!url) { setLinkPopupOpen(false); return; }
        // mailto가 아니고 스킴이 없으면 https:// 를 붙여준다 (예: "naver.com" → "https://naver.com")
        if (!/^mailto:/i.test(url) && !/^https?:\/\//i.test(url)) {
            url = 'https://' + url;
        }
        // 허용 스킴 검증 — 그 외(javascript: 등)는 차단
        const safe = /^mailto:/i.test(url) || /^https?:\/\//i.test(url);
        if (!safe) {
            alert('http, https, mailto 주소만 넣을 수 있어요');
            return;
        }
        editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
        setLinkPopupOpen(false);
    }

    // ── 링크 제거 ──
    function removeLink() {
        editor?.chain().focus().extendMarkRange('link').unsetLink().run();
        setLinkPopupOpen(false);
    }

    // ── 표 삽입: 헤더행 포함 기본 3x3 ──
    function insertTable() {
        editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
    }

    // ── 유튜브 URL 검증: youtube.com / youtu.be 도메인만 허용 (그 외 임의 iframe 차단) ──
    // 왜? 유튜브 외 임의 URL을 iframe으로 넣으면 보안 위험(XSS/피싱). 도메인을 화이트리스트로 좁힌다.
    function isYoutubeUrl(url: string): boolean {
        return /^(?:https?:\/\/)?(?:(?:www|m|music)\.)?(?:youtube\.com|youtu\.be)\/.+/i.test(url.trim());
    }

    // ── 유튜브 팝업 열기 ──
    function openYtPopup() {
        setYtUrl('https://');
        setYtPopupOpen(true);
    }

    // ── 유튜브 삽입: 도메인 검증 통과 시에만 임베드 ──
    function applyYoutube() {
        if (!editor) return;
        const url = ytUrl.trim();
        if (!url || url === 'https://') { setYtPopupOpen(false); return; }
        if (!isYoutubeUrl(url)) {
            alert('유튜브 주소만 넣을 수 있어요 (youtube.com 또는 youtu.be)');
            return;
        }
        // setYoutubeVideo 는 확장 내부에서도 유효성 검사를 한 번 더 한다(이중 방어).
        editor.chain().focus().setYoutubeVideo({ src: url }).run();
        setYtPopupOpen(false);
        setYtUrl('');
    }

    if (!editor) {
        return (
            <div className="border border-gray-300 rounded-md p-4 min-h-[150px] bg-gray-50 dark:bg-gray-900 flex items-center justify-center text-sm text-gray-400">
                에디터 로딩중...
            </div>
        );
    }

    // 새 아이콘 버튼 공통 클래스 (기존 정렬 버튼과 동일 스타일)
    const iconBtn = (active: boolean) =>
        `p-1.5 rounded hover:bg-gray-200 ${active ? 'bg-gray-200' : ''}`;

    return (
        <div className="border border-gray-300 rounded-md overflow-hidden bg-white dark:bg-gray-800 focus-within:ring-2 focus-within:ring-brand-orange-500 dark:focus:ring-brand-neon-lime focus-within:border-brand-orange-500 dark:border-brand-neon-lime transition">
            {name && <input type="hidden" name={name} value={editor.getHTML()} />}

            {/* 숨은 파일 선택창 — 툴바 이미지 버튼이 클릭을 위임 */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={onPickImage}
            />

            {/* 툴바 */}
            <div className="flex flex-wrap items-center gap-1 p-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-200">
                {/* 텍스트 스타일 */}
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    className={`w-7 h-7 flex items-center justify-center rounded text-sm hover:bg-gray-200 ${editor.isActive('bold') ? 'bg-gray-200 font-bold text-black' : ''}`}
                    title="굵게 (Ctrl+B)"
                >
                    <b>B</b>
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    className={`w-7 h-7 flex items-center justify-center rounded text-sm hover:bg-gray-200 ${editor.isActive('italic') ? 'bg-gray-200 text-black' : ''}`}
                    title="기울임 (Ctrl+I)"
                >
                    <i>I</i>
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleUnderline().run()}
                    className={`w-7 h-7 flex items-center justify-center rounded text-sm hover:bg-gray-200 ${editor.isActive('underline') ? 'bg-gray-200 text-black' : ''}`}
                    title="밑줄 (Ctrl+U)"
                >
                    <u>U</u>
                </button>

                {/* 글자 크기 드롭다운 (FontSize 확장 연결) */}
                <select
                    value={(editor.getAttributes('textStyle').fontSize as string) || '기본'}
                    onChange={e => {
                        const v = e.target.value;
                        // "기본" 선택 시 크기 지정 해제, 그 외에는 해당 px 적용
                        if (v === '기본') editor.chain().focus().unsetFontSize().run();
                        else editor.chain().focus().setFontSize(v).run();
                    }}
                    className="h-7 px-1 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200"
                    title="글자 크기"
                >
                    {FONT_SIZES.map(s => (
                        <option key={s} value={s}>{s === '기본' ? '크기' : s}</option>
                    ))}
                </select>

                <div className="w-px h-5 bg-gray-300 mx-0.5" />

                {/* 정렬 */}
                <button
                    type="button"
                    onClick={() => editor.chain().focus().setTextAlign('left').run()}
                    className={iconBtn(editor.isActive({ textAlign: 'left' }))}
                    title="왼쪽 정렬"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h10M4 18h16" />
                    </svg>
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().setTextAlign('center').run()}
                    className={iconBtn(editor.isActive({ textAlign: 'center' }))}
                    title="가운데 정렬"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M7 12h10M4 18h16" />
                    </svg>
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().setTextAlign('right').run()}
                    className={iconBtn(editor.isActive({ textAlign: 'right' }))}
                    title="오른쪽 정렬"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M10 12h10M4 18h16" />
                    </svg>
                </button>

                <div className="w-px h-5 bg-gray-300 mx-0.5" />

                {/* 목록 / 인용 / 구분선 (StarterKit 내장) */}
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                    className={iconBtn(editor.isActive('bulletList'))}
                    title="글머리표 목록"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <circle cx="4" cy="6" r="1.4" fill="currentColor" stroke="none" />
                        <circle cx="4" cy="12" r="1.4" fill="currentColor" stroke="none" />
                        <circle cx="4" cy="18" r="1.4" fill="currentColor" stroke="none" />
                        <path strokeLinecap="round" strokeWidth={2} d="M9 6h11M9 12h11M9 18h11" />
                    </svg>
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                    className={iconBtn(editor.isActive('orderedList'))}
                    title="순서 목록"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <text x="1" y="8" fontSize="7" fill="currentColor" stroke="none">1</text>
                        <text x="1" y="15" fontSize="7" fill="currentColor" stroke="none">2</text>
                        <text x="1" y="22" fontSize="7" fill="currentColor" stroke="none">3</text>
                        <path strokeLinecap="round" strokeWidth={2} d="M9 6h11M9 12h11M9 18h11" />
                    </svg>
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleBlockquote().run()}
                    className={iconBtn(editor.isActive('blockquote'))}
                    title="인용구"
                >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" stroke="none">
                        <path d="M7 7H4v6h3v-2H6V9h1V7zm7 0h-3v6h3v-2h-1V9h1V7z" />
                    </svg>
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().setHorizontalRule().run()}
                    className={iconBtn(false)}
                    title="가로 구분선"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeWidth={2} d="M4 12h16" />
                    </svg>
                </button>

                <div className="w-px h-5 bg-gray-300 mx-0.5" />

                {/* 링크 / 이미지 */}
                <button
                    type="button"
                    onClick={openLinkPopup}
                    className={iconBtn(editor.isActive('link'))}
                    title="링크 삽입"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 010 5.656l-3 3a4 4 0 01-5.656-5.656l1.5-1.5M10.172 13.828a4 4 0 010-5.656l3-3a4 4 0 015.656 5.656l-1.5 1.5" />
                    </svg>
                </button>
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className={iconBtn(false)}
                    title="이미지 삽입 (드래그·붙여넣기도 가능)"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                </button>

                <div className="w-px h-5 bg-gray-300 mx-0.5" />

                {/* 표 / 유튜브 (Material Symbols 아이콘) */}
                <button
                    type="button"
                    onClick={insertTable}
                    className={iconBtn(editor.isActive('table'))}
                    title="표 삽입 (3x3)"
                >
                    <span className="material-symbols-outlined text-[18px] leading-none">grid_on</span>
                </button>
                <button
                    type="button"
                    onClick={openYtPopup}
                    className={iconBtn(false)}
                    title="유튜브 영상 삽입"
                >
                    <span className="material-symbols-outlined text-[18px] leading-none">smart_display</span>
                </button>

                {/* 표 편집 도구 — 커서가 표 안에 있을 때만 노출 */}
                {editor.isActive('table') && (
                    <>
                        <div className="w-px h-5 bg-gray-300 mx-0.5" />
                        <button type="button" onClick={() => editor.chain().focus().addRowAfter().run()} className="px-1.5 h-6 text-[11px] rounded hover:bg-gray-200" title="아래에 행 추가">행+</button>
                        <button type="button" onClick={() => editor.chain().focus().deleteRow().run()} className="px-1.5 h-6 text-[11px] rounded hover:bg-gray-200" title="현재 행 삭제">행−</button>
                        <button type="button" onClick={() => editor.chain().focus().addColumnAfter().run()} className="px-1.5 h-6 text-[11px] rounded hover:bg-gray-200" title="오른쪽에 열 추가">열+</button>
                        <button type="button" onClick={() => editor.chain().focus().deleteColumn().run()} className="px-1.5 h-6 text-[11px] rounded hover:bg-gray-200" title="현재 열 삭제">열−</button>
                        <button type="button" onClick={() => editor.chain().focus().deleteTable().run()} className="px-1.5 h-6 text-[11px] rounded hover:bg-gray-200" title="표 전체 삭제">표삭제</button>
                    </>
                )}

                <div className="w-px h-5 bg-gray-300 mx-0.5" />

                {/* 색상 */}
                <input
                    type="color"
                    onInput={e => editor.chain().focus().setColor((e.target as HTMLInputElement).value).run()}
                    value={editor.getAttributes('textStyle').color || '#000000'}
                    className="w-6 h-6 p-0 border border-gray-300 overflow-hidden cursor-pointer rounded"
                    title="글자 색상 선택"
                />
                <button
                    type="button"
                    onClick={() => editor.chain().focus().setColor('#f97316').run()}
                    className="w-5 h-5 rounded-full bg-orange-500 border border-orange-600 shadow-sm"
                    title="오렌지"
                />
                <button
                    type="button"
                    onClick={() => editor.chain().focus().setColor('#1e3a8a').run()}
                    className="w-5 h-5 rounded-full bg-blue-900 border border-blue-950 shadow-sm"
                    title="네이비"
                />
                <button
                    type="button"
                    onClick={() => editor.chain().focus().unsetColor().run()}
                    className="px-1.5 h-5 text-[10px] rounded border border-gray-300 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:bg-gray-800"
                    title="색상 제거"
                >
                    색제거
                </button>
            </div>

            {/* 링크 입력 팝업 — 툴바 아래 한 줄로 노출 */}
            {linkPopupOpen && (
                <div className="flex flex-wrap items-center gap-2 p-2 border-b border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-900">
                    <input
                        type="text"
                        value={linkUrl}
                        onChange={e => setLinkUrl(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); applyLink(); } }}
                        placeholder="https://example.com"
                        autoFocus
                        className="flex-1 min-w-[180px] h-8 px-2 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200"
                    />
                    <button type="button" onClick={applyLink} className="h-8 px-3 text-sm rounded bg-brand-orange-500 text-white hover:bg-brand-orange-600">적용</button>
                    <button type="button" onClick={removeLink} className="h-8 px-3 text-sm rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700">링크 제거</button>
                    <button type="button" onClick={() => setLinkPopupOpen(false)} className="h-8 px-3 text-sm rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700">취소</button>
                </div>
            )}

            {/* 유튜브 입력 팝업 — 링크 팝업과 동일한 한 줄 패턴 */}
            {ytPopupOpen && (
                <div className="flex flex-wrap items-center gap-2 p-2 border-b border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-900">
                    <input
                        type="text"
                        value={ytUrl}
                        onChange={e => setYtUrl(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); applyYoutube(); } }}
                        placeholder="https://youtu.be/... 또는 https://www.youtube.com/watch?v=..."
                        autoFocus
                        className="flex-1 min-w-[180px] h-8 px-2 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200"
                    />
                    <button type="button" onClick={applyYoutube} className="h-8 px-3 text-sm rounded bg-brand-orange-500 text-white hover:bg-brand-orange-600">삽입</button>
                    <button type="button" onClick={() => setYtPopupOpen(false)} className="h-8 px-3 text-sm rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700">취소</button>
                </div>
            )}

            {/* 에디터 본문 */}
            <div className="p-3 min-h-[150px] max-h-[400px] overflow-y-auto relative">
                <EditorContent editor={editor} />
                {editor.isEmpty && placeholder && (
                    <div className="absolute top-3 left-4 text-gray-400 pointer-events-none text-sm whitespace-pre-line">
                        {placeholder}
                    </div>
                )}
                {/* 업로드 중 로딩 오버레이 */}
                {uploading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/70 dark:bg-gray-800/70 text-sm text-gray-600 dark:text-gray-200 z-10">
                        <span className="inline-flex items-center gap-2">
                            <span className="w-4 h-4 border-2 border-gray-300 border-t-brand-orange-500 rounded-full animate-spin" />
                            이미지 업로드 중...
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}
