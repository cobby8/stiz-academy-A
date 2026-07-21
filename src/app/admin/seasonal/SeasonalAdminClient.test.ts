import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./SeasonalAdminClient.tsx", import.meta.url), "utf8");

test("시즌과 반 수정 폼은 기존 값을 입력 기본값으로 보존한다", () => {
  assert.match(source, /defaultValue:initial\?\.name/);
  assert.match(source, /defaultValue:initial\?\.slug/);
  assert.match(source, /defaultValue:dateInputValue\(initial\?\.enrollmentStartsAt\)/);
  assert.match(source, /defaultValue:initial\?\.targetGrades \?\? initial\?\.targetGrade/);
  assert.match(source, /defaultValue:initial\?\.price/);
  assert.match(source, /defaultValue=\{field\.defaultValue \?\? ""\}/);
});

test("신청 상세와 폼 모달은 공통 접근성 모달을 사용한다", () => {
  assert.match(source, /<AdminModal onClose=\{onClose\} titleId="application-title"/);
  assert.match(source, /<AdminModal onClose=\{\(\) => \{ if \(!pending\) onClose\(\); \}\} titleId=\{titleId\}>/);
  assert.match(source, /data-admin-modal-initial-focus/);
});
