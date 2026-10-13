const fp = require('fastify-plugin');

module.exports = fp(async (fastify, options) => {
  const prefix = `${options.prefix}/admin/ticket-base-template`;
  const onRequest = [fastify.account.authenticate.user, fastify.account.authenticate.admin];
  const services = () => fastify.project.services.ticketBase;

  fastify.get(
    `${prefix}/list`,
    {
      onRequest,
      schema: {
        query: {
          type: 'object',
          additionalProperties: true,
          properties: {
            currentPage: { type: 'number', default: 1 },
            perPage: { type: 'number', default: 20 },
            keyword: { type: 'string' },
            enabledOnly: { type: 'string' }
          }
        }
      }
    },
    async request => services().list(request.query)
  );

  fastify.post(`${prefix}/save`, { onRequest }, async request => services().save(request.body || {}));

  fastify.post(`${prefix}/remove`, { onRequest }, async request => services().remove(request.body || {}));
});
