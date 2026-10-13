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
      tenantUserId: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: '处理人'
      }
    },
    options: {
      comment: '工单处理人',
      indexes: [{ fields: ['ticket_id'] }, { fields: ['tenant_id', 'tenant_user_id'] }]
    }
  };
};
