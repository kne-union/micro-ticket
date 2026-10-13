import { createWithRemoteLoader } from '@kne/remote-loader';
import { BankOutlined, LogoutOutlined, PartitionOutlined, SafetyCertificateOutlined, UserOutlined, UserSwitchOutlined } from '@ant-design/icons';
import { Outlet } from 'react-router-dom';
import SystemLayout from '@kne/system-layout';
import '@kne/system-layout/dist/index.css';
import withLocale from './withLocale';
import { useIntl } from '@kne/react-intl';
import { withPublicUrl } from '../../commons/publicUrl';
import ImSocket from '../Im/ImSocket';

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
              <ImSocket baseUrl={baseUrl} />
              {children || <Outlet />}
            </TenantClientMenu>
          );
        }}
      </Authenticate>
    );
  })
);

const TenantClientMenu = ({ baseUrl, tenant, tenantUserInfo, logout, formatMessage, usePermissionsPass, children }) => {
  const allowCompany = usePermissionsPass({ request: COMPANY });
  const allowOrg = usePermissionsPass({ request: ORG });
  const allowUser = usePermissionsPass({ request: USER });
  const allowPermission = usePermissionsPass({ request: PERMISSION });

  const menuItems = [
    {
      path: '/',
      label: formatMessage({ id: 'ClientHome' }),
      toolbar: true,
      icon: 'home'
    },
    {
      path: '/ticket',
      label: formatMessage({ id: 'ClientTicket' }),
      toolbar: true,
      icon: 'assignment'
    },
    {
      path: '/chat',
      label: formatMessage({ id: 'ClientChat' }),
      toolbar: true,
      icon: 'message'
    },
    allowCompany
      ? {
          group: 'tenantSetting',
          groupLabel: formatMessage({ id: 'ClientMenuSetting' }),
          label: formatMessage({ id: 'ClientMenuCompany' }),
          path: '/setting/company',
          toolbar: true,
          icon: <BankOutlined />
        }
      : null,
    allowOrg
      ? {
          group: 'tenantSetting',
          groupLabel: formatMessage({ id: 'ClientMenuSetting' }),
          label: formatMessage({ id: 'ClientMenuOrg' }),
          path: '/setting/org',
          toolbar: true,
          icon: <PartitionOutlined />
        }
      : null,
    allowUser
      ? {
          group: 'tenantSetting',
          groupLabel: formatMessage({ id: 'ClientMenuSetting' }),
          label: formatMessage({ id: 'ClientMenuUser' }),
          path: '/setting/user',
          toolbar: true,
          icon: <UserOutlined />
        }
      : null,
    allowPermission
      ? {
          group: 'tenantSetting',
          groupLabel: formatMessage({ id: 'ClientMenuSetting' }),
          label: formatMessage({ id: 'ClientMenuPermission' }),
          path: '/setting/permission',
          toolbar: true,
          icon: <SafetyCertificateOutlined />
        }
      : null,
    {
      group: 'account',
      groupLabel: formatMessage({ id: 'ClientMenuAccount' }),
      label: formatMessage({ id: 'ClientMenuSwitchTenant' }),
      icon: <UserSwitchOutlined />,
      onClick: () => {
        window.location.href = withPublicUrl('/login-tenant');
      }
    },
    {
      group: 'account',
      groupLabel: formatMessage({ id: 'ClientMenuAccount' }),
      label: formatMessage({ id: 'ClientMenuLogout' }),
      icon: <LogoutOutlined />,
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
      {children}
    </SystemLayout>
  );
};

export default Layout;
