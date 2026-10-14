const { test } = require('node:test');
const assert = require('node:assert/strict');
const flattenPermissions = require('@kne/fastify-tenant/libs/utils/flattenPermissions');
const ticketPermissions = require('../libs/permissions');

const { TICKET_PERMISSION, PRESET_ROLES } = ticketPermissions;
const codes = flattenPermissions(ticketPermissions).map(item => item.code);

test('服务端判断用的权限码都在权限清单里', () => {
  Object.values(TICKET_PERMISSION).forEach(code => assert.ok(codes.includes(code), code));
});

test('预置角色只用清单里的权限码，并带上父级模块码', () => {
  PRESET_ROLES.forEach(role => {
    role.permissions.forEach(code => {
      assert.ok(codes.includes(code), `${role.name} ${code}`);
      const parts = code.split(':');
      for (let i = 1; i < parts.length; i++) {
        assert.ok(role.permissions.includes(parts.slice(0, i).join(':')), `${role.name} 缺少 ${parts.slice(0, i).join(':')}`);
      }
    });
  });
});
