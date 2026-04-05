"use client";
import React from "react";
import { useEditor } from "@craftjs/core";
import { Trash2, ArrowUpCircle } from "lucide-react";

export const SettingsPanel = () => {
    const { actions, selected, isEnabled } = useEditor((state, query) => {
        const currentNodeId = query.getEvent('selected').first();
        let selected;

        if (currentNodeId) {
            selected = {
                id: currentNodeId,
                name: state.nodes[currentNodeId].data.name,
                settings: state.nodes[currentNodeId].related && state.nodes[currentNodeId].related.settings,
                isDeletable: query.node(currentNodeId).isDeletable(),
            };
        }

        return {
            selected,
            isEnabled: state.options.enabled,
        };
    });

    if (!isEnabled) {
        return <div className="p-4 text-gray-400 text-sm text-center mt-10">미리보기 모드입니다.</div>;
    }

    return (
        <div className="p-4 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 h-full overflow-y-auto">
            <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-4 pb-2 border-b">디자인 설정</h3>
            {selected ? (
                <div className="flex flex-col gap-6">
                    <div className="flex justify-between items-center bg-gray-50 dark:bg-gray-900 px-3 py-2 rounded border border-gray-200 dark:border-gray-700">
                        <span className="text-sm font-bold text-brand-orange-500 dark:text-brand-neon-lime">{selected.name}</span>
                        <div className="flex gap-2">
                            <button
                                className="text-gray-400 hover:text-gray-900 dark:text-white"
                                onClick={() => {
                                    actions.selectNode(selected.id);
                                }}
                                title="요소 재선택"
                            >
                                <ArrowUpCircle className="w-4 h-4" />
                            </button>
                            {selected.isDeletable && (
                                <button
                                    className="text-red-400 hover:text-red-600"
                                    onClick={() => {
                                        actions.delete(selected.id);
                                    }}
                                    title="블록 삭제"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </div>

                    <div data-cy="settings-panel">
                        {selected.settings && React.createElement(selected.settings)}
                    </div>
                </div>
            ) : (
                <div className="text-gray-400 text-sm text-center mt-10 flex flex-col items-center">
                    <span>캔버스에서 요소를</span>
                    <span>클릭하면 상세 설정이 나타납니다.</span>
                </div>
            )}
        </div>
    );
};
