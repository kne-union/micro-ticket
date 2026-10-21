const { expect } = require('chai');
const flattenPermissions = require('@kne/fastify-tenant/libs/utils/flattenPermissions');
const ticketPermissions = require('../libs/permissions');

const { TICKET_PERMISSION, PRESET_ROLES } = ticketPermissions;
const codes = flattenPermissions(ticketPermissions).map(item => item.code);

describe('ticket permissions', () => {
  it('should declare every permission code used by server checks', () => {
    Object.values(TICKET_PERMISSION).forEach(code => expect(codes, code).to.include(code));
  });

  it('should only use declared codes with parent module codes in preset roles', () => {
    PRESET_ROLES.forEach(role => {
      role.permissions.forEach(code => {
        expect(codes, `${role.name} ${code}`).to.include(code);
        const parts = code.split(':');
        for (let i = 1; i < parts.length; i++) {
          expect(role.permissions, `${role.name} 缺少 ${parts.slice(0, i).join(':')}`).to.include(parts.slice(0, i).join(':'));
        }
      });
    });
  });
});
