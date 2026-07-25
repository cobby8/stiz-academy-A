import test from "node:test";
import assert from "node:assert/strict";

// @ts-expect-error -- Node's type-stripping runner needs the runtime extension.
import { confirmedTimeLabel, koreaTimeHHMM, preferredTimeLabel } from "./time.ts";

// 저장 경로(service.ts plannedDate)가 만드는 값과 똑같이, "HH:MM"(KST)을 UTC ISO로 바꾼다.
// 화면 표시 함수가 이걸 되돌리지 못하면 실제 운행 시각이 9시간 밀린다.
function saveAsServerDoes(serviceDate: string, hhmm: string) {
  return new Date(`${serviceDate}T${hhmm}:00+09:00`).toISOString();
}

test("한국시간으로 저장한 확정 시간이 화면에서 그대로 되돌아온다(왕복)", () => {
  for (const hhmm of ["08:10", "00:00", "09:30", "12:00", "23:59"]) {
    const stored = saveAsServerDoes("2026-08-03", hhmm);
    assert.equal(koreaTimeHHMM(stored), hhmm, `${hhmm} 왕복 실패 (저장값 ${stored})`);
  }
});

test("UTC ISO 문자열을 그대로 잘라 쓰던 예전 방식과 다르다(회귀 방지)", () => {
  const stored = saveAsServerDoes("2026-08-03", "08:10");
  assert.equal(stored, "2026-08-02T23:10:00.000Z");
  // 예전 코드: stop.plannedAt.slice(11, 16) → "23:10" (9시간 밀린 값)
  assert.equal(stored.slice(11, 16), "23:10");
  assert.equal(koreaTimeHHMM(stored), "08:10");
});

test("자정은 24:00이 아니라 00:00으로 표시한다", () => {
  // <input type="time">은 "24:00"을 받지 못한다.
  assert.equal(koreaTimeHHMM("2026-08-02T15:00:00.000Z"), "00:00");
});

test("이미 HH:MM인 값과 빈 값·잘못된 값을 안전하게 처리한다", () => {
  assert.equal(koreaTimeHHMM("08:10"), "08:10");
  assert.equal(koreaTimeHHMM(null), "");
  assert.equal(koreaTimeHHMM(undefined), "");
  assert.equal(koreaTimeHHMM(""), "");
  assert.equal(koreaTimeHHMM("시간 확인 중"), "");
});

test("Date 객체도 한국시간으로 변환한다", () => {
  assert.equal(koreaTimeHHMM(new Date("2026-08-02T23:10:00.000Z")), "08:10");
});

test("확정 시간이 없으면 안내 문구를 돌려준다", () => {
  assert.equal(confirmedTimeLabel("2026-08-02T23:10:00.000Z"), "08:10");
  assert.equal(confirmedTimeLabel(null), "시간 미정");
});

test("희망시간은 자유 텍스트를 파싱하지 않고 그대로 보여준다", () => {
  assert.equal(preferredTimeLabel("오전 9:10"), "희망 오전 9:10 (참고)");
  assert.equal(preferredTimeLabel("9:30"), "희망 9:30 (참고)");
  // 학부모 오입력도 고치지 않고 그대로 노출한다(관리자가 보고 판단).
  assert.equal(preferredTimeLabel("오전 12:00"), "희망 오전 12:00 (참고)");
  assert.equal(preferredTimeLabel(null), "희망시간 미입력");
  assert.equal(preferredTimeLabel("   "), "희망시간 미입력");
});
