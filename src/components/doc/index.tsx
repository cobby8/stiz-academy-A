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
export function DocHead({ title, sub, period, summary, right }:
  {
    title: string;
    sub?: string;
    /** 대상 기간 — "2026.08.01 – 08.09". 제목 오른쪽에 붙는다. */
    period?: string;
    /** 요약 수치. ⚠️ 반드시 본문 데이터에서 계산할 것 — 고정 문자열을 넣으면 서류와 화면이 어긋난다. */
    summary?: { label: string; value: ReactNode; tone?: "negative" }[];
    right?: ReactNode;
  }) {
  return (
    <header>
      <div className="border-t-2 pt-3" style={{ borderColor: "var(--doc-ink)" }}>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="m-0 text-[23px] font-bold tracking-tight"
              style={{ fontFamily: DOC_SERIF, color: "var(--doc-ink)" }}>
            {title}
          </h2>
          {period && (
            <span className="text-[12.5px] tabular-nums" style={{ color: "var(--doc-ink-2)" }}>{period}</span>
          )}
          {right && <div className="ml-auto flex items-center gap-2">{right}</div>}
        </div>
        {sub && <p className="m-0 mt-1.5 text-[12.5px]" style={{ color: "var(--doc-ink-2)" }}>{sub}</p>}
      </div>
      {summary && summary.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-x-8 gap-y-3 pb-4"
             style={{ borderBottom: "1px solid var(--doc-rule)" }}>
          {summary.map((s) => (
            <div key={s.label}>
              <div className="text-[10px] font-extrabold uppercase tracking-[0.1em]"
                   style={{ color: "var(--doc-ink-3)" }}>{s.label}</div>
              <div className="text-[21px] font-bold leading-tight tabular-nums"
                   style={{ fontFamily: DOC_SERIF,
                            color: s.tone === "negative" ? "var(--doc-crit)" : "var(--doc-ink)" }}>
                {s.value}
              </div>
            </div>
          ))}
        </div>
      )}
    </header>
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

/**
 * 상태 뱃지 — 테두리형. 색은 의미가 있을 때만.
 *
 * positive/negative 는 옅은 바탕까지 깔아 목록에서 눈에 띄게 하고,
 * 나머지는 테두리와 글자만 쓴다(파생 배경은 여기와 표 머리행에만 허용된다).
 */
export function DocBadge(
  { tone = "ink", children }:
  {
    tone?: "ink" | "accent" | "warn" | "crit" | "mute" | "positive" | "negative" | "neutral";
    children: ReactNode;
  },
) {
  const soft = tone === "positive" || tone === "negative";
  const color =
    tone === "accent" || tone === "positive" ? "var(--doc-accent)" :
    tone === "warn" ? "var(--doc-warn)" :
    tone === "crit" || tone === "negative" ? "var(--doc-crit)" :
    tone === "mute" || tone === "neutral" ? "var(--doc-ink-3)" : "var(--doc-ink)";
  const background =
    tone === "positive" ? "var(--doc-accent-soft)" :
    tone === "negative" ? "var(--doc-crit-soft)" : "transparent";
  return (
    <span className="inline-flex items-center whitespace-nowrap rounded-[3px] px-2 py-0.5 text-[11px] font-semibold"
          style={{ border: `1px solid ${soft ? color : color}`, color, background }}>
      {children}
    </span>
  );
}

export type WeekGridCell = {
  /** 칸의 대표 숫자. 없으면 미운행으로 보고 — 기호를 그린다. */
  value?: ReactNode;
  /** 보조 한 줄. 시안 규칙상 칸 안에는 숫자 하나 + 보조 한 줄까지만. */
  note?: ReactNode;
  muted?: boolean;
  onClick?: () => void;
};

/**
 * 요일 × 시간 격자 — 이 학원 데이터의 기본형(시간표·운행표·출결 모두 이 모양이다).
 *
 * 칸 안에는 숫자 하나와 보조 한 줄까지만 넣는다. 그 이상 담고 싶어지면
 * 격자가 아니라 표로 가야 한다는 신호다.
 * 미운행·휴강은 색이 아니라 — 기호와 흐린 글자로 표시한다(흑백 인쇄 대비).
 */
export function DocWeekGrid(
  { columns, rows, cells, minWidth = 680 }:
  {
    /** 가로 축 — 보통 요일. 예: ["월","화","수","목","금","토"] */
    columns: string[];
    /** 세로 축 — 보통 교시·시각. 예: ["3교시 15:00", "4교시 16:00"] */
    rows: string[];
    /** cells[행][열]. 비어 있으면 미운행으로 본다. */
    cells: (WeekGridCell | null | undefined)[][];
    minWidth?: number;
  },
) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse" style={{ minWidth }}>
        <thead>
          <tr>
            <th className="h-[30px] px-3 text-left text-[10px] font-extrabold uppercase tracking-[0.1em]"
                style={{ color: "var(--doc-ink-3)", background: "var(--doc-grid-head)",
                         borderBottom: "1.5px solid var(--doc-ink)", border: "1px solid var(--doc-rule)" }} />
            {columns.map((c) => (
              <th key={c}
                  className="h-[30px] px-3 text-center text-[10px] font-extrabold uppercase tracking-[0.1em]"
                  style={{ color: "var(--doc-ink-3)", background: "var(--doc-grid-head)",
                           border: "1px solid var(--doc-rule)", borderBottom: "1.5px solid var(--doc-ink)" }}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={r}>
              <th className="px-3 text-left text-[11px] font-semibold"
                  style={{ height: "var(--grid-cell-height, 56px)", color: "var(--doc-ink-2)",
                           background: "var(--doc-grid-head)", border: "1px solid var(--doc-rule)",
                           whiteSpace: "nowrap" }}>
                {r}
              </th>
              {columns.map((c, ci) => {
                const cell = cells[ri]?.[ci];
                const empty = !cell || cell.value == null;
                return (
                  <td key={c}
                      onClick={cell?.onClick}
                      className={`px-2 text-center align-middle ${cell?.onClick ? "cursor-pointer" : ""}`}
                      style={{ height: "var(--grid-cell-height, 56px)", border: "1px solid var(--doc-rule)",
                               opacity: cell?.muted ? 0.55 : 1 }}>
                    {empty ? (
                      <span className="text-[13px]" style={{ color: "var(--doc-ink-3)" }}>—</span>
                    ) : (
                      <>
                        <div className="text-[15px] font-semibold tabular-nums" style={{ color: "var(--doc-ink)" }}>
                          {cell.value}
                        </div>
                        {cell.note != null && (
                          <div className="mt-0.5 text-[10.5px]" style={{ color: "var(--doc-ink-3)" }}>{cell.note}</div>
                        )}
                      </>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * 문서 로고 — 셸 머리와 인쇄 머리에 쓴다.
 *
 * 검정 워드마크라 어두운 바탕에서 묻힌다. 색을 반전하면 오렌지 볼이 파랗게 변하므로,
 * 다크에서는 흰 판(.stiz-logo-plate)을 깔아 브랜드 색을 그대로 지킨다.
 */
export function DocLogo({ height = 22 }: { height?: number }) {
  return (
    <span className="stiz-logo-plate inline-flex items-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/stiz-logo.png" alt="STIZ 농구교실" style={{ height, width: "auto" }} />
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

/**
 * 구역 제목 — 문서 안의 중간 제목. 굵은 머리선(2px) 위에 명조로 얹는다.
 * 색을 쓰지 않고 선과 글자만으로 위계를 만든다는 규칙의 핵심 장치다.
 */
export function DocSection(
  { title, right, children }:
  { title: string; right?: ReactNode; children?: ReactNode },
) {
  return (
    <section className="mt-6">
      <div className="flex flex-wrap items-baseline gap-2 border-t-2 pt-2"
           style={{ borderColor: "var(--doc-ink)" }}>
        <h3 className="m-0 text-[17px] font-bold"
            style={{ fontFamily: DOC_SERIF, color: "var(--doc-ink)" }}>{title}</h3>
        {right && <div className="ml-auto">{right}</div>}
      </div>
      {children && <div className="mt-3">{children}</div>}
    </section>
  );
}

export type DocColumn = {
  key: string;
  label: string;
  /** 숫자 열 — tabular-nums + 우측 정렬. 숫자가 나열되면 예외 없이 켠다. */
  numeric?: boolean;
  muted?: boolean;
  width?: string | number;
};

/**
 * 표 — 줄무늬 배경 없이 괘선만으로 읽힌다.
 *
 * · 머리행 아래 1.5px, 행 사이 1px
 * · 행 hover 는 배경이 아니라 **좌측 2px 강조선** (문서에 형광펜을 긋지 않는다)
 * · 항상 가로 스크롤 컨테이너 안에 둔다 — 좁은 화면에서 표가 찌그러지면 서류가 아니다
 */
export function DocTable(
  { columns, rows, total, minWidth = 680, empty = "기록이 없습니다." }:
  {
    columns: DocColumn[];
    rows: Record<string, ReactNode>[];
    /** 합계 행. 위에 굵은 선이 그어진다. */
    total?: Record<string, ReactNode> & { label?: string };
    minWidth?: number;
    empty?: string;
  },
) {
  const align = (c: DocColumn): "right" | "left" => (c.numeric ? "right" : "left");
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse" style={{ minWidth }}>
        <thead>
          <tr style={{ borderBottom: "1.5px solid var(--doc-ink)" }}>
            {columns.map((c) => (
              <th key={c.key}
                  className="h-[30px] px-3 text-[10px] font-extrabold uppercase tracking-[0.1em]"
                  style={{ textAlign: align(c), color: "var(--doc-ink-3)", width: c.width }}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="h-[64px] px-3 text-center text-[12.5px]"
                  style={{ color: "var(--doc-ink-3)" }}>{empty}</td>
            </tr>
          )}
          {rows.map((r, i) => (
            <tr key={i} className="group"
                style={{ borderBottom: "1px solid var(--doc-rule)", borderLeft: "2px solid transparent" }}
                onMouseEnter={(e) => { e.currentTarget.style.borderLeftColor = "var(--doc-accent)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderLeftColor = "transparent"; }}>
              {columns.map((c) => (
                <td key={c.key}
                    className={`h-[34px] px-3 text-[12.5px] ${c.numeric ? "font-semibold tabular-nums" : "font-medium"}`}
                    style={{ textAlign: align(c), color: c.muted ? "var(--doc-ink-2)" : "var(--doc-ink)" }}>
                  {r[c.key]}
                </td>
              ))}
            </tr>
          ))}
          {total && (
            <tr style={{ borderTop: "1.5px solid var(--doc-ink)" }}>
              {columns.map((c, i) => (
                <td key={c.key}
                    className={`h-[34px] px-3 text-[12.5px] font-semibold ${c.numeric ? "tabular-nums" : ""}`}
                    style={{ textAlign: align(c), color: "var(--doc-ink)" }}>
                  {i === 0 ? (total.label ?? "합계") : total[c.key]}
                </td>
              ))}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/** 탭 — 밑줄형. 선택된 탭만 강조색, 배경을 채우지 않는다. */
export function DocTabs(
  { items, value, onChange }:
  { items: { value: string; label: ReactNode }[]; value: string; onChange: (v: string) => void },
) {
  return (
    <div className="flex gap-6 overflow-x-auto" style={{ borderBottom: "1px solid var(--doc-rule)" }}>
      {items.map((it) => {
        const on = it.value === value;
        return (
          <button key={it.value} type="button" onClick={() => onChange(it.value)}
                  className="whitespace-nowrap py-2.5 text-[12.5px] transition-colors"
                  style={{
                    fontWeight: on ? 600 : 500,
                    color: on ? "var(--doc-accent)" : "var(--doc-ink-3)",
                    borderBottom: `2px solid ${on ? "var(--doc-accent)" : "transparent"}`,
                  }}>
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * 문서 꼬리 — 발행 시각을 남긴다.
 * 화면을 그대로 인쇄해 서류로 쓰기 때문에, 언제 뽑은 것인지가 반드시 있어야 한다.
 */
export function DocFoot(
  { issued, org = "STIZ 농구교실", actions }:
  { issued: string; org?: string; actions?: ReactNode },
) {
  return (
    <footer className="mt-6 flex flex-wrap items-center justify-between gap-3 pt-3"
            style={{ borderTop: "1px solid var(--doc-rule)" }}>
      <div className="no-print flex gap-2">{actions}</div>
      <span className="text-[11px] tabular-nums" style={{ color: "var(--doc-ink-3)" }}>
        발행 {issued} · {org}
      </span>
    </footer>
  );
}

/** 발행 시각 문자열 — "2026.08.09 05:40". 서류 표기는 점(.)으로 통일한다. */
export function issuedAt(d: Date = new Date()): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: false,
    }).formatToParts(d).map((x) => [x.type, x.value]),
  );
  return `${p.year}.${p.month}.${p.day} ${p.hour}:${p.minute}`;
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
