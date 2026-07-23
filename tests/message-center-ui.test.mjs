import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const clientPath = new URL("../src/app/admin/sms/SmsClient.tsx", import.meta.url);

test("메시지 센터는 네 가지 관리 탭을 제공한다", async () => {
    const source = await readFile(clientPath, "utf8");

    for (const label of ["자동 발송", "템플릿", "발송 이력", "수동 발송"]) {
        assert.match(source, new RegExp(label));
    }
});

test("자동 발송은 내부·외부·보안 대상을 구분하고 보안 알림을 잠근다", async () => {
    const source = await readFile(clientPath, "utf8");

    for (const label of ["학원 내부", "학원 외부", "인증·보안", "필수 발송"]) {
        assert.match(source, new RegExp(label));
    }
    assert.match(source, /fetch\("\/api\/admin\/sms\/automations"/);
    assert.match(source, /rule\.locked/);
    assert.match(source, /disabled=\{disabled \|\| rule\.locked\}/);
});

test("알림톡·문자·RCS 채널과 문자 대체 발송을 표시한다", async () => {
    const source = await readFile(clientPath, "utf8");

    assert.match(source, /카카오 알림톡/);
    assert.match(source, /SMS/);
    assert.match(source, /LMS/);
    assert.match(source, /RCS/);
    assert.match(source, /실패 시 대체/);
    assert.match(source, /예상 단가/);
});

test("기존 수동 문자 액션을 계속 사용한다", async () => {
    const source = await readFile(clientPath, "utf8");

    assert.match(source, /getCoachPhones/);
    assert.match(source, /sendManualSms/);
});
