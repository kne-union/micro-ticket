const STATUS_LABEL = {
  pending: '待受理',
  processing: '处理中',
  onHold: '已挂起',
  supplement: '要求补充信息',
  waiting: '待确认',
  done: '已完成'
};

const TRANSITIONS = {
  pending: ['processing'],
  processing: ['onHold'],
  onHold: ['processing'],
  supplement: ['processing'],
  waiting: ['done', 'processing'],
  done: ['processing']
};

const REQUESTER_TRANSITIONS = {
  waiting: ['done', 'processing'],
  done: ['processing']
};

const PRIORITIES = ['low', 'medium', 'high', 'urgent'];

const statusLabel = value => STATUS_LABEL[value] || value || '';

const allowedTransition = (from, to, asHandler) => ((asHandler ? TRANSITIONS : REQUESTER_TRANSITIONS)[from] || []).includes(to);

const reopenNeedsReason = (from, to) => from === 'done' && to === 'processing';

const isOverdue = (ticket, now = new Date()) => {
  if (!ticket?.expectAt || ticket.status === 'done') {
    return false;
  }
  const at = new Date(ticket.expectAt);
  return !Number.isNaN(at.getTime()) && at.getTime() < now.getTime();
};

const CONFIRM_GRACE_MS = 24 * 60 * 60 * 1000;

const autoCloseAt = (ticket, waitingSince) => {
  const grace = new Date(new Date(waitingSince).getTime() + CONFIRM_GRACE_MS);
  const due = ticket?.resolveDueAt ? new Date(ticket.resolveDueAt) : null;
  return due && !Number.isNaN(due.getTime()) && due > grace ? due : grace;
};

const notifyTargetIds = ({ reporterId, assigneeIds = [], watcherIds = [], extraIds = [], actorId, includeReporter = true }) => {
  const ids = new Set([...(includeReporter && reporterId ? [String(reporterId)] : []), ...assigneeIds, ...watcherIds, ...extraIds].map(id => (id == null ? '' : String(id))).filter(Boolean));
  if (!includeReporter && reporterId) {
    ids.delete(String(reporterId));
  }
  if (actorId) {
    ids.delete(String(actorId));
  }
  return [...ids];
};

module.exports = {
  STATUS_LABEL,
  TRANSITIONS,
  REQUESTER_TRANSITIONS,
  PRIORITIES,
  statusLabel,
  allowedTransition,
  reopenNeedsReason,
  isOverdue,
  autoCloseAt,
  notifyTargetIds
};
