const { test } = require('node:test');
const assert = require('node:assert/strict');
const { addBusinessMinutes, businessMinutesBetween, statusClockPatch, dueEscalation, DEFAULT_POLICY } = require('../libs/ticket/sla');

const policy = DEFAULT_POLICY;

test('周五下班前两小时跨过周末', () => {
  const start = new Date('2026-10-16T09:00:00.000Z');
  const due = addBusinessMinutes(start, 120, policy);
  assert.equal(due.toISOString(), '2026-10-19T02:00:00.000Z');
});

test('节假日不计入营业时间', () => {
  const start = new Date('2026-10-16T09:00:00.000Z');
  const due = addBusinessMinutes(start, 120, { ...policy, holidays: ['2026-10-19'] });
  assert.equal(due.toISOString(), '2026-10-20T02:00:00.000Z');
});

test('挂起期间的营业分钟会顺延解决时限', () => {
  const due = new Date('2026-10-13T08:00:00.000Z');
  const patch = statusClockPatch({ slaPausedAt: '2026-10-13T01:00:00.000Z', resolveDueAt: due, priority: 'medium' }, 'onHold', 'processing', new Date('2026-10-13T03:00:00.000Z'), policy);
  assert.equal(businessMinutesBetween('2026-10-13T01:00:00.000Z', '2026-10-13T03:00:00.000Z', policy), 120);
  assert.equal(patch.resolveDueAt.toISOString(), '2026-10-13T10:00:00.000Z');
  assert.equal(patch.slaPausedAt, null);
});

test('超时达到升级链的等待分钟才升级', () => {
  const dueAt = new Date('2026-10-13T01:00:00.000Z');
  const steps = [{ tenantUserId: 'lead', afterMinutes: 60 }];
  assert.equal(dueEscalation({ steps, level: 0, dueAt, now: new Date('2026-10-13T01:30:00.000Z'), policy }), null);
  assert.equal(dueEscalation({ steps, level: 0, dueAt, now: new Date('2026-10-13T02:00:00.000Z'), policy }).tenantUserId, 'lead');
});
