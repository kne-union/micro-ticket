module.exports = ({ DataTypes }) => {
  return {
    model: {
      tenantId: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: '租户'
      },
      seq: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: '租户内序号'
      },
      no: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: '工单编号'
      },
      title: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: '标题'
      },
      templateId: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: '模板'
      },
      templateName: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: '',
        comment: '模板名称快照'
      },
      priority: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'medium',
        comment: '优先级 low/medium/high/urgent'
      },
      status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'pending',
        comment: '状态'
      },
      reporterTenantUserId: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: '提单人'
      },
      assigneeTenantUserId: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '处理人'
      },
      expectAt: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: '期望完成时间'
      },
      schemaSnapshot: {
        type: DataTypes.JSON,
        defaultValue: {},
        comment: '提交时的问卷 Schema'
      },
      answers: {
        type: DataTypes.JSON,
        defaultValue: {},
        comment: '问卷答案'
      },
      attachmentIds: {
        type: DataTypes.JSON,
        defaultValue: [],
        comment: '附件文件 id'
      }
    },
    options: {
      comment: '工单',
      indexes: [
        { fields: ['tenant_id', 'no'], unique: true },
        { fields: ['tenant_id', 'status'] },
        { fields: ['tenant_id', 'reporter_tenant_user_id'] },
        { fields: ['tenant_id', 'assignee_tenant_user_id'] }
      ]
    }
  };
};
