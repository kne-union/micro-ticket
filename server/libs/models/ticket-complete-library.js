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
        comment: '片段名称'
      },
      schema: {
        type: DataTypes.JSON,
        defaultValue: {},
        comment: '片段 Schema'
      },
      parentId: {
        type: DataTypes.STRING,
        comment: '完成模板设计器文件夹 code'
      }
    },
    options: {
      comment: '完成模板设计器片段，与工单内容片段分开',
      indexes: [{ fields: ['tenant_id'] }]
    }
  };
};
