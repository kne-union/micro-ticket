
import { Typography } from 'antd';
import { createWithRemoteLoader } from '@kne/remote-loader';
import withLocale from '../withLocale';
import { useIntl } from '@kne/react-intl';

const { Paragraph } = Typography;

const Dashboard = createWithRemoteLoader({
  modules: ['components-core:Layout@Page']
})(
  withLocale(({ remoteModules }) => {
    const [Page] = remoteModules;
    const { formatMessage } = useIntl();

    return (
      <Page title={formatMessage({ id: 'TenantDashboardTitle' })}>
        <Paragraph>{formatMessage({ id: 'TenantDashboardDescription' })}</Paragraph>
      </Page>
    );
  })
);

export default Dashboard;

