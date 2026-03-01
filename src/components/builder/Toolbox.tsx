"use client";
import React from "react";
import { useEditor } from "@craftjs/core";
import { ContainerNode, TextNode, ImageNode, ProgramsWidget, ScheduleWidget, CoachesWidget, HeaderFooterWidget } from "./nodes";
import { Type, Square, Image as ImageIcon, LayoutGrid, Calendar, Users, LayoutTemplate } from "lucide-react";

export const Toolbox = () => {
    const { connectors, query } = useEditor();

    return (
        <div className="p-4 bg-white border-r border-gray-200 h-full overflow-y-auto">
            <h3 className="font-bold text-gray-800 mb-4 pb-2 border-b">추가 요소</h3>
            <div className="grid grid-cols-2 gap-2">
                <button
                    ref={(ref) => { if (ref) connectors.create(ref, <ContainerNode padding={20} />); }}
                    className="flex flex-col items-center justify-center p-3 border border-gray-200 rounded hover:bg-gray-100 hover:border-brand-orange-500 cursor-move transition bg-gray-50"
                    title="기본 박스"
                >
                    <Square className="w-6 h-6 mb-1 text-gray-500" />
                    <span className="text-xs font-semibold">컨테이너</span>
                </button>

                <button
                    ref={(ref) => { if (ref) connectors.create(ref, <TextNode text="텍스트를 입력하세요" fontSize={16} color="#000000" textAlign="left" fontWeight={400} />); }}
                    className="flex flex-col items-center justify-center p-3 border border-gray-200 rounded hover:bg-gray-100 hover:border-brand-orange-500 cursor-move transition bg-gray-50"
                    title="글자 입력"
                >
                    <Type className="w-6 h-6 mb-1 text-gray-500" />
                    <span className="text-xs font-semibold">텍스트</span>
                </button>

                <button
                    ref={(ref) => { if (ref) connectors.create(ref, <ImageNode src="" width={100} borderRadius={8} />); }}
                    className="flex flex-col items-center justify-center p-3 border border-gray-200 rounded hover:bg-gray-100 hover:border-brand-orange-500 cursor-move transition bg-gray-50"
                    title="사진 업로드"
                >
                    <ImageIcon className="w-6 h-6 mb-1 text-gray-500" />
                    <span className="text-xs font-semibold">이미지</span>
                </button>
            </div>

            <h3 className="font-bold text-gray-800 mt-8 mb-4 pb-2 border-b">특수 위젯 렌더러</h3>
            <div className="grid grid-cols-2 gap-2">
                <button
                    ref={(ref) => { if (ref) connectors.create(ref, <ProgramsWidget />); }}
                    className="flex flex-col items-center justify-center p-3 border border-orange-200 rounded hover:bg-orange-50 hover:border-brand-orange-500 cursor-move transition bg-orange-50/50"
                >
                    <LayoutGrid className="w-6 h-6 mb-1 text-brand-orange-500" />
                    <span className="text-[10px] font-bold text-brand-orange-700">프로그램 목록</span>
                </button>

                <button
                    ref={(ref) => { if (ref) connectors.create(ref, <ScheduleWidget />); }}
                    className="flex flex-col items-center justify-center p-3 border border-blue-200 rounded hover:bg-blue-50 hover:border-brand-navy-900 cursor-move transition bg-blue-50/50"
                >
                    <Calendar className="w-6 h-6 mb-1 text-brand-navy-900" />
                    <span className="text-[10px] font-bold text-brand-navy-900">클래스 시간표</span>
                </button>

                <button
                    ref={(ref) => { if (ref) connectors.create(ref, <CoachesWidget />); }}
                    className="flex flex-col items-center justify-center p-3 border border-emerald-200 rounded hover:bg-emerald-50 hover:border-emerald-600 cursor-move transition bg-emerald-50/50"
                >
                    <Users className="w-6 h-6 mb-1 text-emerald-600" />
                    <span className="text-[10px] font-bold text-emerald-700">강사진 목록</span>
                </button>

                <button
                    ref={(ref) => { if (ref) connectors.create(ref, <HeaderFooterWidget />); }}
                    className="flex flex-col items-center justify-center p-3 border border-purple-200 rounded hover:bg-purple-50 hover:border-purple-600 cursor-move transition bg-purple-50/50"
                >
                    <LayoutTemplate className="w-6 h-6 mb-1 text-purple-600" />
                    <span className="text-[10px] font-bold text-purple-700">헤더/푸터</span>
                </button>
            </div>
        </div>
    );
};
