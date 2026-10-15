const fp = require('fastify-plugin');
const { PRIORITIES, statusLabel, allowedTransition, reopenNeedsReason, isOverdue, autoCloseAt, notifyTargetIds } = require('../ticket/rules');
const { DEFAULT_POLICY, dueDates, statusClockPatch, dueEscalation, slaTag, normalizePolicy } = require('../ticket/sla');
const { COMPLETE_DEFAULTS, SUPPLEMENT_DEFAULTS, hasBlocks, LEGACY_SUPPLEMENT } = require('../ticket/complete-defaults');
const ticketPermissions = require('../permissions');

const { TICKET_PERMISSION, PRESET_ROLES } = ticketPermissions;

const httpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const toId = value => (value == null ? '' : String(value));

module.exports = fp(async fastify => {
  const { Op } = fastify.sequelize.Sequelize;

  const models = () => fastify.project.models;
  const tableNameOf = model => {
    const raw = model.getTableName();
    return typeof raw === 'string' ? raw : raw.tableName;
  };

  const tenantIdOf = actor => toId(actor.tenantId);
  const actorIdOf = actor => toId(actor.id);

    const watcherIdsOf = async (actor, ticketId) => {
      const rows = await models().ticketWatcher.findAll({
        where: { tenantId: tenantIdOf(actor), ticketId: toId(ticketId) },
        attributes: ['tenantUserId']
      });
      return rows.map(item => toId(item.tenantUserId));
    };

    const addWatchers = async (actor, ticket, userIds) => {
      const ids = [...new Set((userIds || []).map(toId).filter(Boolean))];
      if (!ids.length) {
        return;
      }
      const existing = new Set(await watcherIdsOf(actor, ticket.id));
      const fresh = ids.filter(id => !existing.has(id));
      if (!fresh.length) {
        return;
      }
      await models().ticketWatcher.bulkCreate(
        fresh.map(tenantUserId => ({
          tenantId: tenantIdOf(actor),
          ticketId: toId(ticket.id),
          tenantUserId
        }))
      );
    };

    const notifyTicket = async (actor, ticket, { title, content, extraIds = [], includeReporter = true }) => {
      const push = fastify.im?.services?.systemMessage?.pushSystemMessage;
      if (!push) {
        return;
      }
      const assigneeRows = await assigneeRowsOf(actor, [toId(ticket.id)]);
      const targets = notifyTargetIds({
        reporterId: ticket.reporterTenantUserId,
        assigneeIds: assigneeIdsOf(ticket, assigneeRows),
        watcherIds: await watcherIdsOf(actor, ticket.id),
        extraIds,
        actorId: actorIdOf(actor),
        includeReporter
      });
      if (!targets.length) {
        return;
      }
      const users = await fastify.tenant.models.tenantUser.findAll({
        where: { id: { [Op.in]: targets }, tenantId: tenantIdOf(actor) },
        attributes: ['id', 'userId']
      });
      await Promise.all(
        users
          .filter(user => user.userId)
          .map(user =>
            push({
              type: 'ticket',
              title,
              content,
              targetUserId: String(user.userId),
              props: { ticketId: toId(ticket.id), no: ticket.no }
            }).catch(error => {
              fastify.log.error({ err: error, ticketId: toId(ticket.id) }, '工单通知发送失败');
            })
          )
      );
    };

    const handlerPoolIds = async actor => {
      const roles = await fastify.tenant.models.tenantRole.findAll({
        where: { tenantId: tenantIdOf(actor), status: 'open' },
        attributes: ['id', 'type', 'code', 'permissions']
      });
      const roleIds = new Set(
        roles
          .filter(role => (role.type === 'system' && role.code === 'admin') || jsonList(role.permissions).includes(TICKET_PERMISSION.process))
          .map(item => toId(item.id))
      );
      if (!roleIds.size) {
        return [];
      }
      const users = await fastify.tenant.models.tenantUser.findAll({
        where: { tenantId: tenantIdOf(actor), status: 'open' },
        attributes: ['id', 'roles']
      });
      return users
        .filter(user => [].concat(user.roles || []).some(roleId => roleIds.has(toId(roleId))))
        .map(user => toId(user.id));
    };

  const loadUserNames = async (actor, ids) => {
    // SLA 升级事件的操作人是 'sla'，Postgres 的 bigint 列不能拿非数字去查
    const unique = [...new Set((ids || []).flatMap(id => (id == null ? [] : String(id).split(','))).map(toId).filter(id => /^\d+$/.test(id)))];
    if (!unique.length) {
      return {};
    }
    const users = await fastify.tenant.models.tenantUser.findAll({
      where: { id: { [Op.in]: unique }, tenantId: tenantIdOf(actor) },
      attributes: ['id', 'name', 'email']
    });
    return Object.fromEntries(users.map(user => [toId(user.id), user.name || user.email || toId(user.id)]));
  };

  const withPeople = (row, names) => {
    const plain = typeof row.toJSON === 'function' ? row.toJSON() : row;
    return {
      ...plain,
      reporterName: names[toId(plain.reporterTenantUserId)] || '',
      assigneeName: names[toId(plain.assigneeTenantUserId)] || '未指派'
    };
  };

  const idListOf = value =>
    [...new Set((Array.isArray(value) ? value : value ? [value] : []).map(item => toId(item && typeof item === 'object' ? item.id || item.value : item)).filter(Boolean))];

  const assigneeRowsOf = async (actor, ticketIds) => {
    if (!ticketIds.length) {
      return [];
    }
    return models().ticketAssignee.findAll({
      where: { tenantId: tenantIdOf(actor), ticketId: { [Op.in]: ticketIds } }
    });
  };

  const assigneeIdsOf = (ticket, rows) => {
    const linked = rows.filter(item => toId(item.ticketId) === toId(ticket.id)).map(item => toId(item.tenantUserId));
    if (linked.length) {
      return linked;
    }
    return ticket.assigneeTenantUserId ? [toId(ticket.assigneeTenantUserId)] : [];
  };

  const withAssignees = (row, names, rows) => {
    const plain = withPeople(row, names);
    const assigneeIds = assigneeIdsOf(plain, rows);
    return {
      ...plain,
      assigneeIds,
      assignees: assigneeIds.map(id => ({ id, name: names[id] || '' })),
      assigneeName: assigneeIds.length ? assigneeIds.map(id => names[id] || '未知').join('、') : '未指派',
      overdue: isOverdue(plain),
      sla: slaTag(plain)
    };
  };

  const replaceAssignees = async (actor, ticket, userIds) => {
    const users = userIds.length
      ? await fastify.tenant.models.tenantUser.findAll({
          where: { tenantId: tenantIdOf(actor), status: 'open', id: { [Op.in]: userIds } },
          attributes: ['id']
        })
      : [];
    const ids = users.map(user => toId(user.id));
    await models().ticketAssignee.destroy({ where: { tenantId: tenantIdOf(actor), ticketId: toId(ticket.id) } });
    if (ids.length) {
      await models().ticketAssignee.bulkCreate(
        ids.map(tenantUserId => ({
          tenantId: tenantIdOf(actor),
          ticketId: toId(ticket.id),
          tenantUserId
        }))
      );
    }
    await ticket.update({ assigneeTenantUserId: ids[0] || null });
    return ids;
  };

  const assignedToActor = async actor => {
    const rows = await models().ticketAssignee.findAll({
      where: { tenantId: tenantIdOf(actor), tenantUserId: actorIdOf(actor) },
      attributes: ['ticketId']
    });
    const ids = rows.map(item => toId(item.ticketId));
    const branches = [{ assigneeTenantUserId: actorIdOf(actor) }];
    if (ids.length) {
      branches.push({ id: { [Op.in]: ids } });
    }
    return { [Op.or]: branches };
  };

  const isTenantAdmin = async actor => {
    const roles = [].concat(actor.roles || []).filter(Boolean);
    if (!roles.length) {
      return false;
    }
    const count = await fastify.tenant.models.tenantRole.count({
      where: { id: { [Op.in]: roles }, tenantId: tenantIdOf(actor), type: 'system', code: 'admin', status: 'open' }
    });
    return count > 0;
  };

  const permissionCodesOf = actor => {
    // fastify-tenant 用 setDataValue 挂权限码，不是模型字段，直接读属性拿不到
    const permissions = (typeof actor.get === 'function' ? actor.get('permissions') : actor.permissions) || [];
    return Array.isArray(permissions) ? permissions : permissions.codes || [];
  };

  const can = async (actor, ...codes) => {
    const owned = permissionCodesOf(actor);
    return codes.some(code => owned.includes(code)) || isTenantAdmin(actor);
  };

  const assertCan = async (actor, ...codes) => {
    if (!(await can(actor, ...codes))) {
      throw httpError(403, '没有对应的工单权限');
    }
  };

  const isAssigneeOf = async (actor, ticket) => {
    const actorId = actorIdOf(actor);
    if (toId(ticket.assigneeTenantUserId) === actorId) {
      return true;
    }
    const linked = await models().ticketAssignee.count({
      where: { tenantId: tenantIdOf(actor), ticketId: toId(ticket.id), tenantUserId: actorId }
    });
    return linked > 0;
  };

  // 被指派的同事不需要处理权限也能处理自己名下的工单
  const canProcess = async (actor, ticket) => (await can(actor, TICKET_PERMISSION.process)) || isAssigneeOf(actor, ticket);

  const assertProcess = async (actor, ticket) => {
    if (!(await canProcess(actor, ticket))) {
      throw httpError(403, '没有处理这张工单的权限');
    }
  };

  const jsonList = value => {
    if (Array.isArray(value)) {
      return value;
    }
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
      } catch (error) {
        return [];
      }
    }
    return [];
  };

  const policyFor = async tenantId => {
    const row = await models().ticketSla.findOne({ where: { tenantId: toId(tenantId) } });
    if (!row) {
      return { ...DEFAULT_POLICY, targets: { ...DEFAULT_POLICY.targets } };
    }
    const plain = row.toJSON();
    let targets = plain.targets;
    if (typeof targets === 'string') {
      try {
        targets = JSON.parse(targets || '{}');
      } catch (error) {
        targets = {};
      }
    }
    return {
      ...DEFAULT_POLICY,
      timezone: plain.timezone || DEFAULT_POLICY.timezone,
      weekdays: jsonList(plain.weekdays).length ? jsonList(plain.weekdays) : DEFAULT_POLICY.weekdays,
      startTime: plain.startTime || DEFAULT_POLICY.startTime,
      endTime: plain.endTime || DEFAULT_POLICY.endTime,
      holidays: jsonList(plain.holidays),
      extraWorkdays: jsonList(plain.extraWorkdays),
      targets: targets && typeof targets === 'object' ? { ...DEFAULT_POLICY.targets, ...targets } : DEFAULT_POLICY.targets,
      escalation: jsonList(plain.escalation)
    };
  };

  const moveClock = async (ticket, from, to) => {
    const patch = statusClockPatch(ticket, from, to, new Date(), await policyFor(ticket.tenantId));
    if (Object.keys(patch).length) {
      await ticket.update(patch);
    }
  };

  const loadTicket = async (actor, id, { asHandler }) => {
    const ticket = await models().ticket.findOne({
      where: { id: toId(id), tenantId: tenantIdOf(actor) }
    });
    if (!ticket) {
      throw httpError(404, '工单不存在');
    }
    if (asHandler) {
      if (!(await can(actor, TICKET_PERMISSION.process, TICKET_PERMISSION.viewAll)) && !(await isAssigneeOf(actor, ticket))) {
        throw httpError(403, '没有查看这张工单的权限');
      }
      return ticket;
    }
    const actorId = actorIdOf(actor);
    const visible =
      toId(ticket.reporterTenantUserId) === actorId ||
      (await isAssigneeOf(actor, ticket)) ||
      (await watcherIdsOf(actor, ticket.id)).includes(actorId) ||
      (await can(actor, TICKET_PERMISSION.process, TICKET_PERMISSION.viewAll));
    if (!visible) {
      throw httpError(403, '只能查看自己发起、指派给自己或关注的工单');
    }
    return ticket;
  };

  const listTemplates = async (actor, { enabledOnly }) => {
    const where = { tenantId: tenantIdOf(actor) };
    if (enabledOnly) {
      where.enabled = true;
    }
    const rows = await models().ticketTemplate.findAll({
      where,
      order: [['updatedAt', 'DESC']]
    });
    if (!enabledOnly) {
      return rows;
    }
    const bases = await models().ticketBaseTemplate.findAll({
      where: { enabled: true, builtin: true },
      order: [['name', 'ASC']]
    });
    return [
      ...bases.map(item => ({
        ...item.toJSON(),
        builtin: true,
        readonly: true,
        parentId: null
      })),
      ...rows.map(item => (typeof item.toJSON === 'function' ? item.toJSON() : item))
    ];
  };

  const saveTemplate = async (actor, body) => {
    await assertCan(actor, TICKET_PERMISSION.templateEdit);
    const name = String(body.name || '').trim();
    if (!name) {
      throw httpError(400, '请填写模板名称');
    }
    const payload = {
      name,
      description: body.description || '',
      enabled: body.enabled !== false,
      schema: body.schema && typeof body.schema === 'object' ? body.schema : {},
      parentId: body.parentId == null || body.parentId === '' ? null : String(body.parentId)
    };
    if (body.id) {
      const locked = await models().ticketBaseTemplate.findOne({
        where: { id: toId(body.id), builtin: true }
      });
      if (locked) {
        throw httpError(400, '系统问卷不可修改');
      }
      const record = await models().ticketTemplate.findOne({
        where: { id: toId(body.id), tenantId: tenantIdOf(actor) }
      });
      if (!record) {
        throw httpError(404, '模板不存在');
      }
      await record.update(payload);
      return record;
    }
    return models().ticketTemplate.create({
      ...payload,
      tenantId: tenantIdOf(actor)
    });
  };

  const removeTemplate = async (actor, { id }) => {
    await assertCan(actor, TICKET_PERMISSION.templateEdit);
    const locked = await models().ticketBaseTemplate.findOne({
      where: { id: toId(id), builtin: true }
    });
    if (locked) {
      throw httpError(400, '系统问卷不可删除');
    }
    const record = await models().ticketTemplate.findOne({
      where: { id: toId(id), tenantId: tenantIdOf(actor) }
    });
    if (!record) {
      throw httpError(404, '模板不存在');
    }
    await record.destroy();
    return {};
  };

  const importBaseTemplate = async (actor, { id }) => {
    await assertCan(actor, TICKET_PERMISSION.templateEdit);
    const base = await models().ticketBaseTemplate.findOne({
      where: { id: toId(id), enabled: true }
    });
    if (!base) {
      throw httpError(404, '公共模板不存在或已停用');
    }
    return models().ticketTemplate.create({
      tenantId: tenantIdOf(actor),
      name: base.name,
      description: base.description || '',
      enabled: true,
      schema: base.schema || {},
      parentId: null
    });
  };

  const listFormLibrary = async actor => {
    return models().formLibraryTemplate.findAll({
      where: { tenantId: tenantIdOf(actor) },
      order: [['updatedAt', 'DESC']]
    });
  };

  const saveFormLibrary = async (actor, body) => {
    await assertCan(actor, TICKET_PERMISSION.templateEdit);
    const name = String(body.name || '').trim();
    if (!name) {
      throw httpError(400, '请填写模板名称');
    }
    const payload = {
      name,
      schema: body.schema && typeof body.schema === 'object' ? body.schema : {},
      parentId: body.parentId == null || body.parentId === '' ? null : String(body.parentId)
    };
    if (body.id) {
      const record = await models().formLibraryTemplate.findOne({
        where: { id: toId(body.id), tenantId: tenantIdOf(actor) }
      });
      if (!record) {
        throw httpError(404, '表单片段不存在');
      }
      await record.update(payload);
      return record;
    }
    return models().formLibraryTemplate.create({
      ...payload,
      tenantId: tenantIdOf(actor)
    });
  };

  const listCompleteTemplates = async (actor, { enabledOnly, usage } = {}) => {
    await ensureTenantCompleteDefaults(tenantIdOf(actor));
    const where = { tenantId: tenantIdOf(actor) };
    if (enabledOnly) {
      where.enabled = true;
    }
    if (usage === 'supplement') {
      where.usage = 'supplement';
    } else if (usage === 'complete') {
      where.usage = { [Op.or]: ['complete', null] };
    }
    return models().ticketCompleteTemplate.findAll({ where, order: [['updatedAt', 'DESC']] });
  };

  const saveCompleteTemplate = async (actor, body) => {
    await assertCan(actor, TICKET_PERMISSION.templateEdit);
    const name = String(body.name || '').trim();
    if (!name) {
      throw httpError(400, '请填写模板名称');
    }
    const payload = {
      name,
      description: body.description || '',
      enabled: body.enabled !== false,
      schema: body.schema && typeof body.schema === 'object' ? body.schema : {},
      parentId: body.parentId == null || body.parentId === '' ? null : String(body.parentId),
      usage: body.usage === 'supplement' ? 'supplement' : 'complete'
    };
    if (body.id) {
      const record = await models().ticketCompleteTemplate.findOne({ where: { id: toId(body.id), tenantId: tenantIdOf(actor) } });
      if (!record) {
        throw httpError(404, '完成模板不存在');
      }
      await record.update(payload);
      return record;
    }
    return models().ticketCompleteTemplate.create({ ...payload, tenantId: tenantIdOf(actor) });
  };

  const listCompleteLibrary = async actor => {
    return models().ticketCompleteLibrary.findAll({
      where: { tenantId: tenantIdOf(actor) },
      order: [['updatedAt', 'DESC']]
    });
  };

  const saveCompleteLibrary = async (actor, body) => {
    await assertCan(actor, TICKET_PERMISSION.templateEdit);
    const name = String(body.name || '').trim();
    if (!name) {
      throw httpError(400, '请填写模板名称');
    }
    const payload = {
      name,
      schema: body.schema && typeof body.schema === 'object' ? body.schema : {},
      parentId: body.parentId == null || body.parentId === '' ? null : String(body.parentId)
    };
    if (body.id) {
      const record = await models().ticketCompleteLibrary.findOne({ where: { id: toId(body.id), tenantId: tenantIdOf(actor) } });
      if (!record) {
        throw httpError(404, '表单片段不存在');
      }
      await record.update(payload);
      return record;
    }
    return models().ticketCompleteLibrary.create({ ...payload, tenantId: tenantIdOf(actor) });
  };

  const completeTicket = async (actor, body) => {
    const ticket = await loadTicket(actor, body.id, { asHandler: true });
    await assertProcess(actor, ticket);
    if (ticket.status !== 'processing') {
      throw httpError(400, '只有处理中的工单可以完成');
    }
    const templateId = body.templateId ? toId(body.templateId) : '';
    let template = null;
    if (templateId) {
      template = await models().ticketCompleteTemplate.findOne({
        where: { id: templateId, tenantId: tenantIdOf(actor), enabled: true }
      });
      if (!template || template.usage === 'supplement') {
        throw httpError(400, '请选择启用中的完成模板');
      }
    }
    const note = String(body.note || '').trim();
    if (!template && !note) {
      throw httpError(400, '请填写完成说明');
    }
    const payload = {
      templateId: template ? toId(template.id) : null,
      templateName: template ? template.name : '',
      schemaSnapshot: template ? template.schema || {} : {},
      answers: template && body.answers && typeof body.answers === 'object' ? body.answers : {},
      note: template ? '' : note
    };
    const existing = await models().ticketCompletion.findOne({
      where: { ticketId: toId(ticket.id), tenantId: tenantIdOf(actor) }
    });
    const completion = existing
      ? await existing.update(payload)
      : await models().ticketCompletion.create({ ...payload, tenantId: tenantIdOf(actor), ticketId: toId(ticket.id) });
    const fromStatus = ticket.status;
    await ticket.update({ status: 'waiting' });
    await moveClock(ticket, fromStatus, 'waiting');
    await models().ticketEvent.create({
      tenantId: tenantIdOf(actor),
      ticketId: toId(ticket.id),
      type: 'status',
      fromValue: fromStatus,
      toValue: 'waiting',
      operatorTenantUserId: actorIdOf(actor)
    });
    await notifyTicket(actor, ticket, {
      title: `工单 ${ticket.no} 待确认`,
      content: ticket.title,
      includeReporter: true
    });
    return { ticket, completion };
  };

  const requestInfo = async (actor, body) => {
    const ticket = await loadTicket(actor, body.id, { asHandler: true });
    await assertProcess(actor, ticket);
    if (!['processing', 'onHold'].includes(ticket.status)) {
      throw httpError(400, '只有处理中或已挂起的工单可以要求补充信息');
    }
    const templateId = body.templateId ? toId(body.templateId) : '';
    let template = null;
    if (templateId) {
      template = await models().ticketCompleteTemplate.findOne({
        where: { id: templateId, tenantId: tenantIdOf(actor), enabled: true }
      });
      if (!template || template.usage !== 'supplement') {
        throw httpError(400, '请选择启用中的补充模板');
      }
    }
    const payload = {
      templateId: template ? toId(template.id) : null,
      templateName: template ? template.name : '',
      schemaSnapshot: template ? template.schema || {} : {},
      answers: {},
      note: '',
      submitted: false
    };
    const existing = await models().ticketSupplement.findOne({
      where: { ticketId: toId(ticket.id), tenantId: tenantIdOf(actor) }
    });
    const supplement = existing
      ? await existing.update(payload)
      : await models().ticketSupplement.create({ ...payload, tenantId: tenantIdOf(actor), ticketId: toId(ticket.id) });
    const fromStatus = ticket.status;
    await ticket.update({ status: 'supplement' });
    await moveClock(ticket, fromStatus, 'supplement');
    await models().ticketEvent.create({
      tenantId: tenantIdOf(actor),
      ticketId: toId(ticket.id),
      type: 'status',
      fromValue: fromStatus,
      toValue: 'supplement',
      operatorTenantUserId: actorIdOf(actor)
    });
    await notifyTicket(actor, ticket, {
      title: `工单 ${ticket.no} 要求补充信息`,
      content: template ? `请按「${template.name}」补充` : '请补充说明',
      includeReporter: true
    });
    return { ticket, supplement };
  };

  const submitInfo = async (actor, body) => {
    const ticket = await loadTicket(actor, body.id, { asHandler: false });
    if (toId(ticket.reporterTenantUserId) !== actorIdOf(actor)) {
      throw httpError(403, '只有提单人可以提交补充信息');
    }
    if (ticket.status !== 'supplement') {
      throw httpError(400, '当前工单不需要补充信息');
    }
    const supplement = await models().ticketSupplement.findOne({
      where: { ticketId: toId(ticket.id), tenantId: tenantIdOf(actor) }
    });
    if (!supplement) {
      throw httpError(400, '没有待补充的内容');
    }
    const note = String(body.note || '').trim();
    const answers = body.answers && typeof body.answers === 'object' ? body.answers : {};
    if (supplement.templateId) {
      if (!Object.keys(answers).length) {
        throw httpError(400, '请填写补充内容');
      }
    } else if (!note) {
      throw httpError(400, '请填写补充说明');
    }
    await supplement.update({
      answers: supplement.templateId ? answers : {},
      note: supplement.templateId ? '' : note,
      submitted: true
    });
    await ticket.update({ status: 'processing' });
    await moveClock(ticket, 'supplement', 'processing');
    await models().ticketEvent.create({
      tenantId: tenantIdOf(actor),
      ticketId: toId(ticket.id),
      type: 'status',
      fromValue: 'supplement',
      toValue: 'processing',
      operatorTenantUserId: actorIdOf(actor)
    });
    await notifyTicket(actor, ticket, {
      title: `工单 ${ticket.no} 已补充信息`,
      content: ticket.title,
      includeReporter: false
    });
    return { ticket, supplement };
  };

  const setTemplateEnabled = async (actor, { id, enabled }) => {
    await assertCan(actor, TICKET_PERMISSION.templateEdit);
    const record = await models().ticketTemplate.findOne({
      where: { id: toId(id), tenantId: tenantIdOf(actor) }
    });
    if (!record) {
      throw httpError(404, '模板不存在');
    }
    await record.update({ enabled: !!enabled });
    return record;
  };

  const listTickets = async (actor, query, { asHandler }) => {
    if (asHandler) {
      await assertCan(actor, TICKET_PERMISSION.process, TICKET_PERMISSION.viewAll);
    }
    const currentPage = Number(query.currentPage) || 1;
    const perPage = Math.min(Number(query.perPage) || 20, 100);
    const where = { tenantId: tenantIdOf(actor) };
    if (!asHandler) {
      if (query.scope === 'assigned') {
        Object.assign(where, await assignedToActor(actor));
      } else if (query.scope === 'all') {
        const assigned = await assignedToActor(actor);
        Object.assign(where, {
          [Op.or]: [{ reporterTenantUserId: actorIdOf(actor) }, ...assigned[Op.or]]
        });
      } else {
        where.reporterTenantUserId = actorIdOf(actor);
      }
    } else if (query.scope === 'unassigned') {
      where.assigneeTenantUserId = null;
    } else if (query.scope === 'mine') {
      Object.assign(where, await assignedToActor(actor));
    }
    if (query.status) {
      const statuses = String(query.status)
        .split(',')
        .map(item => item.trim())
        .filter(Boolean);
      where.status = statuses.length > 1 ? { [Op.in]: statuses } : statuses[0];
    }
    if (query.priority) {
      where.priority = query.priority;
    }
    if (query.templateId) {
      where.templateId = toId(query.templateId);
    }
    if (query.keyword) {
      where.title = { [Op.like]: `%${String(query.keyword).trim()}%` };
    }
    const { rows, count } = await models().ticket.findAndCountAll({
      where,
      order: [
        [fastify.sequelize.Sequelize.literal(`CASE WHEN expect_at IS NOT NULL AND status != 'done' AND expect_at < CURRENT_TIMESTAMP THEN 0 ELSE 1 END`), 'ASC'],
        [fastify.sequelize.Sequelize.literal(`CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END`), 'ASC'],
        ['createdAt', 'DESC']
      ],
      limit: perPage,
      offset: (currentPage - 1) * perPage
    });
    const assigneeRows = await assigneeRowsOf(
      actor,
      rows.map(row => toId(row.id))
    );
    const names = await loadUserNames(
      actor,
      rows.flatMap(row => [row.reporterTenantUserId, row.assigneeTenantUserId, ...assigneeIdsOf(row, assigneeRows)])
    );
    return {
      pageData: rows.map(row => withAssignees(row, names, assigneeRows)),
      totalCount: count
    };
  };

  const createTicket = async (actor, body) => {
    const templateId = toId(body.templateId);
    let template = await models().ticketTemplate.findOne({
      where: { id: templateId, tenantId: tenantIdOf(actor), enabled: true }
    });
    if (!template) {
      template = await models().ticketBaseTemplate.findOne({
        where: { id: templateId, enabled: true, builtin: true }
      });
    }
    if (!template) {
      throw httpError(400, '请选择启用中的工单模板');
    }
    const title = String(body.title || '').trim();
    if (!title) {
      throw httpError(400, '请填写标题');
    }
    const priority = PRIORITIES.includes(body.priority) ? body.priority : 'medium';
    const base = {
      tenantId: tenantIdOf(actor),
      title,
      templateId: toId(template.id),
      templateName: template.name,
      priority,
      status: 'pending',
      reporterTenantUserId: actorIdOf(actor),
      expectAt: body.expectAt || null,
      schemaSnapshot: template.schema || {},
      answers: body.answers && typeof body.answers === 'object' ? body.answers : {},
      attachmentIds: Array.isArray(body.attachmentIds) ? body.attachmentIds.map(toId) : [],
      ...dueDates(new Date(), priority, await policyFor(tenantIdOf(actor)))
    };
    let ticket;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const maxSeq = await models().ticket.max('seq', { where: { tenantId: tenantIdOf(actor) } });
      const seq = (Number(maxSeq) || 1000) + 1;
      try {
        ticket = await models().ticket.create({ ...base, seq, no: `T-${seq}` });
        break;
      } catch (error) {
        const unique = error?.name === 'SequelizeUniqueConstraintError' || /UNIQUE/i.test(error?.message || '');
        if (!unique || attempt === 2) {
          throw error;
        }
      }
    }
    const assigneeIds = await replaceAssignees(actor, ticket, idListOf(body.assigneeIds));
    await addWatchers(actor, ticket, assigneeIds);
    const notifyIds = assigneeIds.length ? assigneeIds : await handlerPoolIds(actor);
    await notifyTicket(actor, ticket, {
      title: `工单 ${ticket.no} 待受理`,
      content: ticket.title,
      extraIds: notifyIds,
      includeReporter: false
    });
    return ticket;
  };

  const detail = async (actor, id, { asHandler }) => {
    const ticket = await loadTicket(actor, id, { asHandler });
    const commentWhere = { ticketId: toId(ticket.id) };
    if (!asHandler) {
      commentWhere.internal = false;
    }
    const [comments, events, completion, supplement] = await Promise.all([
      models().ticketComment.findAll({ where: commentWhere, order: [['createdAt', 'ASC']] }),
      models().ticketEvent.findAll({ where: { ticketId: toId(ticket.id) }, order: [['createdAt', 'ASC']] }),
      models().ticketCompletion.findOne({ where: { ticketId: toId(ticket.id), tenantId: tenantIdOf(actor) } }),
      models().ticketSupplement.findOne({ where: { ticketId: toId(ticket.id), tenantId: tenantIdOf(actor) } })
    ]);
    const mentionRows = comments.length
      ? await models().ticketCommentMention.findAll({
          where: { tenantId: tenantIdOf(actor), commentId: { [Op.in]: comments.map(item => toId(item.id)) } }
        })
      : [];
    const mentionIdsByComment = mentionRows.reduce((result, item) => {
      const commentId = toId(item.commentId);
      result[commentId] = result[commentId] || [];
      result[commentId].push(toId(item.tenantUserId));
      return result;
    }, {});
    const assigneeRows = await assigneeRowsOf(actor, [toId(ticket.id)]);
    const names = await loadUserNames(actor, [
      ticket.reporterTenantUserId,
      ticket.assigneeTenantUserId,
      ...assigneeIdsOf(ticket, assigneeRows),
      ...comments.map(item => item.authorTenantUserId),
      ...mentionRows.map(item => item.tenantUserId),
      ...events.flatMap(item => [item.operatorTenantUserId, item.type === 'assign' || item.type === 'sla' ? item.fromValue : '', item.type === 'assign' || item.type === 'sla' ? item.toValue : ''])
    ]);
    const nameList = value => {
      const ids = String(value || '')
        .split(',')
        .map(item => toId(item))
        .filter(Boolean);
      if (!ids.length) {
        return '未指派';
      }
      return ids.map(id => names[id] || '未知').join('、');
    };
    return {
      ticket: withAssignees(ticket, names, assigneeRows),
      comments: comments.map(item => {
        const plain = item.toJSON();
        const mentionIds = mentionIdsByComment[toId(plain.id)] || [];
        return {
          ...plain,
          authorName: names[toId(plain.authorTenantUserId)] || '未知',
          mentionNames: mentionIds.map(userId => names[userId]).filter(Boolean)
        };
      }),
      events: events.map(item => {
        const plain = item.toJSON();
        return {
          ...plain,
          operatorName: names[toId(plain.operatorTenantUserId)] || '',
          fromName: plain.type === 'assign' ? nameList(plain.fromValue) : plain.type === 'sla' ? (plain.fromValue === 'response' ? '响应' : '解决') : statusLabel(plain.fromValue),
          toName: plain.type === 'assign' ? nameList(plain.toValue) : plain.type === 'sla' ? names[toId(plain.toValue)] || '' : statusLabel(plain.toValue)
        };
      }),
      completion: completion ? completion.toJSON() : null,
      supplement: supplement ? supplement.toJSON() : null,
      canProcess: await canProcess(actor, ticket),
      canAssign: await can(actor, TICKET_PERMISSION.assign),
      canEditTemplate: await can(actor, TICKET_PERMISSION.templateEdit),
      watching: (await watcherIdsOf(actor, ticket.id)).includes(actorIdOf(actor))
    };
  };

  const changeStatus = async (actor, { id, status, note }, { asHandler }) => {
    const ticket = await loadTicket(actor, id, { asHandler });
    if (asHandler) {
      await assertProcess(actor, ticket);
    } else if (toId(ticket.reporterTenantUserId) !== actorIdOf(actor)) {
      throw httpError(403, '只有发起人可以确认、退回或重开工单');
    }
    if (!allowedTransition(ticket.status, status, asHandler)) {
      throw httpError(400, '当前状态不能这样变更');
    }
    if (!asHandler && status === 'done' && ticket.status !== 'waiting') {
      throw httpError(400, '只有待确认的工单可以确认完成');
    }
    const reason = String(note || '').trim();
    if (reopenNeedsReason(ticket.status, status) && !reason) {
      throw httpError(400, '请填写重开原因');
    }
    const fromValue = ticket.status;
    await ticket.update({ status });
    await moveClock(ticket, fromValue, status);
    if (reason && reopenNeedsReason(fromValue, status)) {
      await models().ticketComment.create({
        tenantId: tenantIdOf(actor),
        ticketId: toId(ticket.id),
        authorTenantUserId: actorIdOf(actor),
        content: `重开原因：${reason}`,
        internal: false
      });
    }
    await models().ticketEvent.create({
      tenantId: tenantIdOf(actor),
      ticketId: toId(ticket.id),
      type: 'status',
      fromValue,
      toValue: status,
      operatorTenantUserId: actorIdOf(actor)
    });
    await notifyTicket(actor, ticket, {
      title: `工单 ${ticket.no} ${statusLabel(status)}`,
      content: `${ticket.title}`,
      includeReporter: true
    });
    return ticket;
  };

  const accept = async (actor, { id }) => {
    const ticket = await loadTicket(actor, id, { asHandler: true });
    await assertProcess(actor, ticket);
    if (ticket.status !== 'pending') {
      throw httpError(400, '只有待受理工单可以受理');
    }
    const currentIds = assigneeIdsOf(ticket, await assigneeRowsOf(actor, [toId(ticket.id)]));
    await ticket.update({ status: 'processing' });
    await moveClock(ticket, 'pending', 'processing');
    if (!currentIds.length) {
      await replaceAssignees(actor, ticket, [actorIdOf(actor)]);
    }
    await models().ticketEvent.create({
      tenantId: tenantIdOf(actor),
      ticketId: toId(ticket.id),
      type: 'status',
      fromValue: 'pending',
      toValue: 'processing',
      operatorTenantUserId: actorIdOf(actor)
    });
    if (!currentIds.length) {
      await models().ticketEvent.create({
        tenantId: tenantIdOf(actor),
        ticketId: toId(ticket.id),
        type: 'assign',
        fromValue: '',
        toValue: actorIdOf(actor),
        operatorTenantUserId: actorIdOf(actor)
      });
    }
    await addWatchers(actor, ticket, [actorIdOf(actor)]);
    await notifyTicket(actor, ticket, {
      title: `工单 ${ticket.no} 已受理`,
      content: ticket.title,
      includeReporter: true
    });
    return ticket;
  };

  const assign = async (actor, { id, assigneeIds, assigneeTenantUserId }, { asHandler = false } = {}) => {
    await assertCan(actor, TICKET_PERMISSION.assign);
    const ticket = await loadTicket(actor, id, { asHandler: false });
    if (['waiting', 'done'].includes(ticket.status)) {
      throw httpError(400, '待确认和已完成的工单不能修改处理人');
    }
    const requested = idListOf(assigneeIds && assigneeIds.length ? assigneeIds : assigneeTenantUserId);
    if (!requested.length) {
      throw httpError(400, '请选择处理人');
    }
    const fromIds = assigneeIdsOf(ticket, await assigneeRowsOf(actor, [toId(ticket.id)]));
    const nextIds = await replaceAssignees(actor, ticket, requested);
    if (!nextIds.length) {
      throw httpError(400, '请选择本租户内的处理人');
    }
    const fromStatus = ticket.status;
    if (asHandler && fromStatus === 'pending' && nextIds.length) {
      await ticket.update({ status: 'processing' });
      await moveClock(ticket, 'pending', 'processing');
      await models().ticketEvent.create({
        tenantId: tenantIdOf(actor),
        ticketId: toId(ticket.id),
        type: 'status',
        fromValue: 'pending',
        toValue: 'processing',
        operatorTenantUserId: actorIdOf(actor)
      });
    }
    await models().ticketEvent.create({
      tenantId: tenantIdOf(actor),
      ticketId: toId(ticket.id),
      type: 'assign',
      fromValue: fromIds.join(','),
      toValue: nextIds.join(','),
      operatorTenantUserId: actorIdOf(actor)
    });
    await addWatchers(actor, ticket, nextIds);
    await notifyTicket(actor, ticket, {
      title: `工单 ${ticket.no} 处理人变更`,
      content: ticket.title,
      extraIds: nextIds,
      includeReporter: true
    });
    return ticket;
  };

  const comment = async (actor, { id, content, internal, mentionIds }, { asHandler }) => {
    const ticket = await loadTicket(actor, id, { asHandler });
    const text = String(content || '').trim();
    if (!text) {
      throw httpError(400, '请填写评论');
    }
    if (internal && !asHandler) {
      throw httpError(403, '不能发表内部备注');
    }
    const requestedIds = [...new Set((Array.isArray(mentionIds) ? mentionIds : []).map(item => toId(item && typeof item === 'object' ? item.id || item.value : item)).filter(Boolean))];
    const mentionUsers = requestedIds.length
      ? await fastify.tenant.models.tenantUser.findAll({
          where: { tenantId: tenantIdOf(actor), status: 'open', id: { [Op.in]: requestedIds } },
          attributes: ['id']
        })
      : [];
    const record = await models().ticketComment.create({
      tenantId: tenantIdOf(actor),
      ticketId: toId(ticket.id),
      authorTenantUserId: actorIdOf(actor),
      content: text,
      internal: !!(asHandler && internal)
    });
    if (mentionUsers.length) {
      await models().ticketCommentMention.bulkCreate(
        mentionUsers.map(user => ({
          tenantId: tenantIdOf(actor),
          commentId: toId(record.id),
          tenantUserId: toId(user.id)
        }))
      );
    }
    await notifyTicket(actor, ticket, {
      title: `工单 ${ticket.no} 有新评论`,
      content: text,
      extraIds: mentionUsers.map(user => toId(user.id)),
      includeReporter: !(asHandler && internal)
    });
    return record;
  };

  const openColleagueChat = async (actor, { tenantUserId }, accountUserId) => {
    const target = await fastify.tenant.models.tenantUser.findOne({
      where: { id: toId(tenantUserId), tenantId: tenantIdOf(actor), status: 'open' },
      attributes: ['id', 'userId', 'name']
    });
    if (!target?.userId) {
      throw httpError(400, '对方还不能收消息');
    }
    if (String(target.userId) === String(accountUserId)) {
      throw httpError(400, '不能和自己聊天');
    }
    if (!fastify.im?.services?.conversation?.createSingleConversation) {
      throw httpError(500, '即时通讯未启用');
    }
    const conversation = await fastify.im.services.conversation.createSingleConversation(String(accountUserId), String(target.userId));
    return { conversation };
  };

  const listMentionUsers = async actor => {
    return fastify.tenant.models.tenantUser.findAll({
      where: { tenantId: tenantIdOf(actor), status: 'open' },
      attributes: ['id', 'name', 'email', 'userId']
    });
  };

  const summary = async actor => {
    const tenantId = tenantIdOf(actor);
    const actorId = actorIdOf(actor);
    const assigned = await assignedToActor(actor);
    const count = where => models().ticket.count({ where: { tenantId, ...where } });
    const [assignedOpen, createdOpen, waitingConfirm, done] = await Promise.all([
      count({ ...assigned, status: { [Op.in]: ['pending', 'processing', 'onHold', 'supplement'] } }),
      count({ reporterTenantUserId: actorId, status: { [Op.ne]: 'done' } }),
      count({ reporterTenantUserId: actorId, status: 'waiting' }),
      count({ status: 'done', [Op.or]: [{ reporterTenantUserId: actorId }, ...assigned[Op.or]] })
    ]);
    return { assignedOpen, createdOpen, waitingConfirm, done };
  };

  const watch = async (actor, { id }) => {
    const ticket = await loadTicket(actor, id, { asHandler: false });
    await addWatchers(actor, ticket, [actorIdOf(actor)]);
    return { watching: true };
  };

  const unwatch = async (actor, { id }) => {
    await models().ticketWatcher.destroy({
      where: { tenantId: tenantIdOf(actor), ticketId: toId(id), tenantUserId: actorIdOf(actor) }
    });
    return { watching: false };
  };

  const ensureColumns = async () => {
    const qi = fastify.sequelize.instance.getQueryInterface();
    const completeTable = tableNameOf(models().ticketCompleteTemplate);
    const ticketTable = tableNameOf(models().ticket);
    let desc;
    try {
      desc = await qi.describeTable(completeTable);
    } catch (error) {
      desc = null;
    }
    if (desc && !desc.usage) {
      await qi.addColumn(completeTable, 'usage', {
        type: fastify.sequelize.Sequelize.DataTypes.STRING,
        allowNull: false,
        defaultValue: 'complete'
      });
      await fastify.sequelize.instance.query(
        `UPDATE "${completeTable}" SET usage = 'complete' WHERE usage IS NULL OR usage = ''`
      );
    }
    let ticketDesc;
    try {
      ticketDesc = await qi.describeTable(ticketTable);
    } catch (error) {
      ticketDesc = null;
    }
    if (ticketDesc) {
      const { DataTypes } = fastify.sequelize.Sequelize;
      const columns = {
        response_due_at: { type: DataTypes.DATE, allowNull: true },
        resolve_due_at: { type: DataTypes.DATE, allowNull: true },
        response_met_at: { type: DataTypes.DATE, allowNull: true },
        resolve_met_at: { type: DataTypes.DATE, allowNull: true },
        sla_paused_at: { type: DataTypes.DATE, allowNull: true },
        escalation_level: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }
      };
      for (const [name, spec] of Object.entries(columns)) {
        if (!ticketDesc[name]) {
          await qi.addColumn(ticketTable, name, spec);
        }
      }
    }
    const missing = await models().ticket.findAll({ where: { responseDueAt: null, status: { [Op.ne]: 'done' } } });
    for (const ticket of missing) {
      const clock = dueDates(ticket.createdAt || new Date(), ticket.priority, await policyFor(ticket.tenantId));
      await ticket.update({ responseDueAt: clock.responseDueAt, resolveDueAt: clock.resolveDueAt });
    }
    await ensureCompleteDefaults();
  };

  const ensureCompleteDefaults = async () => {
    const tenantModel = fastify.tenant?.models?.tenant;
    if (!tenantModel) {
      return;
    }
    const tenantTable = tableNameOf(tenantModel);
    const [tenants] = await fastify.sequelize.instance.query(`SELECT id FROM "${tenantTable}"`);
    for (const tenant of tenants) {
      const tenantId = toId(tenant.id);
      await ensureTenantCompleteDefaults(tenantId);
      await ensureTicketPermissions(tenantId);
    }
  };

  // 启动时只补已有租户，运行期间新开的租户在首次查模板时补默认模板
  const seededTenants = new Map();
  const ensureTenantCompleteDefaults = tenantId => {
    if (!seededTenants.has(tenantId)) {
      const seeding = seedCompleteDefaults(tenantId).catch(error => {
        seededTenants.delete(tenantId);
        throw error;
      });
      seededTenants.set(tenantId, seeding);
    }
    return seededTenants.get(tenantId);
  };

  const seedCompleteDefaults = async tenantId => {
    const template = models().ticketCompleteTemplate;
    for (const [usage, defaults] of [
      ['complete', COMPLETE_DEFAULTS],
      ['supplement', SUPPLEMENT_DEFAULTS]
    ]) {
      for (const item of defaults) {
        const existing = await template.findOne({ where: { tenantId, name: item.name, usage } });
        if (!existing) {
          await template.create({
            tenantId,
            name: item.name,
            description: item.description,
            enabled: true,
            usage,
            schema: item.schema
          });
        }
      }
    }
    const legacy = await template.findOne({ where: { tenantId, name: LEGACY_SUPPLEMENT.name, usage: 'complete' } });
    if (legacy && !hasBlocks(legacy.schema)) {
      await legacy.update({ schema: LEGACY_SUPPLEMENT.schema });
    }
  };

  // 租户可用权限码在开通时就固定了，老租户要补上工单权限码，否则角色里勾了也会被过滤掉
  const ensureTicketPermissions = async tenantId => {
    const ticketCodes = fastify.tenant.utils.flattenPermissions(ticketPermissions).map(item => item.code);
    const setting = await fastify.tenant.services.setting.detail({ tenantId });
    const current = jsonList(setting.permissions);
    const missing = ticketCodes.filter(code => !current.includes(code));
    if (missing.length) {
      await fastify.tenant.services.setting.savePermissions({ tenantId, permissions: [...current, ...missing] });
    }
    for (const preset of PRESET_ROLES) {
      const existing = await fastify.tenant.models.tenantRole.findOne({ where: { tenantId, code: preset.code } });
      if (!existing) {
        await fastify.tenant.models.tenantRole.create({
          tenantId,
          name: preset.name,
          code: preset.code,
          type: 'custom',
          description: preset.description,
          permissions: preset.permissions
        });
      }
    }
  };

  const getSla = async actor => {
    await assertCan(actor, TICKET_PERMISSION.slaView, TICKET_PERMISSION.slaEdit);
    return policyFor(tenantIdOf(actor));
  };

  const saveSla = async (actor, body) => {
    await assertCan(actor, TICKET_PERMISSION.slaEdit);
    let policy;
    try {
      policy = normalizePolicy(body || {});
    } catch (error) {
      throw httpError(400, error.message);
    }
    const ids = policy.escalation.map(item => item.tenantUserId);
    if (ids.length) {
      const users = await fastify.tenant.models.tenantUser.findAll({
        where: { tenantId: tenantIdOf(actor), status: 'open', id: { [Op.in]: ids } },
        attributes: ['id']
      });
      if (users.length !== new Set(ids).size) {
        throw httpError(400, '升级链里有不属于本租户的成员');
      }
    }
    const existing = await models().ticketSla.findOne({ where: { tenantId: tenantIdOf(actor) } });
    if (existing) {
      await existing.update(policy);
      return existing;
    }
    return models().ticketSla.create({ ...policy, tenantId: tenantIdOf(actor) });
  };

  const sweepSla = async () => {
    const rows = await models().ticket.findAll({ where: { status: { [Op.ne]: 'done' }, responseDueAt: { [Op.ne]: null } } });
    const now = new Date();
    for (const ticket of rows) {
      const policy = await policyFor(ticket.tenantId);
      const responding = !ticket.responseMetAt;
      if (!responding && ticket.slaPausedAt) {
        continue;
      }
      const dueAt = responding ? ticket.responseDueAt : ticket.resolveDueAt;
      const step = dueEscalation({ steps: policy.escalation, level: ticket.escalationLevel || 0, dueAt, now, policy });
      if (!step) {
        continue;
      }
      await ticket.update({ escalationLevel: (ticket.escalationLevel || 0) + 1 });
      await models().ticketEvent.create({
        tenantId: ticket.tenantId,
        ticketId: toId(ticket.id),
        type: 'sla',
        fromValue: responding ? 'response' : 'resolve',
        toValue: step.tenantUserId,
        operatorTenantUserId: 'sla'
      });
      await notifyTicket(
        { tenantId: ticket.tenantId, id: 'sla' },
        ticket,
        {
          title: `工单 ${ticket.no} ${responding ? '响应' : '解决'}超时`,
          content: ticket.title,
          extraIds: [step.tenantUserId],
          includeReporter: false
        }
      );
    }
  };

  const sweepAutoClose = async () => {
    const rows = await models().ticket.findAll({ where: { status: 'waiting' } });
    const now = new Date();
    for (const ticket of rows) {
      const entered = await models().ticketEvent.findOne({
        where: { ticketId: toId(ticket.id), type: 'status', toValue: 'waiting' },
        order: [['createdAt', 'DESC']]
      });
      if (autoCloseAt(ticket, entered?.createdAt || ticket.updatedAt) > now) {
        continue;
      }
      await ticket.update({ status: 'done' });
      await moveClock(ticket, 'waiting', 'done');
      await models().ticketEvent.create({
        tenantId: ticket.tenantId,
        ticketId: toId(ticket.id),
        type: 'status',
        fromValue: 'waiting',
        toValue: 'done',
        operatorTenantUserId: ''
      });
      await notifyTicket({ tenantId: ticket.tenantId, id: '' }, ticket, {
        title: `工单 ${ticket.no} 确认超时，已自动结单`,
        content: ticket.title,
        includeReporter: true
      });
    }
  };

  const listMembers = async actor => {
    await assertCan(actor, TICKET_PERMISSION.process, TICKET_PERMISSION.assign, TICKET_PERMISSION.viewAll, TICKET_PERMISSION.slaView, TICKET_PERMISSION.slaEdit);
    return fastify.tenant.models.tenantUser.findAll({
      where: { tenantId: tenantIdOf(actor), status: 'open' },
      attributes: ['id', 'name', 'email', 'userId']
    });
  };

  fastify.project.services.ticket = {
    listTemplates,
    saveTemplate,
    removeTemplate,
    importBaseTemplate,
    listFormLibrary,
    saveFormLibrary,
    listCompleteTemplates,
    saveCompleteTemplate,
    listCompleteLibrary,
    saveCompleteLibrary,
    completeTicket,
    requestInfo,
    submitInfo,
    openColleagueChat,
    setTemplateEnabled,
    listTickets,
    createTicket,
    detail,
    changeStatus,
    accept,
    assign,
    comment,
    listMentionUsers,
    summary,
    listMembers,
    watch,
    unwatch,
    ensureColumns,
    getSla,
    saveSla
  };

  const timer = setInterval(() => {
    sweepSla().catch(error => fastify.log.error({ err: error }, 'SLA 升级扫描失败'));
    sweepAutoClose().catch(error => fastify.log.error({ err: error }, '待确认自动结单扫描失败'));
  }, 60 * 1000);
  if (typeof timer.unref === 'function') {
    timer.unref();
  }
  fastify.addHook('onClose', async () => clearInterval(timer));
});
