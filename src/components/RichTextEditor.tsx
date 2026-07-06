"use client";

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Color } from '@tiptap/extension-color'
import { TextStyle } from '@tiptap/extension-text-style'
import { TextAlign } from '@tiptap/extension-text-align'
import { ResizableImage } from '@/components/extensions/ResizableImage'
import { FontSize } from '@/components/extensions/FontSize'
import { useEffect, useRef, useState } from 'react'

// 업로드 사전 검증 기준 — 서버(/api/upload)와 동일하게 맞춰 잘못된 파일을 미리 거른다.
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

// 글자 크기 드롭다운 선택지 — "기본"은 fontSize를 제거(원래 크기)한다는 의미
const FONT_SIZES = ['기본', '12px', '14px', '16px', '18px', '20px', '24px', '30px'];

export default function RichTextEditor({
    value,
    onChange,
    name,
    placeholder,
    uploadFolder = "editor", // 업로드된 이미지를 저장할 Storage 폴더명 (공지에서는 "notices"를 넘길 수 있음)
}: {
    value: string;
    onChange?: (val: string) => void;
    name?: string;
    placeholder?: string;
    uploadFolder?: string;
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
        ],
        content: value,
        immediatelyRender: false,
        // ProseMirror 레벨에서 드래그&드롭 / 붙여넣기 이미지를 가로채 업로드 처리
        editorProps: {
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
