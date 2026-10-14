const permissions = {
  modules: [
    {
      name: '工单',
      code: 'ticket',
      modules: [
        {
          name: '工单处理',
          code: 'handle',
          permissions: [
            { name: '受理与处理', code: 'process' },
            { name: '指派与转派', code: 'assign' }
          ]
        },
        {
          name: '工单查看',
          code: 'view',
          permissions: [{ name: '查看全部工单', code: 'all' }]
        },
        {
          name: '模板管理',
          code: 'template',
          permissions: [
            { name: '查看', code: 'view' },
            { name: '编辑', code: 'edit' }
          ]
        },
        {
          name: 'SLA 设置',
          code: 'sla',
          permissions: [
            { name: '查看', code: 'view' },
            { name: '编辑', code: 'edit' }
          ]
        }
      ]
    }
  ]
};

const TICKET_PERMISSION = {
  process: 'ticket:handle:process',
  assign: 'ticket:handle:assign',
  viewAll: 'ticket:view:all',
  templateView: 'ticket:template:view',
  templateEdit: 'ticket:template:edit',
  slaView: 'ticket:sla:view',
  slaEdit: 'ticket:sla:edit'
};

const PRESET_ROLES = [
  {
    code: 'ticket-handler',
    name: '工单处理人',
    description: '受理、处理和指派工单，可查看模板',
    permissions: ['ticket', 'ticket:handle', 'ticket:handle:process', 'ticket:handle:assign', 'ticket:template', 'ticket:template:view']
  },
  {
    code: 'ticket-supervisor',
    name: '工单主管',
    description: '查看全部工单并指派，维护模板与 SLA',
    permissions: [
      'ticket',
      'ticket:view',
      'ticket:view:all',
      'ticket:handle',
      'ticket:handle:assign',
      'ticket:template',
      'ticket:template:view',
      'ticket:template:edit',
      'ticket:sla',
      'ticket:sla:view',
      'ticket:sla:edit'
    ]
  }
];

module.exports = permissions;
module.exports.TICKET_PERMISSION = TICKET_PERMISSION;
module.exports.PRESET_ROLES = PRESET_ROLES;
