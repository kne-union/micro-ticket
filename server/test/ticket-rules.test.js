const { expect } = require('chai');
const { allowedTransition, reopenNeedsReason, isOverdue, autoCloseAt, notifyTargetIds } = require('../libs/ticket/rules');

describe('ticket rules', () => {
  describe('状态流转测试', () => {
    it('should not allow assignee to finish a pending ticket directly', () => {
      expect(allowedTransition('pending', 'done', true)).to.be.false;
      expect(allowedTransition('pending', 'processing', true)).to.be.true;
    });

    it('should only allow reporter to confirm a waiting ticket', () => {
      expect(allowedTransition('waiting', 'done', false)).to.be.true;
      expect(allowedTransition('processing', 'done', false)).to.be.false;
    });

    it('should require reason when reopening a done ticket', () => {
      expect(reopenNeedsReason('done', 'processing')).to.be.true;
      expect(reopenNeedsReason('waiting', 'processing')).to.be.false;
    });
  });

  describe('时限测试', () => {
    it('should be overdue when unfinished and expectAt passed', () => {
      const now = new Date('2026-10-13T12:00:00Z');
      expect(isOverdue({ expectAt: '2026-10-13T11:00:00Z', status: 'processing' }, now)).to.be.true;
      expect(isOverdue({ expectAt: '2026-10-13T11:00:00Z', status: 'done' }, now)).to.be.false;
    });

    it('should auto close at resolveDueAt with at least 24 hours for confirmation', () => {
      const since = '2026-10-13T12:00:00Z';
      expect(autoCloseAt({ resolveDueAt: '2026-10-16T12:00:00Z' }, since).toISOString()).to.equal('2026-10-16T12:00:00.000Z');
      expect(autoCloseAt({ resolveDueAt: '2026-10-13T08:00:00Z' }, since).toISOString()).to.equal('2026-10-14T12:00:00.000Z');
      expect(autoCloseAt({ resolveDueAt: null }, since).toISOString()).to.equal('2026-10-14T12:00:00.000Z');
    });
  });

  describe('通知对象测试', () => {
    it('should exclude reporter for internal notes and the actor himself', () => {
      const ids = notifyTargetIds({
        reporterId: 'reporter',
        assigneeIds: ['assignee'],
        watcherIds: ['reporter', 'watcher'],
        actorId: 'assignee',
        includeReporter: false
      });
      expect(ids).to.deep.equal(['watcher']);
    });
  });
});
