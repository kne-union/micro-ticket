module.exports = ({ DataTypes }) => {
  return {
    model: {
      tenantId: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: '租户'
      },
      ticketId: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: '工单'
      },
      templateId: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '补充模板，空表示默认多行文本'
      },
      templateName: {
        type: DataTypes.STRING,
        defaultValue: '',
        comment: '补充模板名称'
      },
      schemaSnapshot: {
        type: DataTypes.JSON,
        defaultValue: {},
        comment: '要求补充时的表单 Schema'
      },
      answers: {
        type: DataTypes.JSON,
        defaultValue: {},
        comment: '补充表单答案'
      },
      note: {
        type: DataTypes.TEXT,
        defaultValue: '',
        comment: '未选模板时的补充说明'
      },
      submitted: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: '提单人是否已提交'
      }
    },
    options: {
      comment: '工单要求补充信息',
      indexes: [{ fields: ['tenant_id', 'ticket_id'], unique: true }]
    }
  };
};
