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

const hasBlocks = schema => Array.isArray(schema?.blocks) && schema.blocks.some(block => Array.isArray(block.list) && block.list.length > 0);

const LEGACY_SUPPLEMENT = {
  name: '故障补充信息',
  schema: schemaOf('故障补充信息', [field('happenedAt', '发生时间', 'Input'), field('requestId', '请求编号', 'Input')])
};

module.exports = {
  COMPLETE_DEFAULTS,
  hasBlocks,
  LEGACY_SUPPLEMENT
};
