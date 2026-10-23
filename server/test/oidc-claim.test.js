const { expect } = require('chai');
const createClaimer = require('../libs/oidc-claim');

const createFastify = ({ tenantUsers, users, profile, idp = null, serviceEnabled = true }) => {
  const updates = [];
  const profileCalls = [];
  const fastify = {
    log: { info() {}, warn() {} },
    sequelize: { instance: { transaction: async fn => fn('tx') } },
    oidc: {
      idp,
      serviceClient: {
        enabled: () => serviceEnabled,
        getUserProfile: async userId => {
          profileCalls.push(userId);
          return profile;
        }
      }
    },
    account: {
      models: {
        user: { findOne: async ({ where }) => users.find(user => user.email === where.email) || null }
      }
    },
    tenant: {
      models: {
        user: {
          count: async ({ where }) => tenantUsers.filter(item => item.userId === where.userId).length,
          update: async (values, { where }) => {
            updates.push(['user', values, where]);
            tenantUsers.filter(item => item.userId === where.userId).forEach(item => Object.assign(item, values));
          }
        },
        userDefault: {
          update: async (values, { where }) => updates.push(['userDefault', values, where])
        }
      }
    }
  };
  return { fastify, updates, profileCalls };
};

describe('oidc claim', () => {
  it('should claim tenant membership of old account by email when central user has no tenant', async () => {
    const tenantUsers = [{ id: 'tu1', userId: 'old-1' }];
    const { fastify, updates } = createFastify({ tenantUsers, users: [{ id: 'old-1', email: 'a@x.com' }], profile: { email: 'a@x.com' } });
    await createClaimer(fastify)({ user: { userId: 'new-1' } });
    expect(tenantUsers[0].userId).to.equal('new-1');
    expect(updates.map(([model]) => model)).to.deep.equal(['user', 'userDefault']);
  });

  it('should not claim when user has tenant, token is legacy or mode is standalone', async () => {
    const tenantUsers = [
      { id: 'tu1', userId: 'old-1' },
      { id: 'tu2', userId: 'new-1' }
    ];
    const users = [{ id: 'old-1', email: 'a@x.com' }];
    const profile = { email: 'a@x.com' };

    const withTenant = createFastify({ tenantUsers, users, profile });
    await createClaimer(withTenant.fastify)({ user: { userId: 'new-1' } });
    expect(withTenant.updates).to.have.lengthOf(0);

    const legacy = createFastify({ tenantUsers: [{ id: 'tu1', userId: 'old-1' }], users, profile });
    await createClaimer(legacy.fastify)({ user: { userId: 'old-1', legacy: true } });
    expect(legacy.profileCalls).to.have.lengthOf(0);

    const standalone = createFastify({ tenantUsers: [{ id: 'tu1', userId: 'old-1' }], users, profile, idp: {} });
    await createClaimer(standalone.fastify)({ user: { userId: 'new-1' } });
    expect(standalone.profileCalls).to.have.lengthOf(0);
  });

  it('should claim only once for concurrent requests of the same user', async () => {
    const { fastify, profileCalls } = createFastify({ tenantUsers: [{ id: 'tu1', userId: 'old-1' }], users: [{ id: 'old-1', email: 'a@x.com' }], profile: { email: 'a@x.com' } });
    const claim = createClaimer(fastify);
    await Promise.all([claim({ user: { userId: 'new-1' } }), claim({ user: { userId: 'new-1' } })]);
    await claim({ user: { userId: 'new-1' } });
    expect(profileCalls).to.have.lengthOf(1);
  });
});
