module.exports = ({ DataTypes }) => {
  return {
    model: {
      tenantId: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: '租户'
      },
      commentId: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: '评论'
      },
      tenantUserId: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: '被提醒的人'
      }
    },
    options: {
      comment: '工单评论提醒',
      indexes: [{ fields: ['comment_id'] }, { fields: ['tenant_user_id'] }]
    }
  };
};
