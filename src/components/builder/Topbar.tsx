"use client";
import React, { useEffect } from 'react';
import { useEditor } from '@craftjs/core';
import { updateAcademySettings } from '@/app/actions/admin';
import { Save, Eye, Edit3, Undo, Redo } from 'lucide-react';
import lz from "lzutf8";

export const Topbar = ({
    initialDataStr,
    deviceWidth,
    setDeviceWidth
}: {
    initialDataStr?: string;
    deviceWidth: "mobile" | "pc";
    setDeviceWidth: (w: "mobile" | "pc") => void;
}) => {
    const { actions, query, enabled, canUndo, canRedo } = useEditor((state, query) => ({
        enabled: state.options.enabled,
        canUndo: query.history.canUndo(),
        canRedo: query.history.canRedo(),
    }));

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // 입력 중일 때는 실행 취소 방지
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
                return;
            }

            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                if (e.shiftKey) {
                    if (canRedo) actions.history.redo();
                } else {
                    if (canUndo) actions.history.undo();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [actions.history, canUndo, canRedo]);

    const saveDesign = async () => {
        try {
            const json = query.serialize();
            // Compress JSON to save db space
            const compressed = lz.encodeBase64(lz.compress(json));
            await updateAcademySettings({ pageDesignJSON: compressed });
            alert("성공적으로 저장 및 배포되었습니다!");
        } catch (e) {
            console.error(e);
            alert("저장에 실패했습니다.");
        }
    };

    return (
        <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-4">
                <h2 className="font-extrabold text-gray-900 dark:text-white">학원 홈페이지 캔버스 빌더</h2>
                <div className="flex bg-gray-100 dark:bg-gray-800 rounded p-1">
                    <button
                        className={`px-3 py-1.5 text-xs font-bold rounded flex items-center gap-1 ${enabled ? 'bg-white dark:bg-gray-800 shadow text-brand-orange-600 dark:text-brand-neon-lime' : 'text-gray-500 dark:text-gray-400'}`}
                        onClick={() => actions.setOptions((options) => (options.enabled = true))}
                    >
                        <Edit3 className="w-3.5 h-3.5" /> 편집 모드
                    </button>
                    <button
                        className={`px-3 py-1.5 text-xs font-bold rounded flex items-center gap-1 ${!enabled ? 'bg-white dark:bg-gray-800 shadow text-brand-navy-900' : 'text-gray-500 dark:text-gray-400'}`}
                        onClick={() => {
                            actions.selectNode("");
                            actions.setOptions((options) => (options.enabled = false));
                        }}
                    >
                        <Eye className="w-3.5 h-3.5" /> 미리보기
                    </button>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <button
                    disabled={!canUndo}
                    onClick={() => actions.history.undo()}
                    className="p-2 text-gray-500 hover:text-gray-900 dark:text-white hover:bg-gray-100 dark:bg-gray-800 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                    title="실행 취소"
                >
                    <Undo className="w-4 h-4" />
                </button>
                <button
                    disabled={!canRedo}
                    onClick={() => actions.history.redo()}
                    className="p-2 text-gray-500 hover:text-gray-900 dark:text-white hover:bg-gray-100 dark:bg-gray-800 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                    title="재실행"
                >
                    <Redo className="w-4 h-4" />
                </button>
                <div className="w-px h-6 bg-gray-200 mx-2"></div>
                <div className="flex bg-gray-100 dark:bg-gray-800 rounded p-1 mr-2">
                    <button
                        className={`px-3 py-1.5 text-xs font-bold rounded flex items-center gap-1 ${deviceWidth === 'mobile' ? 'bg-white dark:bg-gray-800 shadow text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}
                        onClick={() => setDeviceWidth("mobile")}
                        title="모바일 뷰"
                    >
                        모바일
                    </button>
                    <button
                        className={`px-3 py-1.5 text-xs font-bold rounded flex items-center gap-1 ${deviceWidth === 'pc' ? 'bg-white dark:bg-gray-800 shadow text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}
                        onClick={() => setDeviceWidth("pc")}
                        title="PC 뷰 (100% 폭)"
                    >
                        PC
                    </button>
                </div>
                <button
                    onClick={saveDesign}
                    className="bg-brand-orange-500 dark:bg-brand-neon-lime dark:text-brand-navy-900 text-white px-5 py-2 rounded text-sm font-bold shadow hover:bg-brand-orange-600 dark:hover:bg-lime-400 transition flex items-center gap-2"
                >
                    <Save className="w-4 h-4" /> 홈페이지에 즉시 배포
                </button>
            </div>
        </div>
    );
};
