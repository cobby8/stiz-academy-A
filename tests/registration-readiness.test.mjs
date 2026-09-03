import test from 'node:test';
import assert from 'node:assert/strict';
import { registrationReadiness } from '../src/lib/enrollment/registration-readiness.ts';

const base = { studentId: 'student-1', assignedClassIds: ['class-1'], activeClassIds: ['class-1'], shuttleNeeded: false, commands: [], invoiceCandidates: 0 };
test('사이트 승인만으로 입학 완료로 표시하지 않는다', () => {
  const result = registrationReadiness(base);
  assert.equal(result.complete, false);
  assert.equal(result.checks[0].status, 'VERIFIED');
  assert.ok(!result.checks.some((row) => row.key === 'shuttle'));
});
test('반 미배정·일부 반 누락·학생 미연결을 차단한다', () => {
  for (const patch of [{ assignedClassIds: [] }, { activeClassIds: [] }, { studentId: null }, { assignedClassIds: ['class-1', 'class-2'] }]) {
    assert.equal(registrationReadiness({ ...base, ...patch }).checks[0].status, 'CHECK_REQUIRED');
  }
});
test('셔틀 요청자에게만 기사 안내 체크가 생긴다', () => {
  assert.ok(registrationReadiness({ ...base, shuttleNeeded: true }).checks.some((row) => row.key === 'shuttle'));
});
test('다른 등록일 수 있는 동기화·청구 후보는 완료 증거가 아니다', () => {
  const result = registrationReadiness({ ...base, invoiceCandidates: 1, commands: [{ status: 'SYNCED', syncAttempts: [{ target: 'RALLYZ', status: 'SUCCEEDED', verifiedAt: new Date() }] }] });
  assert.equal(result.complete, false);
  assert.ok(result.checks.slice(1).every((row) => row.status === 'CHECK_REQUIRED'));
});
