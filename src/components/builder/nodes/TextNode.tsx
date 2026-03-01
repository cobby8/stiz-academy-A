"use client";
import React, { useState, useEffect } from "react";
import { useNode } from "@craftjs/core";
import ContentEditable from "react-contenteditable";

export const TextSettings = () => {
    const { actions: { setProp }, fontSize, color, textAlign, fontWeight } = useNode((node) => ({
        fontSize: node.data.props.fontSize,
        color: node.data.props.color,
        textAlign: node.data.props.textAlign,
        fontWeight: node.data.props.fontWeight,
    }));

    return (
        <div className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">글자 크기 ({fontSize}px)</label>
                <input
                    type="range" min="10" max="100"
                    value={fontSize || 16}
                    onChange={(e) => setProp((props: any) => props.fontSize = parseInt(e.target.value))}
                    className="w-full"
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">글자 굵기 ({fontWeight})</label>
                <input
                    type="range" min="100" max="900" step="100"
                    value={fontWeight || 400}
                    onChange={(e) => setProp((props: any) => props.fontWeight = parseInt(e.target.value))}
                    className="w-full"
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">글자 색상</label>
                <input
                    type="color"
                    value={color || "#000000"}
                    onChange={(e) => setProp((props: any) => props.color = e.target.value)}
                    className="w-full h-10 border border-gray-300 rounded cursor-pointer"
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">정렬</label>
                <div className="flex gap-2">
                    <button type="button" onClick={() => setProp((props: any) => props.textAlign = "left")} className={`flex-1 py-1 text-sm border ${textAlign === 'left' ? 'bg-gray-200' : ''}`}>좌</button>
                    <button type="button" onClick={() => setProp((props: any) => props.textAlign = "center")} className={`flex-1 py-1 text-sm border ${textAlign === 'center' ? 'bg-gray-200' : ''}`}>중앙</button>
                    <button type="button" onClick={() => setProp((props: any) => props.textAlign = "right")} className={`flex-1 py-1 text-sm border ${textAlign === 'right' ? 'bg-gray-200' : ''}`}>우</button>
                </div>
            </div>
        </div>
    );
};

export const TextNode = ({ text, fontSize, color, textAlign, fontWeight }: { text: string, fontSize: number, color: string, textAlign: any, fontWeight: number }) => {
    const { connectors: { connect, drag }, selected, actions: { setProp } } = useNode((node) => ({
        selected: node.events.selected,
    }));

    const [editable, setEditable] = useState(false);

    useEffect(() => {
        if (!selected) {
            setEditable(false);
        }
    }, [selected]);

    return (
        <div
            ref={(ref) => { if (ref) connect(drag(ref)); }}
            onClick={(e) => {
                if (selected) {
                    setEditable(true);
                }
            }}
            style={{
                outline: selected && !editable ? "2px solid #ea580c" : "none",
                outlineOffset: "2px",
                cursor: editable ? "text" : "move",
                width: "100%", // Ensures it's fully selectable
            }}
        >
            <ContentEditable
                html={text}
                disabled={!editable}
                onChange={(e) => setProp((props: any) => (props.text = e.target.value))}
                tagName="div"
                style={{ fontSize: `${fontSize}px`, color, textAlign, fontWeight, outline: 'none', border: 'none' }}
            />
        </div>
    );
};

TextNode.craft = {
    props: {
        text: "텍스트를 입력하세요",
        fontSize: 16,
        color: "#000000",
        textAlign: "left",
        fontWeight: 400,
    },
    related: {
        settings: TextSettings,
    },
    displayName: "텍스트 블록",
};
