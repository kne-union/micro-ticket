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
      authorTenantUserId: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: '作者'
      },
      content: {
        type: DataTypes.TEXT,
        allowNull: false,
        comment: '内容'
      },
      internal: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: '内部备注'
      }
    },
    options: {
      comment: '工单评论',
      indexes: [{ fields: ['ticket_id'] }]
    }
  };
};
