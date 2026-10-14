import { createWithRemoteLoader } from '@kne/remote-loader';
import { LogoutOutlined, PartitionOutlined, SafetyCertificateOutlined, UserOutlined, UserSwitchOutlined } from '@ant-design/icons';

import { Outlet } from 'react-router-dom';
import withLocale from './withLocale';
import { useIntl } from '@kne/react-intl';
import { withPublicUrl } from '../../commons/publicUrl';
import ImSocket from '../Im/ImSocket';
import { TICKET_PERMISSION, hasAny } from '../Ticket/permissions';

const Layout = createWithRemoteLoader({
  modules: [
    'components-admin:Tenant@Authenticate',
    'components-admin:Account@useLogout',
    'components-core:Icon',
    'components-core:Global@SetGlobal',
    'components-core:Layout',
    'components-core:Permissions@usePermissions'
  ]
})(
  withLocale(({ remoteModules, baseUrl, children }) => {
    const [Authenticate, useLogout, Icon, SetGlobal, CoreLayout, usePermissions] = remoteModules;
    const logout = useLogout();
    const { formatMessage } = useIntl();

    return (
      <Authenticate>
        {({ global }) => {
          const { tenantUserInfo, tenant } = global;
          return (
            <SetGlobal globalKey="tenant" value={tenant}>
              <SetGlobal globalKey="userInfo" value={{ tenantUserInfo, tenant }}>
                <TenantAdminFrame CoreLayout={CoreLayout} usePermissions={usePermissions} baseUrl={baseUrl} formatMessage={formatMessage}>
                  {children}
                </TenantAdminFrame>
              </SetGlobal>
            </SetGlobal>
          );
        }}
      </Authenticate>
    );
  })
);

const TenantAdminFrame = ({ CoreLayout, usePermissions, baseUrl, formatMessage, children }) => {
  const { permissions } = usePermissions();
  const allowTicket = hasAny(permissions, TICKET_PERMISSION.process, TICKET_PERMISSION.assign, TICKET_PERMISSION.viewAll);
  const allowTemplate = hasAny(permissions, TICKET_PERMISSION.templateView, TICKET_PERMISSION.templateEdit);
  const allowSla = hasAny(permissions, TICKET_PERMISSION.slaView, TICKET_PERMISSION.slaEdit);

  return (
    <CoreLayout
      navigation={{
        base: baseUrl,
        showIndex: false,
        defaultTitle: formatMessage({ id: 'TenantDashboardTitle' }),
        list: [
          { key: 'dashboard', title: formatMessage({ id: 'TenantMenuDashboard' }), path: baseUrl },
          allowTicket ? { key: 'ticket', title: formatMessage({ id: 'TenantMenuTicket' }), path: `${baseUrl}/ticket` } : null,
          { key: 'chat', title: formatMessage({ id: 'TenantMenuChat' }), path: `${baseUrl}/chat` },
          allowTemplate ? { key: 'template', title: formatMessage({ id: 'TenantMenuTemplate' }), path: `${baseUrl}/template` } : null,
          allowTemplate ? { key: 'complete-template', title: formatMessage({ id: 'TenantMenuCompleteTemplate' }), path: `${baseUrl}/complete-template` } : null,
          allowTemplate ? { key: 'supplement-template', title: formatMessage({ id: 'TenantMenuSupplementTemplate' }), path: `${baseUrl}/supplement-template` } : null,
          allowSla ? { key: 'sla', title: formatMessage({ id: 'TenantMenuSla' }), path: `${baseUrl}/sla` } : null,
          { key: 'sample', title: formatMessage({ id: 'TenantMenuSample' }), path: `${baseUrl}/sample` },
          { key: 'company', title: formatMessage({ id: 'TenantMenuCompany' }), path: `${baseUrl}/setting/company` },
          { key: 'org', title: formatMessage({ id: 'TenantMenuGroup' }), path: `${baseUrl}/setting/org` },
          { key: 'user', title: formatMessage({ id: 'TenantMenuUser' }), path: `${baseUrl}/setting/user` },
          { key: 'permission', title: formatMessage({ id: 'TenantMenuPermission' }), path: `${baseUrl}/setting/permission` }
        ].filter(Boolean)
      }}
    >
      <ImSocket baseUrl={baseUrl} />
      {children || <Outlet />}
    </CoreLayout>
  );
};

export default Layout;
