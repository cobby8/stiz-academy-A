import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const authRoutesSource = await readFile("src/lib/auth-routes.ts", "utf8");
const staffLayoutSource = await readFile("src/app/staff/layout.tsx", "utf8");
const staffHomeSource = await readFile("src/app/staff/page.tsx", "utf8");
const staffNavSource = await readFile("src/app/staff/StaffBottomNav.tsx", "utf8");
const staffShuttleSource = await readFile("src/app/staff/shuttle/page.tsx", "utf8");
const schemaSource = await readFile("prisma/schema.prisma", "utf8");

test("DRIVER role lands on the shuttle mobile workspace", () => {
  assert.match(schemaSource, /enum Role \{[\s\S]*?DRIVER[\s\S]*?\}/);
  assert.match(authRoutesSource, /if \(role === "DRIVER"\) return "\/staff\/shuttle"/);
  assert.match(authRoutesSource, /target === "\/staff\/shuttle"/);
  assert.match(staffHomeSource, /appUserRole === "DRIVER"[\s\S]*?redirect\("\/staff\/shuttle"\)/);
});

test("staff mobile navigation is role-aware", () => {
  assert.match(staffLayoutSource, /StaffBottomNav staffRole=\{staff\.appUserRole\}/);
  assert.match(staffLayoutSource, /StaffProfileMenu staffName=\{staff\.appUserName\} staffRole=\{staff\.appUserRole\}/);
  assert.match(staffNavSource, /staffRole === "DRIVER"[\s\S]*?\[shuttleItem\]/);
  assert.match(staffNavSource, /airport_shuttle/);
});

test("driver shuttle page does not open instructor-only staff screens", () => {
  assert.match(staffShuttleSource, /staff\.appUserRole === "DRIVER"/);
  assert.match(staffShuttleSource, /staff\.appUserRole === "ADMIN"/);
  assert.match(staffShuttleSource, /redirect\("\/staff"\)/);
});
