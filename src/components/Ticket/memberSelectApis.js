import { unwrap } from './labels';

/** 租户还没有组织节点时，用这个虚拟节点列出全部成员。 */
export const ALL_MEMBERS_ORG_ID = '__ticket_all_members__';

const orgRows = data => {
  if (Array.isArray(data)) {
    return data;
  }
  if (Array.isArray(data?.pageData)) {
    return data.pageData;
  }
  return [];
};

/**
 * TenantUserSelect 必须先点左侧组织才会请求成员。
 * 组织列表为空时补一个「全部成员」，并在请求用户时去掉这个虚拟组织筛选。
 */
export const buildMemberSelectApis = (ajax, apis) => {
  const orgList = apis?.tenant?.orgList || {};
  const userList = apis?.tenant?.userList || {};

  return {
    orgApi: {
      ...orgList,
      transformData: data => {
        if (orgRows(data).length) {
          return data;
        }
        return [{ id: ALL_MEMBERS_ORG_ID, name: '全部成员', parentId: null }];
      }
    },
    userApi: {
      ...userList,
      loader: async input => {
        const params = { ...(input?.params || {}) };
        const filter = { ...(params.filter || input?.filter || {}) };
        if (String(filter.tenantOrgId) === ALL_MEMBERS_ORG_ID) {
          delete filter.tenantOrgId;
        }
        params.filter = filter;
        return unwrap(
          await ajax({
            url: userList.url,
            method: userList.method || 'GET',
            params
          })
        );
      }
    }
  };
};
