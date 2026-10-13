module.exports = ({ DataTypes }) => {
  return {
    model: {
      tenantId: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: '租户'
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: '完成模板名称'
      },
      description: {
        type: DataTypes.TEXT,
        defaultValue: '',
        comment: '说明'
      },
      enabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: '是否启用'
      },
      schema: {
        type: DataTypes.JSON,
        defaultValue: {},
        comment: '完成表单 Schema'
      },
      usage: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'complete',
        comment: 'complete 办结 / supplement 补充信息'
      },
      parentId: {
        type: DataTypes.STRING,
        comment: '完成模板文件夹 code'
      }
    },
    options: {
      comment: '完成工单模板，与工单内容模板分开',
      indexes: [{ fields: ['tenant_id', 'enabled'] }]
    }
  };
};
