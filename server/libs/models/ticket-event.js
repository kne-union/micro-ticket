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
      type: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'status 或 assign'
      },
      fromValue: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '变更前'
      },
      toValue: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '变更后'
      },
      operatorTenantUserId: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: '操作人'
      }
    },
    options: {
      comment: '工单事件',
      indexes: [{ fields: ['ticket_id'] }]
    }
  };
};
