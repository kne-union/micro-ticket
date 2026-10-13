import AppChildrenRouter from '@kne/app-children-router';
import Layout from './Layout';

import { createWithRemoteLoader } from '@kne/remote-loader';
import withLocale from './withLocale';
import { useIntl } from '@kne/react-intl';

const TenantAdmin = createWithRemoteLoader({
  modules: ['components-admin:Tenant@Setting', 'components-core:Global@usePreset', 'components-core:Layout@Page']
})(
  withLocale(({ remoteModules, baseUrl }) => {
    const [Setting, usePreset, Page] = remoteModules;
    const { apis } = usePreset();
    const { formatMessage } = useIntl();

    return (
      <AppChildrenRouter
        errorPage
        notFoundPage
        baseUrl={baseUrl}
        element={<Layout baseUrl={baseUrl} />}
        list={[
          {
            index: true,
            title: formatMessage({ id: 'TenantDashboardTitle' }),
            loader: () => import('./Dashboard')
          },
          {
            path: 'template',
            title: formatMessage({ id: 'TenantMenuTemplate' }),
            loader: () => import('@components/Ticket/TemplatePage'),
            elementProps: { layoutType: 'layout', purpose: 'content' }
          },
          {
            path: 'complete-template',
            title: formatMessage({ id: 'TenantMenuCompleteTemplate' }),
            loader: () => import('@components/Ticket/TemplatePage'),
            elementProps: { layoutType: 'layout', purpose: 'complete' }
          },
          {
            path: 'supplement-template',
            title: formatMessage({ id: 'TenantMenuSupplementTemplate' }),
            loader: () => import('@components/Ticket/TemplatePage'),
            elementProps: { layoutType: 'layout', purpose: 'supplement' }
          },
          {
            path: 'ticket/create',
            title: formatMessage({ id: 'TenantMenuTicket' }),
            loader: () => import('@components/Ticket/TicketCreatePage'),
            elementProps: { layoutType: 'layout', baseUrl }
          },
          {
            path: 'ticket/:id',
            title: formatMessage({ id: 'TenantMenuTicket' }),
            loader: () => import('@components/Ticket/TicketDetailPage'),
            elementProps: { layoutType: 'layout', mode: 'manage' }
          },
          {
            path: 'chat',
            title: formatMessage({ id: 'TenantMenuChat' }),
            loader: () => import('@components/Im/ChatPage'),
            elementProps: { baseUrl }
          },
          {
            path: 'ticket',
            title: formatMessage({ id: 'TenantMenuTicket' }),
            loader: () => import('@components/Ticket/TicketListPage'),
            elementProps: { layoutType: 'layout', mode: 'manage', baseUrl }
          },
          {
            path: 'sample',
            title: formatMessage({ id: 'TenantMenuSample' }),
            loader: () => import('@components/Sample').then(({ TenantSample }) => TenantSample),
            elementProps: {
              apis: apis.sample,
              baseUrl,
              layoutType: 'layout'
            }
          },
          {
            path: 'setting/company',
            title: formatMessage({ id: 'TenantMenuCompany' }),
            element: <Setting.Company>{({ title, children }) => <Page title={title}>{children}</Page>}</Setting.Company>
          },
          {
            path: 'setting/org',
            title: formatMessage({ id: 'TenantMenuGroup' }),
            element: <Setting.Org>{({ title, children }) => <Page title={title}>{children}</Page>}</Setting.Org>
          },
          {
            path: 'setting/user',
            title: formatMessage({ id: 'TenantMenuUser' }),
            element: (
              <Setting.User>
                {({ title, titleExtra, children }) => (
                  <Page title={title} extra={titleExtra}>
                    {children}
                  </Page>
                )}
              </Setting.User>
            )
          },
          {
            path: 'setting/permission',
            title: formatMessage({ id: 'TenantMenuPermission' }),
            element: (
              <Setting.Permission>
                {({ title, titleExtra, children }) => (
                  <Page title={title} extra={titleExtra}>
                    {children}
                  </Page>
                )}
              </Setting.Permission>
            )
          }
        ]}
      />
    );
  })
);

export default TenantAdmin;
