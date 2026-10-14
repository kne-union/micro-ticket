import { useState } from 'react';
import { createWithRemoteLoader } from '@kne/remote-loader';
import { Outlet } from 'react-router-dom';
import SystemLayout from '@kne/system-layout';
import '@kne/system-layout/dist/index.css';
import withLocale from './withLocale';
import { useIntl } from '@kne/react-intl';
import { withPublicUrl } from '../../commons/publicUrl';
import ImSocket from '../Im/ImSocket';
import { CompanyMenuIcon, HomeMenuIcon, LogoutMenuIcon, MailMenuIcon, OrgMenuIcon, PermissionMenuIcon, SwitchTenantMenuIcon, TicketMenuIcon, UserMenuIcon } from './MenuIcons';

const COMPANY = ['setting:company-setting', 'setting:company-setting:view'];
const ORG = ['setting:org', 'setting:org:view'];
const USER = ['setting:user-manager', 'setting:user-manager:view'];
const PERMISSION = ['setting:permission', 'setting:permission:role:view'];

const Layout = createWithRemoteLoader({
  modules: ['components-admin:Tenant@Authenticate', 'components-admin:Account@useLogout', 'components-core:Permissions@usePermissionsPass']
})(
  withLocale(({ remoteModules, baseUrl, children }) => {
    const [Authenticate, useLogout, usePermissionsPass] = remoteModules;
    const logout = useLogout();
    const { formatMessage } = useIntl();

    return (
      <Authenticate>
        {({ global }) => {
          const { tenantUserInfo, tenant } = global;
          return (
            <TenantClientMenu
              baseUrl={baseUrl}
              tenant={tenant}
              tenantUserInfo={tenantUserInfo}
              logout={logout}
              formatMessage={formatMessage}
              usePermissionsPass={usePermissionsPass}
            >
              {children || <Outlet />}
            </TenantClientMenu>
          );
        }}
      </Authenticate>
    );
  })
);

const TenantClientMenu = ({ baseUrl, tenant, tenantUserInfo, logout, formatMessage, usePermissionsPass, children }) => {
  const [messageCount, setMessageCount] = useState(0);
  const allowCompany = usePermissionsPass({ request: COMPANY });
  const allowOrg = usePermissionsPass({ request: ORG });
  const allowUser = usePermissionsPass({ request: USER });
  const allowPermission = usePermissionsPass({ request: PERMISSION });

  const menuItems = [
    {
      path: '/',
      label: formatMessage({ id: 'ClientHome' }),
      toolbar: true,
      icon: <HomeMenuIcon />
    },
    {
      path: '/ticket',
      label: formatMessage({ id: 'ClientTicket' }),
      toolbar: true,
      icon: <TicketMenuIcon />
    },
    {
      path: '/chat',
      label: formatMessage({ id: 'ClientChat' }),
      toolbar: true,
      badge: messageCount,
      icon: <MailMenuIcon />
    },
    allowCompany
      ? {
          group: 'tenantSetting',
          groupLabel: formatMessage({ id: 'ClientMenuSetting' }),
          label: formatMessage({ id: 'ClientMenuCompany' }),
          path: '/setting/company',
          icon: <CompanyMenuIcon />
        }
      : null,
    allowOrg
      ? {
          group: 'tenantSetting',
          groupLabel: formatMessage({ id: 'ClientMenuSetting' }),
          label: formatMessage({ id: 'ClientMenuOrg' }),
          path: '/setting/org',
          icon: <OrgMenuIcon />
        }
      : null,
    allowUser
      ? {
          group: 'tenantSetting',
          groupLabel: formatMessage({ id: 'ClientMenuSetting' }),
          label: formatMessage({ id: 'ClientMenuUser' }),
          path: '/setting/user',
          icon: <UserMenuIcon />
        }
      : null,
    allowPermission
      ? {
          group: 'tenantSetting',
          groupLabel: formatMessage({ id: 'ClientMenuSetting' }),
          label: formatMessage({ id: 'ClientMenuPermission' }),
          path: '/setting/permission',
          icon: <PermissionMenuIcon />
        }
      : null,
    {
      group: 'account',
      groupLabel: formatMessage({ id: 'ClientMenuAccount' }),
      label: formatMessage({ id: 'ClientMenuSwitchTenant' }),
      icon: <SwitchTenantMenuIcon />,
      onClick: () => {
        window.location.href = withPublicUrl('/login-tenant');
      }
    },
    {
      group: 'account',
      groupLabel: formatMessage({ id: 'ClientMenuAccount' }),
      label: formatMessage({ id: 'ClientMenuLogout' }),
      icon: <LogoutMenuIcon />,
      onClick: logout
    }
  ].filter(Boolean);

  return (
    <SystemLayout
      openScrollbar={false}
      logo={{ id: tenant?.logo }}
      userInfo={{
        ...tenantUserInfo,
        email: '',
        description: tenantUserInfo?.options?.position || tenantUserInfo?.email
      }}
      background={'linear-gradient(180deg, #E8DCDF, #E1D1E3, #DED7EF, #D5E0F1)'}
      menu={{
        base: baseUrl,
        items: menuItems
      }}
    >
      <ImSocket baseUrl={baseUrl} onUnread={setMessageCount} />
      {children}
    </SystemLayout>
  );
};

export default Layout;
