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
        comment: '表单片段名称'
      },
      schema: {
        type: DataTypes.JSON,
        defaultValue: {},
        comment: 'FormCreator 片段 Schema'
      },
      parentId: {
        type: DataTypes.STRING,
        comment: '表单片段文件夹 code，空为根目录'
      }
    },
    options: {
      comment: '表单设计器片段库，与工单模板文件夹分开',
      indexes: [{ fields: ['tenant_id'] }]
    }
  };
};
