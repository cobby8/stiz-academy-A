#!/usr/bin/env node
/**
 * 학적부 전역 치환 — 「개편 대응표」 §1 을 기계적으로 적용한다.
 *
 * 왜 스크립트인가: 관리자 화면이 48개, 3만 줄이다. 손으로 고치면 화면마다
 * 조금씩 달라지고, 무엇을 이미 고쳤는지도 알 수 없게 된다. 규칙을 코드로
 * 적어 두면 같은 결과가 보장되고, 규칙이 바뀌면 다시 돌리면 된다.
 *
 * ⚠️ 이 스크립트는 **className 문자열만** 바꾼다. 로직·핸들러·데이터 흐름은
 *    건드리지 않는다. 구조 변경(카드→표, 제목→DocHead)은 손으로 해야 한다.
 *
 * 사용법:
 *   node scripts/doc-restyle.mjs <파일…>          변경 내용을 미리 본다
 *   node scripts/doc-restyle.mjs --write <파일…>   실제로 적용한다
 */
import fs from "node:fs";

const WRITE = process.argv.includes("--write");
// --admin: 브랜드 색까지 문서 토큰으로 바꾼다. 학부모·기사 화면에는 쓰지 않는다.
const ADMIN = process.argv.includes("--admin");
const files = process.argv.slice(2).filter((a) => !a.startsWith("--"));

if (files.length === 0) {
  console.error("대상 파일을 지정하세요. 예: node scripts/doc-restyle.mjs --write src/app/admin/foo.tsx");
  process.exit(1);
}

/** [정규식, 교체] 순서대로 적용한다. 앞의 규칙이 뒤에 영향을 주므로 순서가 중요하다. */
const RULES = [
  // ── 배경 ────────────────────────────────────────────────
  // 페이지 바탕과 카드 표면. dark: 짝을 먼저 지우고 단독형을 바꾼다.
  [/\bbg-white\s+dark:bg-gray-(?:800|900)\b/g, "bg-[var(--doc-surface)]"],
  [/\bdark:bg-gray-(?:800|900)\s+bg-white\b/g, "bg-[var(--doc-surface)]"],
  [/\bbg-gray-50\s+dark:bg-gray-(?:800|900)(?:\/\d+)?\b/g, "bg-[var(--doc-grid-head)]"],
  [/\bbg-white\b/g, "bg-[var(--doc-surface)]"],
  [/\bbg-gray-(?:50|100)\b/g, "bg-[var(--doc-grid-head)]"],
  [/\bdark:bg-gray-\d+(?:\/\d+)?\b/g, ""],

  // ── 글자 ────────────────────────────────────────────────
  [/\btext-gray-900\s+dark:text-white\b/g, "text-[var(--doc-ink)]"],
  [/\bdark:text-white\s+text-gray-900\b/g, "text-[var(--doc-ink)]"],
  [/\btext-gray-(?:800|900)\b/g, "text-[var(--doc-ink)]"],
  [/\btext-gray-(?:500|600|700)\b/g, "text-[var(--doc-ink-2)]"],
  [/\btext-gray-(?:300|400)\b/g, "text-[var(--doc-ink-3)]"],
  [/\bdark:text-(?:white|gray-\d+)\b/g, ""],

  // ── 테두리 ──────────────────────────────────────────────
  [/\bborder-gray-\d+\b/g, "border-[var(--doc-rule)]"],
  [/\bdark:border-gray-\d+\b/g, ""],

  // ── 의미 있는 색: 위험만 남기고 나머지 장식색은 먹/괘선으로 ──
  [/\btext-red-\d+\b/g, "text-[var(--doc-crit)]"],
  [/\bbg-red-(?:50|100)\b/g, "bg-[var(--doc-crit-soft)]"],
  [/\bborder-red-\d+\b/g, "border-[var(--doc-crit)]"],
  [/\btext-(?:green|emerald|teal)-\d+\b/g, "text-[var(--doc-accent)]"],
  [/\bbg-(?:green|emerald|teal)-(?:50|100)\b/g, "bg-[var(--doc-accent-soft)]"],
  [/\bborder-(?:green|emerald|teal)-\d+\b/g, "border-[var(--doc-accent)]"],
  [/\btext-(?:amber|yellow|orange)-\d+\b/g, "text-[var(--doc-warn)]"],
  [/\bbg-(?:amber|yellow|orange)-(?:50|100)\b/g, "bg-[var(--doc-grid-head)]"],
  [/\bborder-(?:amber|yellow|orange)-\d+\b/g, "border-[var(--doc-warn)]"],
  // 파랑·보라 계열은 의미가 없는 장식색이다 — 위계는 선과 글자로 만든다.
  [/\btext-(?:blue|indigo|violet|purple|sky|cyan)-\d+\b/g, "text-[var(--doc-ink-2)]"],
  [/\bbg-(?:blue|indigo|violet|purple|sky|cyan)-(?:50|100|900)\b/g, "bg-[var(--doc-grid-head)]"],
  [/\bborder-(?:blue|indigo|violet|purple|sky|cyan)-\d+\b/g, "border-[var(--doc-rule)]"],
  [/\bdark:(?:bg|text|border)-(?:red|green|emerald|teal|amber|yellow|orange|blue|indigo|violet|purple|sky|cyan)-\d+(?:\/\d+)?\b/g, ""],

  // ── 그라디언트 · 그림자 · 블러 : 전부 삭제 ─────────────────
  [/\bbg-gradient-to-[a-z]{1,2}\b/g, ""],
  [/\b(?:from|via|to)-[a-z]+-\d+\b/g, ""],
  [/\bshadow(?:-(?:sm|md|lg|xl|2xl))?\b/g, ""],
  [/\bbackdrop-blur(?:-[a-z]+)?\b/g, ""],
  [/\bring-\d\b/g, ""],
  [/\bring-offset-\d\b/g, ""],
  [/\bring-[a-z]+-\d+\b/g, ""],

  // ── 모서리 : 12px 이상 금지 ───────────────────────────────
  [/\brounded-(?:2xl|3xl)\b/g, "rounded-[6px]"],
  [/\brounded-(?:xl|lg|md|full)\b/g, "rounded-[3px]"],

  // ── 반짝이는 스켈레톤 금지 ────────────────────────────────
  [/\banimate-pulse\b/g, ""],

  // ── 제목 굵기 ─────────────────────────────────────────────
  [/\bfont-(?:black|extrabold)\b/g, "font-bold"],

  // ── 남은 dark: 변종 정리 ──────────────────────────────────
  // 토큰이 라이트/다크를 알아서 처리하므로 dark: 짝은 필요 없다.
  // hover:/focus: 가 끼어든 형태(dark:hover:bg-gray-800)까지 잡는다.
  [/\bdark:(?:hover:|focus:|group-hover:)?(?:bg|text|border|ring)-(?:gray|red|green|emerald|teal|amber|yellow|orange|blue|indigo|violet|purple|sky|cyan|white|black)(?:-\d+)?(?:\/\d+)?\b/g, ""],
  // 이미 토큰으로 바뀐 것에 붙은 dark: 짝은 같은 값이라 군더더기다.
  [/\bdark:(?:bg|text|border)-\[var\(--doc-[a-z0-9-]+\)\]/g, ""],
];

/**
 * 관리자 화면 전용 추가 규칙.
 * 학적부 방향에서 관리자 화면은 브랜드 오렌지/네온을 쓰지 않는다(로고·학부모 화면에만 남긴다).
 */
const ADMIN_RULES = [
  [/var\(--brand-accent-soft\)/g, "var(--doc-accent-soft)"],
  [/var\(--brand-accent-contrast\)/g, "var(--doc-on-accent)"],
  [/var\(--brand-accent-hover\)/g, "var(--doc-accent)"],
  [/var\(--brand-accent\)/g, "var(--doc-accent)"],
  [/\bbg-brand-orange-\d+\b/g, "bg-[var(--doc-accent)]"],
  [/\btext-brand-orange-\d+\b/g, "text-[var(--doc-accent)]"],
  [/\bborder-brand-orange-\d+\b/g, "border-[var(--doc-accent)]"],
  [/\bbg-brand-navy-\d+\b/g, "bg-[var(--doc-ink)]"],
  [/\btext-brand-navy-\d+\b/g, "text-[var(--doc-ink)]"],
  [/\bdark:(?:hover:)?(?:bg|text|border)-brand-(?:neon-lime|neon-cobalt|neon-pink|navy-\d+|orange-\d+|sky-\d+)\b/g, ""],
];

let changedFiles = 0;

for (const file of files) {
  const before = fs.readFileSync(file, "utf8");
  let after = before;
  for (const [re, to] of RULES) after = after.replace(re, to);
  if (ADMIN) for (const [re, to] of ADMIN_RULES) after = after.replace(re, to);

  // 규칙이 지운 자리에 공백이 겹치므로 className 안쪽만 정리한다.
  after = after.replace(/className="([^"]*)"/g, (m, cls) => `className="${cls.replace(/\s+/g, " ").trim()}"`);
  after = after.replace(/className={`([^`]*)`}/g, (m, cls) => `className={\`${cls.replace(/[ \t]+/g, " ")}\`}`);

  if (after === before) {
    console.log(`  = ${file} (변경 없음)`);
    continue;
  }
  changedFiles++;
  const diff = before.split("\n").filter((l, i) => l !== after.split("\n")[i]).length;
  console.log(`  ${WRITE ? "✓" : "·"} ${file} — ${diff}줄`);
  if (WRITE) fs.writeFileSync(file, after);
}

console.log(WRITE ? `\n${changedFiles}개 파일 적용` : `\n${changedFiles}개 파일이 바뀝니다. --write 로 실제 적용하세요.`);
