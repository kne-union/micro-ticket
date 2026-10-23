const { expect } = require('chai');
const { addBusinessMinutes, businessMinutesBetween, statusClockPatch, dueEscalation, DEFAULT_POLICY } = require('../libs/ticket/sla');

const policy = DEFAULT_POLICY;

describe('ticket sla', () => {
  describe('营业时间计算测试', () => {
    it('should skip weekend when adding business minutes on friday evening', () => {
      const start = new Date('2026-10-16T09:00:00.000Z');
      const due = addBusinessMinutes(start, 120, policy);
      expect(due.toISOString()).to.equal('2026-10-19T02:00:00.000Z');
    });

    it('should skip holidays when adding business minutes', () => {
      const start = new Date('2026-10-16T09:00:00.000Z');
      const due = addBusinessMinutes(start, 120, { ...policy, holidays: ['2026-10-19'] });
      expect(due.toISOString()).to.equal('2026-10-20T02:00:00.000Z');
    });
  });

  describe('挂起与升级测试', () => {
    it('should extend resolveDueAt by business minutes spent on hold', () => {
      const due = new Date('2026-10-13T08:00:00.000Z');
      const patch = statusClockPatch({ slaPausedAt: '2026-10-13T01:00:00.000Z', resolveDueAt: due, priority: 'medium' }, 'onHold', 'processing', new Date('2026-10-13T03:00:00.000Z'), policy);
      expect(businessMinutesBetween('2026-10-13T01:00:00.000Z', '2026-10-13T03:00:00.000Z', policy)).to.equal(120);
      expect(patch.resolveDueAt.toISOString()).to.equal('2026-10-13T10:00:00.000Z');
      expect(patch.slaPausedAt).to.be.null;
    });

    it('should escalate only after the step waiting minutes', () => {
      const dueAt = new Date('2026-10-13T01:00:00.000Z');
      const steps = [{ tenantUserId: 'lead', afterMinutes: 60 }];
      expect(dueEscalation({ steps, level: 0, dueAt, now: new Date('2026-10-13T01:30:00.000Z'), policy })).to.be.null;
      expect(dueEscalation({ steps, level: 0, dueAt, now: new Date('2026-10-13T02:00:00.000Z'), policy }).tenantUserId).to.equal('lead');
    });
  });
});
