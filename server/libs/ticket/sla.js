const WEEKDAY = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

const DEFAULT_POLICY = {
  timezone: 'Asia/Shanghai',
  weekdays: [1, 2, 3, 4, 5],
  startTime: '09:00',
  endTime: '18:00',
  holidays: [],
  extraWorkdays: [],
  targets: {
    urgent: { responseMinutes: 30, resolveMinutes: 240 },
    high: { responseMinutes: 60, resolveMinutes: 480 },
    medium: { responseMinutes: 240, resolveMinutes: 1440 },
    low: { responseMinutes: 1440, resolveMinutes: 4320 }
  },
  escalation: []
};

const PRIORITY_KEYS = ['urgent', 'high', 'medium', 'low'];
const PAUSE_STATUSES = new Set(['onHold', 'supplement']);

const parseHm = value => {
  const matched = /^(\d{2}):(\d{2})$/.exec(String(value || ''));
  if (!matched) {
    return null;
  }
  const hour = Number(matched[1]);
  const minute = Number(matched[2]);
  if (hour > 23 || minute > 59) {
    return null;
  }
  return hour * 60 + minute;
};

const fromMinutes = total => [Math.floor(total / 60), total % 60];

const addDaysKey = (dateKey, days) => {
  const [year, month, day] = dateKey.split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  const pad = number => String(number).padStart(2, '0');
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`;
};

const zonedParts = (date, timeZone) => {
  const bag = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      weekday: 'short',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
      .formatToParts(date)
      .filter(part => part.type !== 'literal')
      .map(part => [part.type, part.value])
  );
  let hour = Number(bag.hour);
  if (hour === 24) {
    hour = 0;
  }
  return {
    year: Number(bag.year),
    month: Number(bag.month),
    day: Number(bag.day),
    hour,
    minute: Number(bag.minute),
    weekday: WEEKDAY[bag.weekday] || 1,
    dateKey: `${bag.year}-${bag.month}-${bag.day}`
  };
};

const zonedToUtc = (year, month, day, hour, minute, timeZone) => {
  let utc = Date.UTC(year, month - 1, day, hour, minute);
  for (let index = 0; index < 3; index += 1) {
    const parts = zonedParts(new Date(utc), timeZone);
    const shown = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
    utc += Date.UTC(year, month - 1, day, hour, minute) - shown;
  }
  return new Date(utc);
};

const calendarOf = policy => ({
  timezone: policy?.timezone || DEFAULT_POLICY.timezone,
  weekdays: Array.isArray(policy?.weekdays) && policy.weekdays.length ? policy.weekdays.map(Number) : DEFAULT_POLICY.weekdays,
  startTime: policy?.startTime || DEFAULT_POLICY.startTime,
  endTime: policy?.endTime || DEFAULT_POLICY.endTime,
  holidays: Array.isArray(policy?.holidays) ? policy.holidays : [],
  extraWorkdays: Array.isArray(policy?.extraWorkdays) ? policy.extraWorkdays : []
});

const isOpenDay = (dateKey, weekday, calendar) => {
  if (calendar.extraWorkdays.includes(dateKey)) {
    return true;
  }
  if (calendar.holidays.includes(dateKey)) {
    return false;
  }
  return calendar.weekdays.includes(weekday);
};

const isOpen = (date, calendar) => {
  const parts = zonedParts(date, calendar.timezone);
  const minutes = parts.hour * 60 + parts.minute;
  const start = parseHm(calendar.startTime);
  const end = parseHm(calendar.endTime);
  return isOpenDay(parts.dateKey, parts.weekday, calendar) && minutes >= start && minutes < end;
};

const atLocal = (dateKey, minutes, calendar) => {
  const [year, month, day] = dateKey.split('-').map(Number);
  const [hour, minute] = fromMinutes(minutes);
  return zonedToUtc(year, month, day, hour, minute, calendar.timezone);
};

const nextOpen = (date, calendar) => {
  const start = parseHm(calendar.startTime);
  const end = parseHm(calendar.endTime);
  let cursor = new Date(date);
  for (let guard = 0; guard < 400; guard += 1) {
    const parts = zonedParts(cursor, calendar.timezone);
    const minutes = parts.hour * 60 + parts.minute;
    if (isOpenDay(parts.dateKey, parts.weekday, calendar) && minutes < end) {
      return atLocal(parts.dateKey, Math.max(minutes, start), calendar);
    }
    cursor = atLocal(addDaysKey(parts.dateKey, 1), start, calendar);
  }
  return cursor;
};

const addBusinessMinutes = (start, amount, policy) => {
  const calendar = calendarOf(policy);
  let remaining = Math.max(0, Math.round(Number(amount) || 0));
  let cursor = nextOpen(new Date(start), calendar);
  if (!remaining) {
    return cursor;
  }
  const end = parseHm(calendar.endTime);
  for (let guard = 0; guard < 400 && remaining > 0; guard += 1) {
    const parts = zonedParts(cursor, calendar.timezone);
    const minutes = parts.hour * 60 + parts.minute;
    const room = end - minutes;
    if (!isOpen(cursor, calendar) || room <= 0) {
      cursor = nextOpen(new Date(cursor.getTime() + 60 * 1000), calendar);
      continue;
    }
    const take = Math.min(remaining, room);
    cursor = atLocal(parts.dateKey, minutes + take, calendar);
    remaining -= take;
  }
  return cursor;
};

const businessMinutesBetween = (start, end, policy) => {
  const calendar = calendarOf(policy);
  const finish = new Date(end);
  let cursor = new Date(start);
  if (!(finish > cursor)) {
    return 0;
  }
  let total = 0;
  const close = parseHm(calendar.endTime);
  const open = parseHm(calendar.startTime);
  for (let guard = 0; guard < 400 && cursor < finish; guard += 1) {
    if (!isOpen(cursor, calendar)) {
      const next = nextOpen(cursor, calendar);
      if (next <= cursor || next >= finish) {
        break;
      }
      cursor = next;
      continue;
    }
    const parts = zonedParts(cursor, calendar.timezone);
    const minutes = parts.hour * 60 + parts.minute;
    const endParts = zonedParts(finish, calendar.timezone);
    let take = close - minutes;
    if (parts.dateKey === endParts.dateKey) {
      take = Math.min(take, Math.max(0, endParts.hour * 60 + endParts.minute - minutes));
      total += take;
      break;
    }
    total += take;
    cursor = atLocal(addDaysKey(parts.dateKey, 1), open, calendar);
  }
  return total;
};

const targetOf = (policy, priority) => {
  const targets = policy?.targets || DEFAULT_POLICY.targets;
  return targets[priority] || targets.medium || DEFAULT_POLICY.targets.medium;
};

const dueDates = (start, priority, policy) => {
  const target = targetOf(policy, priority);
  return {
    responseDueAt: addBusinessMinutes(start, target.responseMinutes, policy),
    resolveDueAt: addBusinessMinutes(start, target.resolveMinutes, policy),
    escalationLevel: 0,
    responseMetAt: null,
    resolveMetAt: null,
    slaPausedAt: null
  };
};

const statusClockPatch = (ticket, from, to, now, policy) => {
  const patch = {};
  if (from === 'pending' && to !== 'pending' && !ticket.responseMetAt) {
    patch.responseMetAt = now;
    patch.escalationLevel = 0;
  }
  if (to === 'done') {
    if (!ticket.resolveMetAt) {
      patch.resolveMetAt = now;
    }
    patch.slaPausedAt = null;
    return patch;
  }
  if (from === 'done' && to !== 'done') {
    patch.resolveMetAt = null;
    patch.resolveDueAt = addBusinessMinutes(now, targetOf(policy, ticket.priority).resolveMinutes, policy);
    patch.escalationLevel = 0;
    patch.slaPausedAt = PAUSE_STATUSES.has(to) ? now : null;
    return patch;
  }
  if (!PAUSE_STATUSES.has(from) && PAUSE_STATUSES.has(to)) {
    patch.slaPausedAt = now;
  }
  if (PAUSE_STATUSES.has(from) && !PAUSE_STATUSES.has(to) && ticket.slaPausedAt) {
    const extra = businessMinutesBetween(new Date(ticket.slaPausedAt), now, policy);
    if (ticket.resolveDueAt) {
      patch.resolveDueAt = addBusinessMinutes(new Date(ticket.resolveDueAt), extra, policy);
    }
    patch.slaPausedAt = null;
  }
  return patch;
};

const dueEscalation = ({ steps, level, dueAt, now, policy }) => {
  const step = (Array.isArray(steps) ? steps : [])[level];
  if (!step || !dueAt) {
    return null;
  }
  const elapsed = businessMinutesBetween(new Date(dueAt), now, policy);
  if (elapsed < Number(step.afterMinutes || 0)) {
    return null;
  }
  return step;
};

const slaTag = (ticket, now = new Date()) => {
  if (!ticket?.responseDueAt && !ticket?.resolveDueAt) {
    return { type: 'default', text: '-' };
  }
  if (ticket.status === 'done' || ticket.resolveMetAt) {
    return { type: 'success', text: '已达成' };
  }
  if (ticket.slaPausedAt) {
    return { type: 'default', text: '已暂停' };
  }
  if (!ticket.responseMetAt && ticket.responseDueAt && new Date(ticket.responseDueAt) <= now) {
    return { type: 'danger', text: '响应超时' };
  }
  if (ticket.resolveDueAt && new Date(ticket.resolveDueAt) <= now) {
    return { type: 'danger', text: '解决超时' };
  }
  return { type: 'processing', text: '计时中' };
};

const dateList = value =>
  [...new Set(String(value || '')
    .split(/[\s,，]+/)
    .map(item => item.trim())
    .filter(Boolean))];

const normalizePolicy = body => {
  const startTime = String(body.startTime || '').trim();
  const endTime = String(body.endTime || '').trim();
  const start = parseHm(startTime);
  const end = parseHm(endTime);
  if (start == null || end == null || start >= end) {
    throw new Error('营业时间需为 HH:mm，且下班晚于上班');
  }
  const weekdays = [...new Set([].concat(body.weekdays || []).map(Number))].filter(day => day >= 1 && day <= 7).sort((a, b) => a - b);
  if (!weekdays.length) {
    throw new Error('请至少选择一个工作日');
  }
  const holidays = dateList(Array.isArray(body.holidays) ? body.holidays.join('\n') : body.holidays);
  const extraWorkdays = dateList(Array.isArray(body.extraWorkdays) ? body.extraWorkdays.join('\n') : body.extraWorkdays);
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  if ([...holidays, ...extraWorkdays].some(item => !datePattern.test(item))) {
    throw new Error('节假日和调休上班日需为 YYYY-MM-DD');
  }
  const targets = {};
  PRIORITY_KEYS.forEach(key => {
    const source = body.targets?.[key] || {};
    const responseMinutes = Math.round(Number(source.responseMinutes));
    const resolveMinutes = Math.round(Number(source.resolveMinutes));
    if (!responseMinutes || !resolveMinutes || responseMinutes < 1 || resolveMinutes < responseMinutes) {
      throw new Error('解决时限需大于等于响应时限');
    }
    targets[key] = { responseMinutes, resolveMinutes };
  });
  const escalation = [].concat(body.escalation || []).map(item => ({
    tenantUserId: String(item.tenantUserId || item.id || ''),
    afterMinutes: Math.round(Number(item.afterMinutes || 0))
  }));
  if (escalation.length > 8 || escalation.some(item => !item.tenantUserId || item.afterMinutes < 0)) {
    throw new Error('升级链最多 8 级，超时分钟数不能为负');
  }
  return {
    timezone: 'Asia/Shanghai',
    weekdays,
    startTime,
    endTime,
    holidays,
    extraWorkdays,
    targets,
    escalation
  };
};

module.exports = {
  DEFAULT_POLICY,
  PRIORITY_KEYS,
  calendarOf,
  addBusinessMinutes,
  businessMinutesBetween,
  dueDates,
  statusClockPatch,
  dueEscalation,
  slaTag,
  normalizePolicy
};
