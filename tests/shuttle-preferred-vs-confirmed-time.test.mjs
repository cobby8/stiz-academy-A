import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

const adminClient = read("../src/app/admin/shuttle/ShuttleRouteAdminClient.tsx");
const staffClient = read("../src/app/staff/shuttle/StaffShuttleDashboardClient.tsx");
const myPage = read("../src/app/mypage/MyPageClient.tsx");
const enrollForm = read("../src/app/apply/enroll/EnrollApplicationLaterSteps.tsx");
const service = read("../src/lib/shuttle/service.ts");

// ① 관리자가 노선을 짤 때 학부모 희망시간을 볼 수 있어야 한다.
test("관리자 미배정 카드와 배정 모달에 학부모 희망시간을 보여준다", () => {
    assert.match(adminClient, /import \{[^}]*preferredTimeLabel[^}]*\} from "@\/lib\/shuttle\/time"/);
    assert.match(adminClient, /preferredTimeLabel\(item\.pickupTime\)/);
    assert.match(adminClient, /preferredTimeLabel\(assignRequest\.pickupTime\)/);
});

test("희망시간은 이미 서버에서 내려오므로 조회 코드를 건드리지 않는다", () => {
    assert.match(service, /pickupTime: request\.pickupTime/);
});

// ② 기사 앱에 확정시간이 보여야 한다.
test("기사 앱 Stop 타입에 plannedAt이 있고 확정 시간을 표시한다", () => {
    assert.match(staffClient, /plannedAt\?: string \| Date \| null;/);
    assert.match(staffClient, /confirmedTimeLabel\(stop\.plannedAt\)/);
    assert.match(staffClient, /확정 시간 \{plannedTime\}/);
});

// ③ 타임존 왕복 버그 회귀 방지.
test("관리자 확정 시간 입력칸은 UTC 문자열을 그대로 자르지 않는다", () => {
    // slice(11, 16)은 UTC 시각을 그대로 보여줘 9시간 밀린 값을 저장하게 만든다.
    assert.doesNotMatch(adminClient, /plannedAt\?\.slice\(11, ?16\)/);
    assert.match(adminClient, /value=\{koreaTimeHHMM\(stop\.plannedAt\)\}/);
});

test("학부모 마이페이지 확정 시간은 한국시간으로 고정한다", () => {
    assert.match(myPage, /toLocaleTimeString\("ko-KR", \{ timeZone: "Asia\/Seoul"/);
});

// 라벨 통일.
test("확정/희망 라벨을 화면별로 통일한다", () => {
    assert.match(adminClient, /className="mt-2 block text-xs font-bold text-gray-500">확정 시간</);
    assert.match(adminClient, /label="확정 시간" type="time"/);
    assert.doesNotMatch(adminClient, /예상 도착시간/);
    assert.match(myPage, /dark:text-gray-400">확정 시간<\/dt>/);
    assert.doesNotMatch(myPage, />예정 시간</);
    assert.match(enrollForm, /helper="참고용입니다\. 실제 탑승시간은 배차 확정 후 안내됩니다\."/);
});

// 노선 확정 시 시간 미입력 경고(문자에 "시간 확인 중"이 나가는 것을 막기 위한 안내).
test("확정 모달은 확정 시간이 빈 정류장을 경고한다", () => {
    assert.match(adminClient, /stopsMissingPlannedAt/);
    assert.match(adminClient, /시간 확인 중&quot; ?이? ?발송|시간 확인 중&quot;/);
});
