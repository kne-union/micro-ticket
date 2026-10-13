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
        comment: '关注人'
      }
    },
    options: {
      comment: '工单关注人，受理和指派时加入，可退出',
      indexes: [{ fields: ['tenant_id', 'ticket_id', 'tenant_user_id'], unique: true }]
    }
  };
};
