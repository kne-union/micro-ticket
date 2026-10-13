const get = require('lodash/get');

const getOfficeHubConfig = fastify => {
  const host = fastify.config.SYNC_ORG_HOST;
  const secret = fastify.config.SYNC_ORG_SECRET;

  if (!host || !secret) {
    throw new Error('SYNC_ORG_SECRET 或 SYNC_ORG_HOST 未配置');
  }

  return { host, secret };
};

const getBearerToken = async fastify => {
  const { host, secret } = getOfficeHubConfig(fastify);
  const tokenResponse = await fetch(`${host}/api/v1/system/auth/external/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret_key: secret })
  });

  const tokenData = await tokenResponse.json().catch(() => ({}));

  if (!tokenResponse.ok) {
    throw new Error(`获取 token 失败: ${tokenResponse.status} ${tokenResponse.statusText}`);
  }

  const token = get(tokenData, 'data.access_token');

  if (!token) {
    throw new Error(get(tokenData, 'error_msg') || get(tokenData, 'msg') || '获取 token 返回数据中未找到 token');
  }

  return token;
};

const getTenantAgentConfig = async (fastify, { tenantId, platform }) => {
  const config = await fastify.tenant.services.orgSync.getConfig({ tenantId });

  if (!config.enabled) {
    throw new Error('未找到有效的组织关联配置');
  }

  if (platform && config.source && config.source !== platform) {
    throw new Error(`平台 ${platform} 与租户组织关联来源 ${config.source} 不一致`);
  }

  const agentId = get(config, 'props.agentid');

  if (!agentId) {
    throw new Error('无法从环境变量中解析出 agentId');
  }

  return { agentId, config };
};

const getResponseData = payload => get(payload, 'data', payload);

const assertOfficeHubResponse = (response, payload) => {
  if (!response.ok) {
    throw new Error(get(payload, 'error_msg') || get(payload, 'message') || get(payload, 'msg') || `${response.status} ${response.statusText}`);
  }

  if (payload && payload.status_code >= 400) {
    throw new Error(get(payload, 'error_msg') || get(payload, 'msg') || 'Office Hub 请求失败');
  }
};

const officeHubFetch = async (url, { token, body } = {}) => {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(body)
  });

  const payload = await response.json().catch(() => ({}));
  assertOfficeHubResponse(response, payload);
  return payload;
};

module.exports = {
  getOfficeHubConfig,
  getBearerToken,
  getTenantAgentConfig,
  getResponseData,
  officeHubFetch
};
