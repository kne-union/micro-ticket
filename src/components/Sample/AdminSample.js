import { createWithRemoteLoader } from '@kne/remote-loader';
import withLocale from './withLocale';
import { useIntl } from '@kne/react-intl';
import getColumns from './getColumns';
import FormInner from './FormInner';
import { renderSampleCards } from './sampleCards';

const AdminSample = createWithRemoteLoader({
  modules: ['components-admin:BizUnit', 'components-core:Layout', 'components-core:FlexBox']
})(
  withLocale(({ remoteModules, apis }) => {
    const [BizUnit, Layout, FlexBox] = remoteModules;
    const { formatMessage } = useIntl();
    const statusText = status => formatMessage({ id: status === 'closed' ? 'SampleStatusClosed' : 'SampleStatusOpen' });
    const cards = variant =>
      renderSampleCards({
        FlexBox,
        variant,
        statusText,
        updatedLabel: formatMessage({ id: 'SampleUpdatedAt' })
      });

    return (
      <Layout navigation={{ isFixed: false }}>
        <BizUnit
          isNext
          name="sample-list"
          page={{ title: formatMessage({ id: 'SampleTitle' }) }}
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
        />
      </Layout>
    );
  })
);

export default AdminSample;
