"use client";

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Color } from '@tiptap/extension-color'
import { TextStyle } from '@tiptap/extension-text-style'
import { Underline } from '@tiptap/extension-underline'
import { TextAlign } from '@tiptap/extension-text-align'
import Image from '@tiptap/extension-image'
import Dropcursor from '@tiptap/extension-dropcursor'
import { FontSize } from './extensions/FontSize'
import { useEffect, useRef } from 'react'
import { ImageIcon } from 'lucide-react'

export default function RichTextEditor({ value, onChange, name, placeholder }: { value: string, onChange?: (val: string) => void, name?: string, placeholder?: string }) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    // 마지막으로 에디터가 직접 emit한 HTML을 추적 (외부 value 변경과 구분하기 위해)
    const lastEmittedHTML = useRef<string>("");

    const editor = useEditor({
        extensions: [
            StarterKit,
            TextStyle,
            Color,
            Underline,
            TextAlign.configure({ types: ['heading', 'paragraph'] }),
            Image.configure({
                inline: true,
                allowBase64: true,
            }),
            Dropcursor,
            FontSize,
        ],
        content: value,
        immediatelyRender: false,
        onUpdate: ({ editor }) => {
            const html = editor.getHTML();
            lastEmittedHTML.current = html;
            onChange?.(html);
        },
        editorProps: {
            handleDrop: (view, event, slice, moved) => {
                if (!moved && event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0]) {
                    const file = event.dataTransfer.files[0];
                    if (file.type.startsWith('image/')) {
                        handleImageUpload(file);
                        return true;
                    }
                }
                return false;
            },
        },
    });

    const handleImageUpload = async (file: File) => {
        if (!file.type.startsWith('image/')) {
            alert('이미지 파일만 업로드 가능합니다.');
            return;
        }

        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
            });
            const data = await res.json();

            if (data.url && editor) {
                editor.chain().focus().setImage({ src: data.url }).run();
            } else {
                alert('업로드 실패: ' + (data.error || '알 수 없는 오류'));
            }
        } catch (e) {
            console.error(e);
            alert('이미지 업로드 중 오류가 발생했습니다.');
        }
    };

    // 외부 value가 변경됐을 때만 에디터 내용을 업데이트.
    // 사용자가 직접 편집해서 생긴 value 변경(= lastEmittedHTML과 동일)은 무시.
    useEffect(() => {
        if (!editor || editor.isFocused) return;
        // 내가 방금 emit한 HTML과 같으면 → 사용자 편집 결과 → 무시
        if (lastEmittedHTML.current && value === lastEmittedHTML.current) return;
        // 외부 변경(초기 로드 포함): 에디터 내용이 다를 때만 setContent
        const editorHTML = editor.getHTML();
        if (value !== editorHTML) {
            editor.commands.setContent(value || "", false);
            // 정규화된 HTML을 lastEmittedHTML에 기록해 다음 비교에 사용
            lastEmittedHTML.current = editor.getHTML();
        }
    }, [editor, value]);

    if (!editor) {
        return <div className="border border-gray-300 rounded-md p-4 min-h-[150px] bg-gray-50 flex items-center justify-center text-sm text-gray-400">에디터 로딩중...</div>;
    }

    return (
        <div className="border border-gray-300 rounded-md overflow-hidden bg-white focus-within:ring-2 focus-within:ring-brand-orange-500 focus-within:border-brand-orange-500 transition">
            {name && <input type="hidden" name={name} value={editor.getHTML()} />}

            <div className="flex flex-wrap items-center gap-1.5 p-2 border-b border-gray-200 bg-gray-50 text-gray-700">
                <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={`w-7 h-7 flex items-center justify-center rounded hover:bg-gray-200 ${editor.isActive('bold') ? 'bg-gray-200 font-bold text-black' : ''}`}><b>B</b></button>
                <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={`w-7 h-7 flex items-center justify-center rounded hover:bg-gray-200 ${editor.isActive('italic') ? 'bg-gray-200 text-black font-serif italic' : ''}`}><i>I</i></button>
                <button type="button" onClick={() => editor.chain().focus().toggleUnderline().run()} className={`w-7 h-7 flex items-center justify-center rounded hover:bg-gray-200 ${editor.isActive('underline') ? 'bg-gray-200 text-black underline' : ''}`}><u>U</u></button>
                <div className="w-px h-5 bg-gray-300 mx-1"></div>

                <select
                    onChange={(e) => {
                        if (e.target.value === '') {
                            editor.chain().focus().unsetFontSize().run();
                        } else {
                            editor.chain().focus().setFontSize(e.target.value).run();
                        }
                    }}
                    value={editor.getAttributes('textStyle').fontSize || ''}
                    className="border border-gray-300 rounded px-1 h-7 text-xs bg-white text-gray-700 hover:bg-gray-50 cursor-pointer"
                >
                    <option value="">크기</option>
                    <option value="12px">12px</option>
                    <option value="14px">14px</option>
                    <option value="16px">16px</option>
                    <option value="18px">18px</option>
                    <option value="20px">20px</option>
                    <option value="24px">24px</option>
                    <option value="30px">30px</option>
                    <option value="36px">36px</option>
                </select>

                <div className="w-px h-5 bg-gray-300 mx-1"></div>

                <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={`px-2 h-7 text-xs font-bold rounded hover:bg-gray-200 ${editor.isActive('heading', { level: 1 }) ? 'bg-gray-200 text-black' : ''}`}>H1</button>
                <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={`px-2 h-7 text-xs font-bold rounded hover:bg-gray-200 ${editor.isActive('heading', { level: 2 }) ? 'bg-gray-200 text-black' : ''}`}>H2</button>
                <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={`px-2 h-7 text-xs font-bold rounded hover:bg-gray-200 ${editor.isActive('heading', { level: 3 }) ? 'bg-gray-200 text-black' : ''}`}>H3</button>
                <button type="button" onClick={() => editor.chain().focus().setParagraph().run()} className={`px-2 h-7 text-xs font-bold rounded hover:bg-gray-200 ${editor.isActive('paragraph') ? 'bg-gray-200 text-black' : ''}`}>P</button>

                <div className="w-px h-5 bg-gray-300 mx-1"></div>

                <button type="button" onClick={() => editor.chain().focus().setTextAlign('left').run()} className={`p-1.5 rounded hover:bg-gray-200 ${editor.isActive({ textAlign: 'left' }) ? 'bg-gray-200' : ''}`} title="왼쪽 정렬">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h10M4 18h16" /></svg>
                </button>
                <button type="button" onClick={() => editor.chain().focus().setTextAlign('center').run()} className={`p-1.5 rounded hover:bg-gray-200 ${editor.isActive({ textAlign: 'center' }) ? 'bg-gray-200' : ''}`} title="가운데 정렬">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M7 12h10M4 18h16" /></svg>
                </button>
                <button type="button" onClick={() => editor.chain().focus().setTextAlign('right').run()} className={`p-1.5 rounded hover:bg-gray-200 ${editor.isActive({ textAlign: 'right' }) ? 'bg-gray-200' : ''}`} title="오른쪽 정렬">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M10 12h10M4 18h16" /></svg>
                </button>

                <div className="w-px h-5 bg-gray-300 mx-1"></div>

                <input
                    type="color"
                    onInput={event => editor.chain().focus().setColor((event.target as HTMLInputElement).value).run()}
                    value={editor.getAttributes('textStyle').color || '#000000'}
                    className="w-6 h-6 p-0 border border-gray-300 overflow-hidden cursor-pointer rounded"
                    title="글자 색상"
                />
                <button type="button" onClick={() => editor.chain().focus().setColor('#f97316').run()} className="w-5 h-5 rounded-full bg-brand-orange-500 shadow-sm ml-1 border border-orange-600" title="오렌지"></button>
                <button type="button" onClick={() => editor.chain().focus().setColor('#1e3a8a').run()} className="w-5 h-5 rounded-full bg-brand-navy-900 shadow-sm ml-1 border border-blue-900" title="네이비"></button>

                <div className="w-px h-5 bg-gray-300 mx-1"></div>

                <input
                    type="file"
                    accept="image/*"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                            handleImageUpload(e.target.files[0]);
                        }
                    }}
                />
                <button type="button" onClick={() => fileInputRef.current?.click()} className="p-1 px-2 h-7 text-xs font-bold rounded hover:bg-gray-200 flex items-center gap-1 border border-gray-300 bg-white" title="이미지 삽입 (또는 드래그 앤 드롭)">
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>사진 추가</span>
                </button>
            </div>

            <div className="p-3 min-h-[120px] max-h-[400px] overflow-y-auto prose prose-sm max-w-none focus:outline-none focus:ring-0 tiptap-editor-content">
                <EditorContent editor={editor} />
                {editor.isEmpty && placeholder && (
                    <div className="absolute top-[88px] left-4 text-gray-400 pointer-events-none text-sm">
                        {placeholder}
                    </div>
                )}
            </div>
        </div>
    )
}
