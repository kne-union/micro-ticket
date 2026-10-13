const fp = require('fastify-plugin');

const listQuery = {
  type: 'object',
  properties: {
    currentPage: { type: 'number', default: 1 },
    perPage: { type: 'number', default: 20 },
    status: { type: 'string' },
    priority: { type: 'string' },
    templateId: { type: 'string' },
    keyword: { type: 'string' },
    scope: { type: 'string' }
  }
};

module.exports = fp(async (fastify, options) => {
  const prefix = `${options.prefix}/ticket`;
  const onRequest = [fastify.tenant.authenticate.user, fastify.tenant.authenticate.tenantUser];
  const actorOf = request => request.tenantUserInfo;
  const services = () => fastify.project.services.ticket;

  fastify.get(`${prefix}/template/list`, { onRequest, schema: { query: { type: 'object', additionalProperties: true, properties: { enabledOnly: { type: 'string' } } } } }, async request => {
    return services().listTemplates(actorOf(request), { enabledOnly: request.query.enabledOnly === true || request.query.enabledOnly === 'true' });
  });

  fastify.post(`${prefix}/template/save`, { onRequest }, async request => {
    return services().saveTemplate(actorOf(request), request.body || {});
  });

  fastify.get(`${prefix}/base-template/list`, { onRequest }, async request => {
    return fastify.project.services.ticketBase.list({ ...request.query, enabledOnly: true });
  });

  fastify.post(`${prefix}/template/import`, { onRequest }, async request => {
    return services().importBaseTemplate(actorOf(request), request.body || {});
  });

  fastify.get(`${prefix}/form-library/list`, { onRequest }, async request => {
    return services().listFormLibrary(actorOf(request));
  });

  fastify.post(`${prefix}/form-library/save`, { onRequest }, async request => {
    return services().saveFormLibrary(actorOf(request), request.body || {});
  });

  fastify.get(`${prefix}/complete-template/list`, { onRequest, schema: { query: { type: 'object', additionalProperties: true, properties: { enabledOnly: { type: 'string' }, usage: { type: 'string' } } } } }, async request => {
    return services().listCompleteTemplates(actorOf(request), {
      enabledOnly: request.query.enabledOnly === true || request.query.enabledOnly === 'true',
      usage: request.query.usage
    });
  });

  fastify.post(`${prefix}/complete-template/save`, { onRequest }, async request => {
    return services().saveCompleteTemplate(actorOf(request), request.body || {});
  });

  fastify.get(`${prefix}/complete-library/list`, { onRequest }, async request => {
    return services().listCompleteLibrary(actorOf(request));
  });

  fastify.post(`${prefix}/complete-library/save`, { onRequest }, async request => {
    return services().saveCompleteLibrary(actorOf(request), request.body || {});
  });

  fastify.post(`${prefix}/manage/complete`, { onRequest }, async request => {
    return services().completeTicket(actorOf(request), request.body || {});
  });

  fastify.post(`${prefix}/manage/request-info`, { onRequest }, async request => {
    return services().requestInfo(actorOf(request), request.body || {});
  });

  fastify.post(`${prefix}/submit-info`, { onRequest }, async request => {
    return services().submitInfo(actorOf(request), request.body || {});
  });

  fastify.post(`${prefix}/chat/open`, { onRequest }, async request => {
    return services().openColleagueChat(actorOf(request), request.body || {}, request.userInfo?.id);
  });

  fastify.post(`${prefix}/template/set-enabled`, { onRequest }, async request => {
    return services().setTemplateEnabled(actorOf(request), request.body || {});
  });

  fastify.get(`${prefix}/list`, { onRequest, schema: { query: listQuery } }, async request => {
    return services().listTickets(actorOf(request), request.query, { asHandler: false });
  });

  fastify.get(`${prefix}/summary`, { onRequest }, async request => {
    return services().summary(actorOf(request));
  });

  fastify.get(`${prefix}/manage/list`, { onRequest, schema: { query: listQuery } }, async request => {
    return services().listTickets(actorOf(request), request.query, { asHandler: true });
  });

  fastify.post(`${prefix}/create`, { onRequest }, async request => {
    return services().createTicket(actorOf(request), request.body || {});
  });

  fastify.get(`${prefix}/detail`, { onRequest, schema: { query: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } } }, async request => {
    return services().detail(actorOf(request), request.query.id, { asHandler: false });
  });

  fastify.get(`${prefix}/manage/detail`, { onRequest, schema: { query: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } } }, async request => {
    return services().detail(actorOf(request), request.query.id, { asHandler: true });
  });

  fastify.post(`${prefix}/status`, { onRequest }, async request => {
    return services().changeStatus(actorOf(request), request.body || {}, { asHandler: false });
  });

  fastify.post(`${prefix}/manage/status`, { onRequest }, async request => {
    return services().changeStatus(actorOf(request), request.body || {}, { asHandler: true });
  });

  fastify.post(`${prefix}/manage/accept`, { onRequest }, async request => {
    return services().accept(actorOf(request), request.body || {});
  });

  fastify.post(`${prefix}/assign`, { onRequest }, async request => {
    return services().assign(actorOf(request), request.body || {}, { asHandler: false });
  });

  fastify.post(`${prefix}/manage/assign`, { onRequest }, async request => {
    return services().assign(actorOf(request), request.body || {}, { asHandler: true });
  });

  fastify.post(`${prefix}/watch`, { onRequest }, async request => {
    return services().watch(actorOf(request), request.body || {});
  });

  fastify.post(`${prefix}/unwatch`, { onRequest }, async request => {
    return services().unwatch(actorOf(request), request.body || {});
  });

  fastify.post(`${prefix}/comment`, { onRequest }, async request => {
    return services().comment(actorOf(request), request.body || {}, { asHandler: false });
  });

  fastify.post(`${prefix}/manage/comment`, { onRequest }, async request => {
    return services().comment(actorOf(request), request.body || {}, { asHandler: true });
  });

  fastify.get(`${prefix}/manage/members`, { onRequest }, async request => {
    return services().listMembers(actorOf(request));
  });

  fastify.get(`${prefix}/members`, { onRequest }, async request => {
    return services().listMentionUsers(actorOf(request));
  });
});
