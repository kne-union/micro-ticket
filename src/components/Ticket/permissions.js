export const TICKET_PERMISSION = {
  process: 'ticket:handle:process',
  assign: 'ticket:handle:assign',
  viewAll: 'ticket:view:all',
  templateView: 'ticket:template:view',
  templateEdit: 'ticket:template:edit',
  slaView: 'ticket:sla:view',
  slaEdit: 'ticket:sla:edit'
};

export const hasAny = (permissions, ...codes) => codes.some(code => (permissions || []).includes(code));
