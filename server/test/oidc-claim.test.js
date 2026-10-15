const { test } = require('node:test');
const assert = require('node:assert/strict');
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

test('central 模式新用户无租户时，按邮箱认领旧账号的租户成员关系', async () => {
  const tenantUsers = [{ id: 'tu1', userId: 'old-1' }];
  const { fastify, updates } = createFastify({ tenantUsers, users: [{ id: 'old-1', email: 'a@x.com' }], profile: { email: 'a@x.com' } });
  await createClaimer(fastify)({ user: { userId: 'new-1' } });
  assert.equal(tenantUsers[0].userId, 'new-1');
  assert.deepEqual(
    updates.map(([model]) => model),
    ['user', 'userDefault']
  );
});

test('已有租户成员关系、legacy 令牌、standalone 模式都不认领', async () => {
  const tenantUsers = [
    { id: 'tu1', userId: 'old-1' },
    { id: 'tu2', userId: 'new-1' }
  ];
  const users = [{ id: 'old-1', email: 'a@x.com' }];
  const profile = { email: 'a@x.com' };

  const withTenant = createFastify({ tenantUsers, users, profile });
  await createClaimer(withTenant.fastify)({ user: { userId: 'new-1' } });
  assert.equal(withTenant.updates.length, 0);

  const legacy = createFastify({ tenantUsers: [{ id: 'tu1', userId: 'old-1' }], users, profile });
  await createClaimer(legacy.fastify)({ user: { userId: 'old-1', legacy: true } });
  assert.equal(legacy.profileCalls.length, 0);

  const standalone = createFastify({ tenantUsers: [{ id: 'tu1', userId: 'old-1' }], users, profile, idp: {} });
  await createClaimer(standalone.fastify)({ user: { userId: 'new-1' } });
  assert.equal(standalone.profileCalls.length, 0);
});

test('同一用户并发请求只认领一次，之后不再查询', async () => {
  const { fastify, profileCalls } = createFastify({ tenantUsers: [{ id: 'tu1', userId: 'old-1' }], users: [{ id: 'old-1', email: 'a@x.com' }], profile: { email: 'a@x.com' } });
  const claim = createClaimer(fastify);
  await Promise.all([claim({ user: { userId: 'new-1' } }), claim({ user: { userId: 'new-1' } })]);
  await claim({ user: { userId: 'new-1' } });
  assert.equal(profileCalls.length, 1);
});
