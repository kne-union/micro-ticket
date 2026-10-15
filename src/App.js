import { useEffect } from 'react';
import RemoteLoader, { createWithRemoteLoader } from '@kne/remote-loader';
import AppChildrenRouter from '@kne/app-children-router';
import { Navigate } from 'react-router-dom';
import TenantAdmin from '@components/TenantAdmin';


import TenantClient from '@components/TenantClient';


import { getOidcClient } from './commons/oidcClient';
import './index.scss';

const Protected = ({ children }) => <RemoteLoader module="components-admin:Oidc@OidcAuthenticate">{children}</RemoteLoader>;

/** 远程组件内置的退出（useLogout）会跳到 /account/login，统一转为 OIDC 退出 */
const AccountLoginRedirect = () => {
  useEffect(() => {
    getOidcClient().logout();
  }, []);
  return null;
};

const App = createWithRemoteLoader({
  modules: ['components-core:Global', 'components-admin:Authenticate@AfterUserLoginLayout', 'components-admin:Authenticate@AfterAdminUserLoginLayout']
})(({ remoteModules, globalPreset }) => {
  const [Global, AfterUserLoginLayout, AfterAdminUserLoginLayout] = remoteModules;
  const baseUrl = '';
  const systemName = 'micro-ticket';
  const isOidcClient = globalPreset.oidcMode === 'central';

  const adminNavigation = {
    base: `${baseUrl}/admin`,
    showIndex: false,
    defaultTitle: systemName,
    list: [
      {
        key: 'task',
        title: '任务管理',
        path: `${baseUrl}/admin/task`
      },
      {
        key: 'tenant',
        title: '租户管理',
        path: `${baseUrl}/admin/tenant`
      },
      {
        key: 'ticket-template',
        title: '工单模板',
        path: `${baseUrl}/admin/ticket-template`
      },
      {
        key: 'user',
        title: '用户管理',
        path: '/admin/user'
      },
      {
        key: 'file',
        title: '文件管理',
        path: `${baseUrl}/admin/file`
      },
      !isOidcClient && {
        key: 'oidc',
        title: '统一认证',
        path: `${baseUrl}/admin/oidc`
      },
      {
        key: 'message',
        title: '消息管理',
        path: `${baseUrl}/admin/message`
      }
    ].filter(Boolean)
  };

  const routes = [
    {
      path: 'oidc-interaction',
      title: 'Login',
      element: <RemoteLoader module="components-admin:Oidc@Interaction" systemName={systemName} registerUrl={`${baseUrl}/account/register`} forgetUrl={`${baseUrl}/account/forget`} />
    },
    {
      path: 'oidc-callback',
      title: 'Login',
      element: <RemoteLoader module="components-admin:Oidc@Callback" systemName={systemName} />
    },
    {
      path: 'account/login',
      title: 'Login',
      element: <AccountLoginRedirect />
    },
    {
      path: 'account/*',
      title: 'Account',
      element: <RemoteLoader module="components-admin:Account" baseUrl={baseUrl + '/account'} systemName={systemName} />
    },
    {
      path: 'admin/initAdmin',
      title: 'Init Admin',
      element: (
        <Protected>
          <AppChildrenRouter
            element={<AfterUserLoginLayout />}
            list={[
              {
                index: true,
                element: <RemoteLoader module="components-admin:Admin@InitAdmin" />
              }
            ]}
          />
        </Protected>
      )
    },
    {
      path: 'admin/*',
      title: 'Admin',
      element: (
        <Protected>
          <AppChildrenRouter
            errorPage
            notFoundPage
            baseUrl={baseUrl + '/admin'}
            element={<AfterAdminUserLoginLayout navigation={adminNavigation} />}
            list={[
              {
                index: true,
                element: <Navigate to={`${baseUrl}/admin/tenant`} replace />
              },
              {
                path: 'tenant/*',
                title: '租户管理',
                element: <RemoteLoader module="components-admin:TenantAdmin" baseUrl={baseUrl + '/admin'} />
              },
              {
                path: 'ticket-template',
                title: '工单模板',
                loader: () => import('@components/Ticket/BaseTemplatePage')
              },
              {
                path: 'task/*',
                title: '任务管理',
                element: <RemoteLoader module="components-admin:Task" baseUrl={baseUrl + '/admin'} />
              },
              {
                path: 'file',
                title: '文件管理',
                element: <RemoteLoader module="components-file-manager:FileListPage" />
              },
              {
                path: 'message/*',
                title: '消息管理',
                element: <RemoteLoader module="components-admin:MessageManger" baseUrl={`${baseUrl}/admin/message`} />
              },
              !isOidcClient && {
                path: 'oidc/*',
                title: '统一认证',
                element: <RemoteLoader module="components-admin:OidcAdmin" baseUrl={`${baseUrl}/admin/oidc`} />
              }
            ].filter(Boolean)}
          >
            <RemoteLoader module="components-admin:Admin" baseUrl={baseUrl + '/admin'} />
          </AppChildrenRouter>
        </Protected>
      )
    }
  ];




  routes.push({
    path: 'join-tenant',
    title: 'Join Tenant',
    element: (
      <Protected>
        <AfterUserLoginLayout>
          <RemoteLoader module="components-admin:Tenant@JoinInvitation" />
        </AfterUserLoginLayout>
      </Protected>
    )
  });
  routes.push({
    path: 'login-tenant',
    title: 'Login Tenant',
    element: (
      <Protected>
        <AfterUserLoginLayout>
          <RemoteLoader
            module="components-admin:Tenant@LoginTenant"
            tenantPath={`${baseUrl}/tenant`}
          />
        </AfterUserLoginLayout>
      </Protected>
    )
  });



  routes.push({
    path: 'tenant-admin/*',
    element: (
      <Protected>
        <TenantAdmin baseUrl={`${baseUrl}/tenant-admin`} />
      </Protected>
    )
  });



  routes.push({
    path: 'tenant/*',
    element: (
      <Protected>
        <TenantClient baseUrl={`${baseUrl}/tenant`} />
      </Protected>
    )
  });



  routes.push({
    path: '*',
    element: <Navigate to={`${baseUrl}/tenant`} replace />
  });


  return (
    <Global preset={globalPreset} themeToken={globalPreset.themeToken}>
      <AppChildrenRouter errorPage notFoundPage baseUrl={baseUrl} list={routes} />
    </Global>
  );
});

export default App;
