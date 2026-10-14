import { createWithRemoteLoader } from '@kne/remote-loader';
import AppChildrenRouter from '@kne/app-children-router';
import { Page } from '@kne/system-layout';
import Layout from './Layout';
import withLocale from './withLocale';
import { useIntl } from '@kne/react-intl';

const renderSettingPage = ({ title, titleExtra, children }) => (
  <Page title={title} extra={titleExtra}>
    {children}
  </Page>
);

const TenantClient = createWithRemoteLoader({
  modules: ['components-admin:Tenant@Setting']
})(
  withLocale(({ remoteModules, baseUrl }) => {
    const [Setting] = remoteModules;
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
            title: formatMessage({ id: 'ClientHome' }),
            loader: () => import('./Home'),
            elementProps: { baseUrl }
          },
          {
            path: 'ticket/create',
            title: formatMessage({ id: 'ClientTicketCreate' }),
            loader: () => import('@components/Ticket/TicketCreatePage'),
            elementProps: { layoutType: 'system-layout', baseUrl }
          },
          {
            path: 'ticket/:id',
            title: formatMessage({ id: 'ClientTicket' }),
            loader: () => import('@components/Ticket/TicketDetailPage'),
            elementProps: { layoutType: 'system-layout', mode: 'client', baseUrl }
          },
          {
            path: 'chat',
            title: formatMessage({ id: 'ClientChat' }),
            loader: () => import('@components/Im/ChatPage'),
            elementProps: { baseUrl }
          },
          {
            path: 'ticket',
            title: formatMessage({ id: 'ClientTicket' }),
            loader: () => import('@components/Ticket/TicketListPage'),
            elementProps: { layoutType: 'system-layout', mode: 'client', baseUrl }
          },
          {
            path: 'setting/company',
            title: formatMessage({ id: 'ClientMenuCompany' }),
            element: <Setting.Company>{renderSettingPage}</Setting.Company>
          },
          {
            path: 'setting/org',
            title: formatMessage({ id: 'ClientMenuOrg' }),
            element: <Setting.Org>{renderSettingPage}</Setting.Org>
          },
          {
            path: 'setting/user',
            title: formatMessage({ id: 'ClientMenuUser' }),
            element: <Setting.User>{renderSettingPage}</Setting.User>
          },
          {
            path: 'setting/permission',
            title: formatMessage({ id: 'ClientMenuPermission' }),
            element: <Setting.Permission>{renderSettingPage}</Setting.Permission>
          }
        ]}
      />
    );
  })
);

export default TenantClient;
