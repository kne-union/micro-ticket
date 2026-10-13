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
        comment: '模板名称'
      },
      description: {
        type: DataTypes.TEXT,
        defaultValue: '',
        comment: '模板说明'
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
        comment: 'FormCreator Schema'
      },
      parentId: {
        type: DataTypes.STRING,
        comment: '所属文件夹 code，空为根目录'
      }
    },
    options: {
      comment: '工单模板',
      indexes: [{ fields: ['tenant_id', 'enabled'] }]
    }
  };
};
