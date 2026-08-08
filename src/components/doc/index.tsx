"use client";

import type { ReactNode, ButtonHTMLAttributes, InputHTMLAttributes } from "react";

// 학적부(문서형) 공통 컴포넌트 — 2026-08 관리자 개편.
//
// 왜 컴포넌트로 묶는가:
//   관리자 화면이 46개다. 색·간격을 화면마다 직접 쓰면 시안이 바뀔 때 46곳을 고쳐야 한다.
//   여기 한 곳만 고치면 전부 따라오게 만든다.
//
// 규칙:
//   · 색은 var(--doc-*) 로만 쓴다. 하드코딩 금지.
//   · 그림자 없음. 깊이는 선으로만.
//   · 모서리 3px(카드 6px). 숫자는 tabular-nums.
//   · 명조는 제목에만. 본문은 고딕.

export const DOC_SERIF = '"Nanum Myeongjo", Georgia, "Times New Roman", Batang, serif';

/** 문서 한 장. 모든 관리자 화면의 바깥 껍데기. */
export function DocPage({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`min-h-screen px-4 py-6 ${className}`}
         style={{ background: "var(--doc-paper)", color: "var(--doc-ink)" }}>
      <div className="mx-auto max-w-6xl">{children}</div>
    </div>
  );
}

/** 문서 표면 — 표·목록을 담는 흰 바탕. */
export function DocSheet({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-[6px] p-5 ${className}`}
         style={{ background: "var(--doc-surface)", border: "1px solid var(--doc-rule)" }}>
      {children}
    </div>
  );
}

/**
 * 문서 머리 — 명조 제목 + 굵은 머리선(2px).
 * 모든 화면이 이걸로 시작한다. 제목은 화면당 하나.
 */
export function DocHead({ title, sub, right }:
  { title: string; sub?: string; right?: ReactNode }) {
  return (
    <div className="border-b-2 pb-2" style={{ borderColor: "var(--doc-ink)" }}>
      <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
        <h2 className="m-0 text-[19px] font-bold tracking-tight"
            style={{ fontFamily: DOC_SERIF, color: "var(--doc-ink)" }}>
          {title}
        </h2>
        {right && <div className="ml-auto flex items-center gap-2">{right}</div>}
      </div>
      {sub && <p className="m-0 mt-1.5 text-[12.5px]" style={{ color: "var(--doc-ink-2)" }}>{sub}</p>}
    </div>
  );
}

/** 작은 대문자 라벨. 구역 이름에 쓴다. */
export function DocLabel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <p className={`m-0 mb-2 text-[9px] font-extrabold uppercase tracking-[0.11em] ${className}`}
       style={{ color: "var(--doc-ink-3)" }}>
      {children}
    </p>
  );
}

/** 요약 수치 — 명조 숫자. 화면당 3~5개까지. */
export function DocSummary({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <div className="flex flex-wrap gap-x-8 gap-y-3">
      {items.map((it) => (
        <div key={it.label}>
          <div className="text-[9px] font-extrabold uppercase tracking-[0.11em]"
               style={{ color: "var(--doc-ink-3)" }}>{it.label}</div>
          <div className="text-[22px] font-bold leading-tight tabular-nums"
               style={{ fontFamily: DOC_SERIF, color: "var(--doc-ink)" }}>{it.value}</div>
        </div>
      ))}
    </div>
  );
}

type BtnKind = "primary" | "quiet" | "danger";
const BTN_STYLE: Record<BtnKind, React.CSSProperties> = {
  primary: { background: "var(--doc-accent)", color: "var(--doc-surface)", border: "1.5px solid var(--doc-accent)" },
  quiet: { background: "transparent", color: "var(--doc-ink)", border: "1.5px solid var(--doc-rule-strong)" },
  danger: { background: "transparent", color: "var(--doc-crit)", border: "1.5px solid var(--doc-crit)" },
};

/** 버튼. 기본은 조용한 테두리형 — 문서 인상을 해치지 않는다. */
export function DocButton(
  { kind = "quiet", className = "", ...rest }:
  ButtonHTMLAttributes<HTMLButtonElement> & { kind?: BtnKind },
) {
  return (
    <button
      {...rest}
      className={`rounded-[3px] px-4 text-[12.5px] font-bold transition-opacity disabled:opacity-50 ${className}`}
      style={{ ...BTN_STYLE[kind], minHeight: 38, ...(rest.style ?? {}) }}
    />
  );
}

/** 상태 뱃지 — 테두리형. 색은 의미가 있을 때만. */
export function DocBadge(
  { tone = "ink", children }:
  { tone?: "ink" | "accent" | "warn" | "crit" | "mute"; children: ReactNode },
) {
  const color =
    tone === "accent" ? "var(--doc-accent)" :
    tone === "warn" ? "var(--doc-warn)" :
    tone === "crit" ? "var(--doc-crit)" :
    tone === "mute" ? "var(--doc-ink-3)" : "var(--doc-ink)";
  return (
    <span className="whitespace-nowrap rounded-[3px] px-2 py-0.5 text-[10.5px] font-bold"
          style={{ border: `1px solid ${color}`, color }}>
      {children}
    </span>
  );
}

/** 입력. 라벨과 함께 쓴다. */
export function DocInput(
  { label, className = "", ...rest }:
  InputHTMLAttributes<HTMLInputElement> & { label?: string },
) {
  const input = (
    <input
      {...rest}
      className={`w-full rounded-[3px] px-3 text-[13px] outline-none ${className}`}
      style={{ background: "var(--doc-paper)", border: "1px solid var(--doc-rule-strong)",
               color: "var(--doc-ink)", minHeight: 42, ...(rest.style ?? {}) }}
    />
  );
  if (!label) return input;
  return (
    <label className="block">
      <span className="mb-1 block text-[11.5px] font-bold" style={{ color: "var(--doc-ink-2)" }}>{label}</span>
      {input}
    </label>
  );
}

/** 알림 줄 — 성공/오류. 배경을 채우지 않고 좌측 선으로만 표시한다. */
export function DocNotice({ tone, children }: { tone: "ok" | "error"; children: ReactNode }) {
  const color = tone === "ok" ? "var(--doc-accent)" : "var(--doc-crit)";
  return (
    <p className="m-0 py-2 pl-3 text-[12.5px] font-bold"
       style={{ borderLeft: `3px solid ${color}`, color }}>
      {children}
    </p>
  );
}

/** 빈 상태 — 점선 테두리. 무엇을 하면 채워지는지 알려준다. */
export function DocEmpty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-[3px] px-4 py-10 text-center"
         style={{ border: "1px dashed var(--doc-rule-strong)" }}>
      <p className="m-0 text-[13.5px] font-bold" style={{ color: "var(--doc-ink)" }}>{title}</p>
      {hint && <p className="m-0 mt-1 text-[12px]" style={{ color: "var(--doc-ink-3)" }}>{hint}</p>}
    </div>
  );
}

/** 목록의 한 줄. 좌측 강조선으로 상태를 표시한다(비활성은 흐리게). */
export function DocRow(
  { children, muted = false, accent }:
  { children: ReactNode; muted?: boolean; accent?: string },
) {
  return (
    <div className="flex flex-wrap items-center gap-2 px-3 py-3"
         style={{ borderBottom: "1px solid var(--doc-rule)",
                  borderLeft: accent ? `3px solid ${accent}` : "3px solid transparent",
                  opacity: muted ? 0.55 : 1 }}>
      {children}
    </div>
  );
}

/** 모달 — 문서 한 장이 겹쳐 뜨는 느낌. 모서리를 크게 굴리지 않는다. */
export function DocModal(
  { title, onClose, children }:
  { title: string; onClose: () => void; children: ReactNode },
) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4"
         style={{ background: "rgba(0,0,0,.5)" }} role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-t-[6px] p-5 sm:rounded-[6px]"
           style={{ background: "var(--doc-surface)", border: "1px solid var(--doc-rule-strong)" }}>
        <h2 className="m-0 border-b-2 pb-2 text-[17px] font-bold"
            style={{ fontFamily: DOC_SERIF, color: "var(--doc-ink)", borderColor: "var(--doc-ink)" }}>
          {title}
        </h2>
        <div className="mt-4">{children}</div>
        <button type="button" onClick={onClose} className="sr-only">닫기</button>
      </div>
    </div>
  );
}
