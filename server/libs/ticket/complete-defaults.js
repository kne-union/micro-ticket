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
  },
  {
    name: '需求已上线',
    description: '说明上线内容、时间和使用方式',
    schema: schemaOf('需求已上线', [
      field('content', '上线内容'),
      field('releasedAt', '上线时间', 'Input'),
      field('usage', '使用说明', 'TextArea', '')
    ])
  },
  {
    name: '申请已办结',
    description: '设备、软件、采购等申请办理完成',
    schema: schemaOf('申请已办结', [field('content', '办理内容'), field('delivery', '交付说明（领取地点、账号等）', 'TextArea', '')])
  },
  {
    name: '报销已处理',
    description: '报销审核通过、打款或退回',
    schema: schemaOf('报销已处理', [
      field('result', '处理结果'),
      field('paidAt', '打款日期', 'Input', ''),
      field('note', '备注', 'TextArea', '')
    ])
  },
  {
    name: '数据处理完成',
    description: '数据导出、修正或删除已完成',
    schema: schemaOf('数据处理完成', [
      field('scope', '处理范围'),
      field('result', '处理结果'),
      field('location', '结果文件或位置', 'Input', '')
    ])
  },
  {
    name: '不予处理',
    description: '不符合规定或不在处理范围内',
    schema: schemaOf('不予处理', [field('reason', '原因说明'), field('suggestion', '建议的其他途径', 'TextArea', '')])
  },
  {
    name: '临时规避方案',
    description: '先给出临时方案，后续再彻底解决',
    schema: schemaOf('临时规避方案', [field('workaround', '临时方案'), field('plan', '彻底解决计划', 'TextArea', '')])
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
  },
  {
    name: '截图与链接补充',
    description: '请提单人补充截图、录屏或相关链接',
    schema: schemaOf('截图与链接补充', [field('links', '截图或文件链接'), field('note', '补充说明', 'TextArea', '')])
  },
  {
    name: '设备与环境信息',
    description: '排查设备、网络类问题前确认使用环境',
    schema: schemaOf('设备与环境信息', [
      field('device', '设备型号', 'Input'),
      field('os', '操作系统与版本', 'Input'),
      field('network', '网络环境（办公网、居家、VPN）', 'Input', '')
    ])
  },
  {
    name: '联系方式与可约时间',
    description: '需要上门或电话沟通时确认联系方式',
    schema: schemaOf('联系方式与可约时间', [field('contact', '联系电话', 'Input'), field('availableAt', '方便联系的时间', 'Input')])
  },
  {
    name: '审批信息补充',
    description: '办理前需要确认审批人或审批单',
    schema: schemaOf('审批信息补充', [
      field('approver', '审批人', 'Input'),
      field('approvalNo', '审批单号', 'Input', ''),
      field('note', '补充说明', 'TextArea', '')
    ])
  },
  {
    name: '数据范围确认',
    description: '导出或修正数据前确认范围和用途',
    schema: schemaOf('数据范围确认', [field('scope', '数据范围（时间、对象、字段）'), field('purpose', '用途')])
  },
  {
    name: '采购明细补充',
    description: '采购申请信息不全时补充明细和预算',
    schema: schemaOf('采购明细补充', [
      field('items', '物品明细（名称、规格、数量）'),
      field('budget', '预算金额', 'Input'),
      field('supplier', '指定供应商', 'Input', '')
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
