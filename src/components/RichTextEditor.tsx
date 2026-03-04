"use client";

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Color } from '@tiptap/extension-color'
import { TextStyle } from '@tiptap/extension-text-style'
import { Underline } from '@tiptap/extension-underline'
import { TextAlign } from '@tiptap/extension-text-align'
import { useEffect, useRef } from 'react'

export default function RichTextEditor({
    value,
    onChange,
    name,
    placeholder,
}: {
    value: string;
    onChange?: (val: string) => void;
    name?: string;
    placeholder?: string;
}) {
    // 마지막으로 에디터가 직접 emit한 HTML 추적 (외부 value 변경과 구분)
    const lastEmittedHTML = useRef<string>("");

    const editor = useEditor({
        extensions: [
            StarterKit,
            TextStyle,
            Color,
            Underline,
            TextAlign.configure({ types: ['heading', 'paragraph'] }),
        ],
        content: value,
        immediatelyRender: false,
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

    if (!editor) {
        return (
            <div className="border border-gray-300 rounded-md p-4 min-h-[150px] bg-gray-50 flex items-center justify-center text-sm text-gray-400">
                에디터 로딩중...
            </div>
        );
    }

    return (
        <div className="border border-gray-300 rounded-md overflow-hidden bg-white focus-within:ring-2 focus-within:ring-brand-orange-500 focus-within:border-brand-orange-500 transition">
            {name && <input type="hidden" name={name} value={editor.getHTML()} />}

            {/* 툴바 */}
            <div className="flex flex-wrap items-center gap-1 p-2 border-b border-gray-200 bg-gray-50 text-gray-700">
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

                <div className="w-px h-5 bg-gray-300 mx-0.5" />

                {/* 정렬 */}
                <button
                    type="button"
                    onClick={() => editor.chain().focus().setTextAlign('left').run()}
                    className={`p-1.5 rounded hover:bg-gray-200 ${editor.isActive({ textAlign: 'left' }) ? 'bg-gray-200' : ''}`}
                    title="왼쪽 정렬"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h10M4 18h16" />
                    </svg>
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().setTextAlign('center').run()}
                    className={`p-1.5 rounded hover:bg-gray-200 ${editor.isActive({ textAlign: 'center' }) ? 'bg-gray-200' : ''}`}
                    title="가운데 정렬"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M7 12h10M4 18h16" />
                    </svg>
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().setTextAlign('right').run()}
                    className={`p-1.5 rounded hover:bg-gray-200 ${editor.isActive({ textAlign: 'right' }) ? 'bg-gray-200' : ''}`}
                    title="오른쪽 정렬"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M10 12h10M4 18h16" />
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
                    className="px-1.5 h-5 text-[10px] rounded border border-gray-300 text-gray-500 hover:bg-gray-100"
                    title="색상 제거"
                >
                    색제거
                </button>
            </div>

            {/* 에디터 본문 */}
            <div className="p-3 min-h-[150px] max-h-[400px] overflow-y-auto relative">
                <EditorContent editor={editor} />
                {editor.isEmpty && placeholder && (
                    <div className="absolute top-3 left-4 text-gray-400 pointer-events-none text-sm whitespace-pre-line">
                        {placeholder}
                    </div>
                )}
            </div>
        </div>
    );
}
