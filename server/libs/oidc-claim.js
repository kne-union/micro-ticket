/**
 * central 模式下本地用户 id 换成主项目的 sub，旧账号的租户成员关系挂在旧 id 上。
 * 新用户首次登录且没有任何租户成员关系时，按主项目资料里的邮箱认领同邮箱旧账号的租户成员关系。
 */
module.exports = fastify => {
  const checked = new Set();
  const pending = new Map();

  const claim = async userId => {
    const tenantModels = fastify.tenant.models;
    if ((await tenantModels.user.count({ where: { userId } })) > 0) {
      return;
    }
    const profile = await fastify.oidc.serviceClient.getUserProfile(userId).catch(error => {
      fastify.log.warn({ err: error, userId }, 'oidc-claim: 获取主项目用户资料失败');
      return null;
    });
    if (!profile?.email) {
      return;
    }
    const legacy = await fastify.account.models.user.findOne({ where: { email: profile.email } });
    if (!legacy || String(legacy.id) === String(userId)) {
      return;
    }
    await fastify.sequelize.instance.transaction(async transaction => {
      await tenantModels.user.update({ userId }, { where: { userId: legacy.id }, transaction });
      if (tenantModels.userDefault) {
        await tenantModels.userDefault.update({ userId }, { where: { userId: legacy.id }, transaction });
      }
    });
    fastify.log.info({ userId, legacyUserId: legacy.id }, 'oidc-claim: 已认领旧账号的租户成员关系');
  };

  return async request => {
    const userId = request.user?.userId;
    if (!userId || request.user.legacy || fastify.oidc.idp || !fastify.oidc.serviceClient.enabled() || checked.has(userId)) {
      return;
    }
    if (!pending.has(userId)) {
      pending.set(
        userId,
        claim(userId)
          .then(() => checked.add(userId))
          .finally(() => pending.delete(userId))
      );
    }
    await pending.get(userId);
  };
};
