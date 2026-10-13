import { Page as SystemPage } from '@kne/system-layout';
import { createWithRemoteLoader } from '@kne/remote-loader';
import withLocale from './withLocale';
import { useIntl } from '@kne/react-intl';
import getColumns from './getColumns';
import FormInner from './FormInner';
import { renderSampleCards } from './sampleCards';

const PortalSample = createWithRemoteLoader({
  modules: ['components-admin:BizUnit', 'components-core:Table@TablePage', 'components-core:Layout@Page', 'components-core:FlexBox']
})(
  withLocale(({ remoteModules, apis, layoutType = 'system-layout' }) => {
    const [BizUnit, TablePage, CorePage, FlexBox] = remoteModules;
    const { formatMessage } = useIntl();
    const statusText = status => formatMessage({ id: status === 'closed' ? 'SampleStatusClosed' : 'SampleStatusOpen' });
    const cards = variant =>
      renderSampleCards({
        FlexBox,
        variant,
        statusText,
        updatedLabel: formatMessage({ id: 'SampleUpdatedAt' })
      });
    const Page = layoutType === 'layout' ? CorePage : SystemPage;

    return (
      <BizUnit
        isNext
        name="portal-sample-list"
        apis={apis}
        getColumns={() => getColumns({ formatMessage })}
        getFormInner={({ action }) => <FormInner action={action} />}
        options={{
          bizName: formatMessage({ id: 'SampleBizName' }),
          keywordFilterName: 'name',
          keywordFilterLabel: formatMessage({ id: 'SampleKeywordLabel' }),
          createButtonProps: { children: formatMessage({ id: 'SampleCreate' }), type: 'primary' },
          editButtonProps: { children: formatMessage({ id: 'SampleEdit' }) },
          removeButtonProps: { children: formatMessage({ id: 'SampleRemove' }) },
          removeMessage: formatMessage({ id: 'SampleRemoveMessage' }),
          tableProps: {
            renderCard: cards('card'),
            renderMobile: cards('mobile')
          }
        }}
      >
        {({ titleExtra, tableOptions }) => (
          <Page title={formatMessage({ id: 'SampleTitle' })} extra={titleExtra}>
            <TablePage {...tableOptions} />
          </Page>
        )}
      </BizUnit>
    );
  })
);

export default PortalSample;
