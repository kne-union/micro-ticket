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
        comment: '完成模板，空表示纯文本'
      },
      templateName: {
        type: DataTypes.STRING,
        defaultValue: '',
        comment: '完成模板名称'
      },
      schemaSnapshot: {
        type: DataTypes.JSON,
        defaultValue: {},
        comment: '完成时的表单 Schema'
      },
      answers: {
        type: DataTypes.JSON,
        defaultValue: {},
        comment: '完成表单答案'
      },
      note: {
        type: DataTypes.TEXT,
        defaultValue: '',
        comment: '未选模板时的完成说明'
      }
    },
    options: {
      comment: '工单完成内容',
      indexes: [{ fields: ['tenant_id', 'ticket_id'], unique: true }]
    }
  };
};
