const { getOfficeHubConfig, getBearerToken, getTenantAgentConfig, getResponseData, officeHubFetch } = require('../../utils/office-hub');

const normalizeThirdLoginUser = ({ user_info: userData, platform }) => {
  const id = userData.userid || userData.user_id || userData.id;

  if (!id) {
    throw new Error('未获取到第三方用户标识');
  }

  return {
    id: String(id),
    platform,
    name: userData.name || userData.nick || userData.nickname || '',
    email: userData.email || userData.biz_mail || null,
    phone: userData.mobile || userData.phone || null,
    //avatar: userData.avatar || userData.thumb_avatar || userData.avatar_url || null,
    gender: (() => {
      if (userData.gender === 'F') {
        return 'Female';
      }
      if (userData.gender === 'M') {
        return '';
      }
      return null;
    })(),
    description: userData.position || userData.remark || userData.description || null
  };
};

const runner = async (fastify, options, { task }) => {
  const input = task.input || {};
  const { tenantId, ...props } = input;

  if (!tenantId) {
    throw new Error('tenantId 不能为空');
  }

  // 回调参数无法可靠区分登录端，platform / agentId 以租户组织关联配置为准
  const { host } = getOfficeHubConfig(fastify);
  const { agentId, config } = await getTenantAgentConfig(fastify, { tenantId });
  const platform = config.source;

  if (!platform) {
    throw new Error('租户未配置第三方登录平台');
  }

  const token = await getBearerToken(fastify);
  const payload = await officeHubFetch(`${host}/api/v1/auth/${platform}/user_info`, {
    token,
    body: Object.assign({}, props, {
      agent_id: String(agentId),
      tenantId
    })
  });

  return normalizeThirdLoginUser(Object.assign({}, { platform }, getResponseData(payload)));
};

module.exports = runner;
