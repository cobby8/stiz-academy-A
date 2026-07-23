import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync("src/app/admin/sms/SmsClient.tsx", "utf8");

test("수동 문자 UI는 응답 유실 재시도에 같은 requestId를 전달한다", () => {
    assert.match(source, /requestIdRef = useRef<string \| null>/);
    assert.match(source, /crypto\.randomUUID\(\)/);
    assert.match(source, /sendManualSms\(targetRecipients, message\.trim\(\), \{ requestId \}\)/);
    assert.match(source, /응답 유실 가능성이 있어 ID를 유지합니다/);
});

test("불확실 발송은 재발송에서 제외하고 실제 실패만 재시도한다", () => {
    assert.match(source, /발송 여부를 확인할 수 없는/);
    assert.match(source, /재발송하면 안 됩니다/);
    assert.match(source, /send\(result\.retryRecipients, true\)/);
    assert.match(source, /실패 \{result\.retryRecipients\.length\}건만 다시 발송/);
});

test("자동 발송은 가짜 기본값 대신 실패 차단 상태를 표시한다", () => {
    assert.doesNotMatch(source, /DEFAULT_RULES/);
    assert.match(source, /안전을 위해 설정을 임의로 표시하거나 발송하지 않습니다/);
    assert.match(source, /다시 불러오기/);
});
