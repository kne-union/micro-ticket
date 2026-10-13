module.exports = ({ DataTypes }) => {
  return {
    model: {
      code: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '系统问卷编码，启动时按此载入'
      },
      builtin: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: '系统预置，可引用不可修改'
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: '公共问卷模板名称'
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
        comment: '是否允许租户导入'
      },
      schema: {
        type: DataTypes.JSON,
        defaultValue: {},
        comment: 'FormCreator 问卷 Schema'
      }
    },
    options: {
      comment: '平台公共工单问卷模板，供所有租户导入',
      indexes: [{ fields: ['enabled'] }]
    }
  };
};
