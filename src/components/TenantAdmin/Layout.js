import { createWithRemoteLoader } from '@kne/remote-loader';
import { LogoutOutlined, PartitionOutlined, SafetyCertificateOutlined, UserOutlined, UserSwitchOutlined } from '@ant-design/icons';

import { Outlet } from 'react-router-dom';
import withLocale from './withLocale';
import { useIntl } from '@kne/react-intl';
import { withPublicUrl } from '../../commons/publicUrl';
import ImSocket from '../Im/ImSocket';

const Layout = createWithRemoteLoader({
  modules: [
    'components-admin:Tenant@Authenticate',
    'components-admin:Account@useLogout',
    'components-core:Icon',
    'components-core:Global@SetGlobal',
    'components-core:Layout'
  ]
})(
  withLocale(({ remoteModules, baseUrl, children }) => {
    const [Authenticate, useLogout, Icon, SetGlobal, CoreLayout] = remoteModules;
    const logout = useLogout();
    const { formatMessage } = useIntl();

    return (
      <Authenticate>
        {({ global }) => {
          const { tenantUserInfo, tenant } = global;
          return (
            <SetGlobal globalKey="tenant" value={tenant}>
              <SetGlobal globalKey="userInfo" value={{ tenantUserInfo, tenant }}>
                  <CoreLayout
                    navigation={{
                      base: baseUrl,
                      showIndex: false,
                      defaultTitle: formatMessage({ id: 'TenantDashboardTitle' }),
                      list: [
                        { key: 'dashboard', title: formatMessage({ id: 'TenantMenuDashboard' }), path: baseUrl },
                        { key: 'ticket', title: formatMessage({ id: 'TenantMenuTicket' }), path: `${baseUrl}/ticket` },
                        { key: 'chat', title: formatMessage({ id: 'TenantMenuChat' }), path: `${baseUrl}/chat` },
                        { key: 'template', title: formatMessage({ id: 'TenantMenuTemplate' }), path: `${baseUrl}/template` },
                        { key: 'complete-template', title: formatMessage({ id: 'TenantMenuCompleteTemplate' }), path: `${baseUrl}/complete-template` },
                        { key: 'supplement-template', title: formatMessage({ id: 'TenantMenuSupplementTemplate' }), path: `${baseUrl}/supplement-template` },
                        { key: 'sla', title: formatMessage({ id: 'TenantMenuSla' }), path: `${baseUrl}/sla` },
                        { key: 'sample', title: formatMessage({ id: 'TenantMenuSample' }), path: `${baseUrl}/sample` },
                        { key: 'company', title: formatMessage({ id: 'TenantMenuCompany' }), path: `${baseUrl}/setting/company` },
                        { key: 'org', title: formatMessage({ id: 'TenantMenuGroup' }), path: `${baseUrl}/setting/org` },
                        { key: 'user', title: formatMessage({ id: 'TenantMenuUser' }), path: `${baseUrl}/setting/user` },
                        { key: 'permission', title: formatMessage({ id: 'TenantMenuPermission' }), path: `${baseUrl}/setting/permission` }
                      ]
                    }}
                  >
                    <ImSocket baseUrl={baseUrl} />
                    {children || <Outlet />}
                  </CoreLayout>
              </SetGlobal>
            </SetGlobal>
          );
        }}
      </Authenticate>
    );
  })
);

export default Layout;
