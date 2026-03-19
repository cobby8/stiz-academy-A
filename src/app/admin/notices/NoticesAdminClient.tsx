"use client";

import { useState, useTransition } from "react";
import { createNotice, updateNotice, deleteNotice } from "@/app/actions/admin";
import { Plus, Trash2, Edit2, Pin, X, Upload, Paperclip, Bell } from "lucide-react";

type Attachment = { url: string; filename: string; size: number };
type NoticeData = {
    id: string;
    title: string;
    content: string;
    targetType: string;
    targetClassIds: string | null;
    attachmentsJSON: string | null;
    isPinned: boolean;
    createdAt: Date | string;
};
type ClassInfo = { id: string; name: string; program?: { name: string } | null };

export default function NoticesAdminClient({ notices, classes }: { notices: NoticeData[]; classes: ClassInfo[] }) {
    const [isPending, startTransition] = useTransition();
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [formTitle, setFormTitle] = useState("");
    const [content, setContent] = useState("");
    const [targetType, setTargetType] = useState("ALL");
    const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
    const [isPinned, setIsPinned] = useState(false);
    const [attachments, setAttachments] = useState<Attachment[]>([]);
    const [uploading, setUploading] = useState(false);

    function resetForm() {
        setEditId(null);
        setFormTitle("");
        setContent("");
        setTargetType("ALL");
        setSelectedClassIds([]);
        setIsPinned(false);
        setAttachments([]);
        setShowForm(false);
    }

    function startEdit(n: NoticeData) {
        setEditId(n.id);
        setFormTitle(n.title);
        setContent(n.content);
        setTargetType(n.targetType);
        setSelectedClassIds(n.targetClassIds ? n.targetClassIds.split(",").map(s => s.trim()) : []);
        setIsPinned(n.isPinned);
        try { setAttachments(n.attachmentsJSON ? JSON.parse(n.attachmentsJSON) : []); } catch { setAttachments([]); }
        setShowForm(true);
    }

    async function handleFileUpload(files: FileList | null) {
        if (!files || files.length === 0) return;
        setUploading(true);
        for (const file of Array.from(files)) {
            const fd = new FormData();
            fd.append("file", file);
            fd.append("folder", "notices");
            try {
                const res = await fetch("/api/upload", { method: "POST", body: fd });
                const data = await res.json();
                if (data.url) {
                    setAttachments(prev => [...prev, { url: data.url, filename: file.name, size: file.size }]);
                }
            } catch (e) { console.error("Upload failed:", e); }
        }
        setUploading(false);
    }

    function toggleClassId(id: string) {
        setSelectedClassIds(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
    }

    function handleSubmit() {
        if (!formTitle.trim()) { alert("제목을 입력해주세요."); return; }
        if (!content.trim()) { alert("내용을 입력해주세요."); return; }
        if (targetType === "CLASS" && selectedClassIds.length === 0) { alert("대상 반을 선택해주세요."); return; }
        const payload = {
            title: formTitle,
            content,
            targetType,
            targetClassIds: targetType === "CLASS" ? selectedClassIds.join(",") : null,
            attachmentsJSON: attachments.length > 0 ? JSON.stringify(attachments) : null,
            isPinned,
        };
        startTransition(async () => {
            if (editId) {
                await updateNotice(editId, payload);
            } else {
                await createNotice(payload);
            }
            resetForm();
        });
    }

    function handleDelete(id: string) {
        if (!confirm("이 공지사항을 삭제하시겠습니까?")) return;
        startTransition(async () => { await deleteNotice(id); });
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">공지사항 관리</h1>
                    <p className="text-sm text-gray-500 mt-1">전체 공지 또는 반별 공지를 작성하세요</p>
                </div>
                <button onClick={() => { resetForm(); setShowForm(true); }}
                    className="flex items-center gap-2 bg-brand-orange-500 text-white px-4 py-2.5 rounded-xl font-bold hover:bg-orange-600 transition">
                    <Plus size={18} /> 새 공지
                </button>
            </div>

            {/* Form Modal */}
            {showForm && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={resetForm}>
                    <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                            <h2 className="text-lg font-bold">{editId ? "공지 수정" : "새 공지"}</h2>
                            <button onClick={resetForm} className="p-1 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">제목</label>
                                <input value={formTitle} onChange={e => setFormTitle(e.target.value)}
                                    placeholder="공지 제목을 입력하세요"
                                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">내용</label>
                                <textarea value={content} onChange={e => setContent(e.target.value)}
                                    rows={6} placeholder="공지 내용을 입력하세요"
                                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">공지 대상</label>
                                <div className="flex gap-3 mb-2">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="radio" checked={targetType === "ALL"} onChange={() => setTargetType("ALL")} />
                                        <span className="text-sm">전체 공지</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="radio" checked={targetType === "CLASS"} onChange={() => setTargetType("CLASS")} />
                                        <span className="text-sm">반별 공지</span>
                                    </label>
                                </div>
                                {targetType === "CLASS" && (
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {classes.map(c => (
                                            <button key={c.id}
                                                onClick={() => toggleClassId(c.id)}
                                                className={`text-xs px-3 py-1.5 rounded-full border transition ${
                                                    selectedClassIds.includes(c.id)
                                                        ? "bg-brand-orange-500 text-white border-brand-orange-500"
                                                        : "bg-white text-gray-600 border-gray-200 hover:border-brand-orange-300"
                                                }`}>
                                                {c.name}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">첨부파일</label>
                                <label className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-brand-orange-500 cursor-pointer transition">
                                    <Paperclip size={16} /> {uploading ? "업로드 중..." : "파일 첨부"}
                                    <input type="file" className="hidden" multiple onChange={e => handleFileUpload(e.target.files)} disabled={uploading} />
                                </label>
                                {attachments.length > 0 && (
                                    <div className="mt-2 space-y-1">
                                        {attachments.map((a, i) => (
                                            <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                                                <span className="text-xs text-gray-600 truncate">{a.filename}</span>
                                                <button onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))}
                                                    className="text-gray-400 hover:text-red-500">
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                <input type="checkbox" id="isPinned" checked={isPinned} onChange={e => setIsPinned(e.target.checked)} className="rounded" />
                                <label htmlFor="isPinned" className="text-sm text-gray-700">상단 고정</label>
                            </div>
                        </div>
                        <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
                            <button onClick={resetForm} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl transition">취소</button>
                            <button onClick={handleSubmit} disabled={isPending || uploading}
                                className="px-6 py-2 bg-brand-orange-500 text-white font-bold rounded-xl hover:bg-orange-600 transition disabled:opacity-50">
                                {isPending ? "저장 중..." : editId ? "수정" : "등록"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Notices List */}
            {notices.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-400">
                    <Bell className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p className="font-medium">아직 공지사항이 없습니다</p>
                    <p className="text-sm mt-1">&quot;새 공지&quot; 버튼으로 공지를 작성하세요</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {notices.map(n => {
                        let atts: Attachment[] = [];
                        try { atts = n.attachmentsJSON ? JSON.parse(n.attachmentsJSON) : []; } catch {}
                        return (
                            <div key={n.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            {n.isPinned && <Pin size={14} className="text-brand-orange-500 flex-shrink-0" />}
                                            <h3 className="font-bold text-gray-900 truncate">{n.title}</h3>
                                        </div>
                                        <p className="text-sm text-gray-500 line-clamp-2 mb-2">{n.content}</p>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                                                n.targetType === "ALL" ? "bg-blue-50 text-blue-600" : "bg-purple-50 text-purple-600"
                                            }`}>
                                                {n.targetType === "ALL" ? "전체 공지" : "반별 공지"}
                                            </span>
                                            {atts.length > 0 && (
                                                <span className="text-xs text-gray-400 flex items-center gap-1">
                                                    <Paperclip size={12} /> {atts.length}개 파일
                                                </span>
                                            )}
                                            <span className="text-xs text-gray-400">
                                                {new Date(n.createdAt).toLocaleDateString("ko-KR")}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex gap-1 flex-shrink-0">
                                        <button onClick={() => startEdit(n)}
                                            className="p-2 text-gray-400 hover:text-brand-orange-500 hover:bg-orange-50 rounded-lg transition">
                                            <Edit2 size={16} />
                                        </button>
                                        <button onClick={() => handleDelete(n.id)}
                                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
