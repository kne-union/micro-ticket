const { test } = require('node:test');
const assert = require('node:assert/strict');
const { allowedTransition, reopenNeedsReason, isOverdue, notifyTargetIds } = require('../libs/ticket/rules');

test('处理人不能从待受理直接完成', () => {
  assert.equal(allowedTransition('pending', 'done', true), false);
  assert.equal(allowedTransition('pending', 'processing', true), true);
});

test('提单人只能确认或退回待确认工单', () => {
  assert.equal(allowedTransition('waiting', 'done', false), true);
  assert.equal(allowedTransition('processing', 'done', false), false);
});

test('重开必须填写原因', () => {
  assert.equal(reopenNeedsReason('done', 'processing'), true);
  assert.equal(reopenNeedsReason('waiting', 'processing'), false);
});

test('未完成且期望时间已过算逾期', () => {
  const now = new Date('2026-10-13T12:00:00Z');
  assert.equal(isOverdue({ expectAt: '2026-10-13T11:00:00Z', status: 'processing' }, now), true);
  assert.equal(isOverdue({ expectAt: '2026-10-13T11:00:00Z', status: 'done' }, now), false);
});

test('内部备注不通知提单人，操作人自己不收', () => {
  const ids = notifyTargetIds({
    reporterId: 'reporter',
    assigneeIds: ['assignee'],
    watcherIds: ['reporter', 'watcher'],
    actorId: 'assignee',
    includeReporter: false
  });
  assert.deepEqual(ids, ['watcher']);
});
