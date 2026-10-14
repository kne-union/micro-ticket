module.exports = ({ DataTypes }) => {
  return {
    model: {
      tenantId: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: '租户'
      },
      timezone: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'Asia/Shanghai',
        comment: '时区'
      },
      weekdays: {
        type: DataTypes.JSON,
        defaultValue: [1, 2, 3, 4, 5],
        comment: '工作日，1 为周一'
      },
      startTime: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: '09:00',
        comment: '上班时间'
      },
      endTime: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: '18:00',
        comment: '下班时间'
      },
      holidays: {
        type: DataTypes.JSON,
        defaultValue: [],
        comment: '节假日 YYYY-MM-DD'
      },
      extraWorkdays: {
        type: DataTypes.JSON,
        defaultValue: [],
        comment: '调休上班日'
      },
      targets: {
        type: DataTypes.JSON,
        defaultValue: {},
        comment: '各优先级的响应和解决分钟数'
      },
      escalation: {
        type: DataTypes.JSON,
        defaultValue: [],
        comment: '升级链'
      }
    },
    options: {
      comment: '工单 SLA 与营业时间',
      indexes: [{ fields: ['tenant_id'], unique: true }]
    }
  };
};
