const get = require('lodash/get');

const runner = async (fastify, options, { task }) => {
  const { tenantId, syncSource, config: orgSyncConfig } = task.input;
  const syncOrgSecret = fastify.config.SYNC_ORG_SECRET;
  const syncOrgHost = fastify.config.SYNC_ORG_HOST;

  if (!syncOrgSecret || !syncOrgHost) {
    throw new Error('SYNC_ORG_SECRET 或 SYNC_ORG_HOST 未配置');
  }

  if (!orgSyncConfig.enabled || !orgSyncConfig.targetId) {
    throw new Error('未找到有效的组织同步配置');
  }

  const agentId = get(orgSyncConfig, 'props.agentid');

  if (!agentId) {
    throw new Error('无法从环境变量中解析出 agentId');
  }

  // 3. 获取 token
  const tokenResponse = await fetch(`${syncOrgHost}/api/v1/system/auth/external/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret_key: syncOrgSecret })
  });

  if (tokenResponse.status !== 200) {
    throw new Error(`获取 token 失败: ${tokenResponse.status} ${tokenResponse.statusText}`);
  }

  const tokenData = await tokenResponse.json();

  const token = get(tokenData, 'data.access_token');

  if (!token) {
    throw new Error('获取 token 返回数据中未找到 token');
  }

  // 4. 调用部门列表接口获取组织和用户数据
  const deptResponse = await fetch(`${syncOrgHost}/api/v1/department/${syncSource}/list?agent_id=${encodeURIComponent(agentId)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    }
  });

  if (deptResponse.status !== 200) {
    throw new Error(`获取部门列表失败: ${deptResponse.status} ${deptResponse.statusText}`);
  }

  const deptData = await deptResponse.json();

  // 5. 转换数据为 syncOrg 所需格式
  const orgs = [];
  const users = [];

  const deptList = Array.isArray(deptData) ? deptData : deptData.data || [];

  for (const item of deptList) {
    const dept = item.department || {};
    const deptUsers = item.users || [];

    // 添加组织
    orgs.push({
      sourceId: String(dept.id),
      parentSourceId: dept.parentid ? String(dept.parentid) : null,
      name: dept.name || '',
      description: dept.name_en || null
    });

    // 添加用户
    for (const user of deptUsers) {
      users.push({
        sourceId: String(user.userid),
        orgSourceId: String(dept.id),
        name: user.name || '',
        email: user.email || null,
        phone: user.mobile || null,
        description: user.position || null
      });
    }
  }

  return { tenantId, syncSource, orgs, users };
};

module.exports = runner;
