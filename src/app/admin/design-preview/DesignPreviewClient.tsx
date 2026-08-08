"use client";

import { useState } from "react";

// 학적부 디자인 토큰·컴포넌트 미리보기.
// 색은 전부 var(--doc-*) 로만 쓴다(하드코딩 금지). 라이트/다크는 상단 .dark 클래스로 자동 전환된다.

const SERIF = '"Nanum Myeongjo", Georgia, "Times New Roman", Batang, serif';

/** 문서 머리 — 모든 관리자 화면이 공유하는 최상단 블록. */
function DocHead({ title, period, right }: { title: string; period: string; right?: string }) {
  return (
    <div className="flex items-end gap-3 border-b-2 pb-2" style={{ borderColor: "var(--doc-ink)" }}>
      <h2 className="m-0 text-[19px] font-bold tracking-tight" style={{ fontFamily: SERIF, color: "var(--doc-ink)" }}>
        {title}
      </h2>
      <span className="text-[11px] font-medium" style={{ color: "var(--doc-ink-3)" }}>{period}</span>
      {right && (
        <span className="ml-auto text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: "var(--doc-ink-3)" }}>
          {right}
        </span>
      )}
    </div>
  );
}

/** 요약 수치 — 명조 숫자. 화면당 3~5개까지만. */
function Summary({ items }: { items: { label: string; value: string }[] }) {
  return (
    <div className="flex flex-wrap gap-x-8 gap-y-3">
      {items.map((it) => (
        <div key={it.label}>
          <div className="text-[9px] font-extrabold uppercase tracking-[0.11em]" style={{ color: "var(--doc-ink-3)" }}>
            {it.label}
          </div>
          <div className="text-[22px] font-bold leading-tight tabular-nums"
               style={{ fontFamily: SERIF, color: "var(--doc-ink)" }}>
            {it.value}
          </div>
        </div>
      ))}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 text-[9px] font-extrabold uppercase tracking-[0.11em]" style={{ color: "var(--doc-ink-3)" }}>
      {children}
    </p>
  );
}

export default function DesignPreviewClient() {
  const [checked, setChecked] = useState<Record<string, boolean>>({ 김대후: true, 이수연: true, 김윤: false });

  const rows = [
    { time: "08:58", stop: "힐스테이트 다산", who: "김윤", n: 1 },
    { time: "09:07", stop: "새봄중 맞은편 버스정류장", who: "김도운", n: 1 },
    { time: "09:19", stop: "롯데낙천대아파트 관리사무소 앞", who: "이수연 · 김하임", n: 2 },
    { time: "09:22", stop: "도농초 앞 버스정류장", who: "김대후", n: 1 },
  ];

  const week = [
    { row: "등원", cells: ["7", "8", "8", "9", "3"] },
    { row: "하원", cells: ["6", "8", "7", "9", "—"] },
  ];

  return (
    <div className="min-h-screen px-5 py-8" style={{ background: "var(--doc-paper)", color: "var(--doc-ink)" }}>
      <div className="mx-auto max-w-4xl">

        <p className="m-0 text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: "var(--doc-ink-3)" }}>
          STIZ · 디자인 토큰 미리보기
        </p>
        <h1 className="mt-2 mb-0 text-[30px] font-bold tracking-tight" style={{ fontFamily: SERIF }}>
          학적부 스타일
        </h1>
        <p className="mt-3 mb-0 max-w-[62ch] text-[14px]" style={{ color: "var(--doc-ink-2)" }}>
          관리자 화면에 적용할 토큰과 공통 컴포넌트입니다. 실제 화면은 아직 바뀌지 않았습니다.
          우측 상단 테마 전환으로 라이트·다크를 함께 확인해 주세요.
        </p>
        <div className="mt-5 h-0.5" style={{ background: "var(--doc-ink)" }} />

        {/* ── 색 ── */}
        <section className="mt-10">
          <Label>색 — 11개로 제한</Label>
          <div className="flex flex-wrap gap-2">
            {[
              ["종이", "--doc-paper"], ["표면", "--doc-surface"], ["먹", "--doc-ink"],
              ["보조", "--doc-ink-2"], ["라벨", "--doc-ink-3"], ["괘선", "--doc-rule"],
              ["굵은선", "--doc-rule-strong"], ["강조", "--doc-accent"], ["강조배경", "--doc-accent-soft"],
              ["경고", "--doc-crit"], ["주의", "--doc-warn"],
            ].map(([name, v]) => (
              <div key={v} className="w-[104px] overflow-hidden rounded"
                   style={{ border: "1px solid var(--doc-rule)" }}>
                <div className="h-9" style={{ background: `var(${v})` }} />
                <div className="px-2 py-1.5" style={{ background: "var(--doc-surface)" }}>
                  <div className="text-[10.5px] font-bold">{name}</div>
                  <div className="font-mono text-[9px]" style={{ color: "var(--doc-ink-3)" }}>{v}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── 문서 뼈대 ── */}
        <section className="mt-12">
          <Label>공통 뼈대 — 모든 관리자 화면이 이 순서를 따른다</Label>
          <div className="rounded-[3px] p-5" style={{ background: "var(--doc-surface)", border: "1px solid var(--doc-rule)" }}>
            <DocHead title="등원 셔틀 운행표" period="2026.08.03 – 08.07" right="주간" />

            <div className="mt-4">
              <Summary items={[
                { label: "주간 연인원", value: "35" },
                { label: "운행일", value: "5" },
                { label: "학원 도착", value: "09:25" },
                { label: "미배정", value: "1" },
              ]} />
            </div>

            {/* 주간 격자 */}
            <div className="mt-6">
              <Label>요일별 탑승 현황</Label>
              <div className="overflow-x-auto">
                <div className="grid min-w-[420px] overflow-hidden rounded-[3px]"
                     style={{ gridTemplateColumns: "44px repeat(5, 1fr)", border: "1px solid var(--doc-rule)" }}>
                  {["", "월", "화", "수", "목", "금"].map((d, i) => (
                    <div key={`h${i}`} className="px-1 py-1.5 text-center text-[10px] font-extrabold tracking-wide"
                         style={{ background: "var(--doc-accent-soft)", color: "var(--doc-ink-3)",
                                  borderRight: i === 5 ? "none" : "1px solid var(--doc-rule)",
                                  borderBottom: "1px solid var(--doc-rule)" }}>{d}</div>
                  ))}
                  {week.map((r, ri) => (
                    <div key={r.row} className="contents">
                      <div className="px-1 py-2 text-center text-[10px] font-bold"
                           style={{ background: "var(--doc-accent-soft)", color: "var(--doc-ink-3)",
                                    borderRight: "1px solid var(--doc-rule)",
                                    borderBottom: ri === week.length - 1 ? "none" : "1px solid var(--doc-rule)" }}>
                        {r.row}
                      </div>
                      {r.cells.map((c, ci) => (
                        <div key={`${r.row}-${ci}`} className="px-1 py-2 text-center font-mono text-[12px] font-bold tabular-nums"
                             style={{ color: c === "—" ? "var(--doc-ink-3)" : "var(--doc-ink)",
                                      borderRight: ci === 4 ? "none" : "1px solid var(--doc-rule)",
                                      borderBottom: ri === week.length - 1 ? "none" : "1px solid var(--doc-rule)" }}>
                          {c}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 표 */}
            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[440px] border-collapse text-[12.5px]">
                <thead>
                  <tr>
                    {["시각", "정류장", "학생", "인원"].map((h, i) => (
                      <th key={h} className={`px-3 py-2 text-[10px] font-extrabold uppercase tracking-[0.09em] ${i === 3 ? "text-right" : "text-left"}`}
                          style={{ borderBottom: "1.5px solid var(--doc-ink)", color: "var(--doc-ink)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.time}>
                      <td className="px-3 py-2.5 font-mono tabular-nums" style={{ borderBottom: "1px solid var(--doc-rule)" }}>{r.time}</td>
                      <td className="px-3 py-2.5" style={{ borderBottom: "1px solid var(--doc-rule)", color: "var(--doc-ink-2)" }}>{r.stop}</td>
                      <td className="px-3 py-2.5" style={{ borderBottom: "1px solid var(--doc-rule)", color: "var(--doc-ink-2)" }}>{r.who}</td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums" style={{ borderBottom: "1px solid var(--doc-rule)" }}>{r.n}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 문서 꼬리 */}
            <div className="mt-4 flex flex-wrap items-center gap-2 text-[10px]" style={{ color: "var(--doc-ink-3)" }}>
              <span className="font-bold" style={{ color: "var(--doc-accent)" }}>인쇄</span>
              <span>·</span>
              <span className="font-bold" style={{ color: "var(--doc-accent)" }}>PDF 저장</span>
              <span>·</span>
              <span>발행 2026.08.09</span>
            </div>
          </div>
        </section>

        {/* ── 컴포넌트 ── */}
        <section className="mt-12">
          <Label>공통 컴포넌트</Label>
          <div className="grid gap-4 sm:grid-cols-2">

            {/* 버튼 */}
            <div className="rounded-[3px] p-4" style={{ background: "var(--doc-surface)", border: "1px solid var(--doc-rule)" }}>
              <p className="mb-3 text-[11px] font-bold">버튼</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="rounded-[3px] px-4 py-2 text-[12.5px] font-bold"
                        style={{ background: "var(--doc-accent)", color: "var(--doc-surface)" }}>저장</button>
                <button type="button" className="rounded-[3px] px-4 py-2 text-[12.5px] font-bold"
                        style={{ border: "1.5px solid var(--doc-rule-strong)", color: "var(--doc-ink)" }}>취소</button>
                <button type="button" className="rounded-[3px] px-4 py-2 text-[12.5px] font-bold"
                        style={{ border: "1.5px solid var(--doc-crit)", color: "var(--doc-crit)" }}>삭제</button>
              </div>
              <p className="mb-2 mt-4 text-[11px] font-bold">입력</p>
              <input placeholder="학생 이름 검색"
                     className="w-full rounded-[3px] px-3 py-2 text-[12.5px] outline-none"
                     style={{ background: "var(--doc-paper)", border: "1px solid var(--doc-rule-strong)", color: "var(--doc-ink)" }} />
            </div>

            {/* 상태 뱃지 · 탭 */}
            <div className="rounded-[3px] p-4" style={{ background: "var(--doc-surface)", border: "1px solid var(--doc-rule)" }}>
              <p className="mb-3 text-[11px] font-bold">상태 표시</p>
              <div className="flex flex-wrap gap-2">
                {[["정상", "var(--doc-accent)"], ["확인 요망", "var(--doc-warn)"], ["미납", "var(--doc-crit)"]].map(([t, c]) => (
                  <span key={t} className="rounded-[3px] px-2.5 py-1 text-[10.5px] font-bold"
                        style={{ border: `1px solid ${c}`, color: c }}>{t}</span>
                ))}
              </div>
              <p className="mb-2 mt-4 text-[11px] font-bold">탭</p>
              <div className="flex gap-4" style={{ borderBottom: "1px solid var(--doc-rule)" }}>
                {["셔틀", "출결", "정산"].map((t, i) => (
                  <span key={t} className="pb-2 text-[12px]"
                        style={ i === 0
                          ? { fontWeight: 800, color: "var(--doc-ink)", borderBottom: "2px solid var(--doc-ink)", marginBottom: "-1px" }
                          : { fontWeight: 600, color: "var(--doc-ink-3)" }}>{t}</span>
                ))}
              </div>
            </div>

            {/* 출결 체크 — 선생님 화면 밀도 참고 */}
            <div className="rounded-[3px] p-4" style={{ background: "var(--doc-surface)", border: "1px solid var(--doc-rule)" }}>
              <p className="mb-3 text-[11px] font-bold">출결 체크 <span style={{ color: "var(--doc-ink-3)" }}>(선생님 밀도 · 행 60px)</span></p>
              {Object.entries(checked).map(([name, on]) => (
                <button key={name} type="button"
                        onClick={() => setChecked((c) => ({ ...c, [name]: !c[name] }))}
                        className="flex w-full items-center gap-3 rounded-[3px] px-3 text-left"
                        style={{ height: 60, borderBottom: "1px solid var(--doc-rule)" }}>
                  <span className="flex-1 text-[15px] font-bold">{name}</span>
                  <span className="grid h-[30px] w-[30px] place-items-center rounded-[6px]"
                        style={{ border: `2px solid ${on ? "var(--doc-accent)" : "var(--doc-rule-strong)"}`,
                                 background: on ? "var(--doc-accent)" : "transparent",
                                 color: "var(--doc-surface)", fontSize: 16, fontWeight: 900 }}>
                    {on ? "✓" : ""}
                  </span>
                </button>
              ))}
              <p className="mt-2 text-[10.5px]" style={{ color: "var(--doc-ink-3)" }}>행 전체가 탭 영역입니다. 눌러보세요.</p>
            </div>

            {/* 빈 상태 */}
            <div className="rounded-[3px] p-4" style={{ background: "var(--doc-surface)", border: "1px solid var(--doc-rule)" }}>
              <p className="mb-3 text-[11px] font-bold">빈 상태</p>
              <div className="rounded-[3px] px-4 py-8 text-center"
                   style={{ border: "1px dashed var(--doc-rule-strong)" }}>
                <p className="m-0 text-[13px] font-bold">이 날짜에 저장된 노선이 없습니다</p>
                <p className="m-0 mt-1 text-[11.5px]" style={{ color: "var(--doc-ink-3)" }}>
                  자동 제안으로 노선을 만든 뒤 저장하면 여기에 표시됩니다
                </p>
              </div>
            </div>
          </div>
        </section>

        <p className="mt-12 text-[12px]" style={{ color: "var(--doc-ink-3)" }}>
          이 페이지는 확인용입니다. 실제 관리자 화면은 아직 그대로입니다.
        </p>
      </div>
    </div>
  );
}
