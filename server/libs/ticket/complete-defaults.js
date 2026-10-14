const field = (name, label, type = 'TextArea', rule = 'REQ') => ({
  id: `field_${name}`,
  type,
  name,
  label,
  tips: '',
  description: '',
  rule,
  block: true,
  hidden: false,
  props: {}
});

const schemaOf = (title, fields) => ({
  title,
  subtitle: '',
  column: 1,
  gap: 24,
  blocks: [
    {
      id: `block_${title}`,
      kind: 'formInfo',
      title,
      subtitle: '',
      column: 1,
      gap: 24,
      bordered: true,
      important: false,
      showIndex: false,
      name: '',
      label: '',
      addText: '',
      fieldType: 'Input',
      autoStep: true,
      mode: 'single',
      selectorName: '',
      selectorInData: true,
      list: fields
    }
  ],
  actions: {
    showSubmit: false,
    showReset: false,
    showCancel: false
  }
});

const COMPLETE_DEFAULTS = [
  {
    name: '处理结果',
    description: '说明怎么处理的、原因和下一步',
    schema: schemaOf('处理结果', [
      field('result', '处理结论'),
      field('cause', '原因说明', 'TextArea', ''),
      field('followUp', '后续安排', 'TextArea', '')
    ])
  },
  {
    name: '故障已修复',
    description: '记录根因、修复措施和验证情况',
    schema: schemaOf('故障已修复', [
      field('cause', '故障原因'),
      field('fix', '处理措施'),
      field('verify', '验证情况')
    ])
  },
  {
    name: '咨询答复',
    description: '直接回复咨询内容',
    schema: schemaOf('咨询答复', [field('answer', '答复内容'), field('reference', '参考说明', 'TextArea', '')])
  },
  {
    name: '权限处理结果',
    description: '账号开通、停用或改权限后的结果',
    schema: schemaOf('权限处理结果', [field('account', '处理账号', 'Input'), field('result', '处理结果')])
  }
];

const SUPPLEMENT_DEFAULTS = [
  {
    name: '故障现场信息',
    description: '请提单人补充发生时间、复现步骤和报错信息',
    schema: schemaOf('故障现场信息', [
      field('happenedAt', '发生时间', 'Input'),
      field('steps', '复现步骤'),
      field('errorMessage', '报错信息', 'TextArea', ''),
      field('requestId', '请求编号', 'Input', '')
    ])
  },
  {
    name: '账号权限信息',
    description: '开通或调整权限前确认账号、系统和权限范围',
    schema: schemaOf('账号权限信息', [
      field('account', '账号或邮箱', 'Input'),
      field('system', '涉及系统', 'Input'),
      field('permission', '需要的权限'),
      field('approver', '审批人', 'Input', '')
    ])
  },
  {
    name: '报销票据补充',
    description: '票据缺失或信息不全时请提单人补充',
    schema: schemaOf('报销票据补充', [field('invoice', '发票信息（号码、金额）'), field('note', '补充说明', 'TextArea', '')])
  },
  {
    name: '需求详情补充',
    description: '需求描述不清时请提单人补充场景和期望',
    schema: schemaOf('需求详情补充', [
      field('scenario', '使用场景'),
      field('expect', '期望效果'),
      field('deadline', '期望完成时间', 'Input', '')
    ])
  }
];

const hasBlocks = schema => Array.isArray(schema?.blocks) && schema.blocks.some(block => Array.isArray(block.list) && block.list.length > 0);

const LEGACY_SUPPLEMENT = {
  name: '故障补充信息',
  schema: schemaOf('故障补充信息', [field('happenedAt', '发生时间', 'Input'), field('requestId', '请求编号', 'Input')])
};

module.exports = {
  COMPLETE_DEFAULTS,
  SUPPLEMENT_DEFAULTS,
  hasBlocks,
  LEGACY_SUPPLEMENT
};
