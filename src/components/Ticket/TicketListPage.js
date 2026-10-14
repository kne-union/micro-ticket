import { useEffect, useState } from 'react';
import { Button } from 'antd';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { createWithRemoteLoader } from '@kne/remote-loader';
import { Page } from '@kne/system-layout';
import { PRIORITY_OPTIONS, STATUS_OPTIONS, labelOf } from './labels';
import { renderTicketCards } from './ticketCards';

const STATUS_TAG = {
  pending: { type: 'warning', text: '待受理' },
  processing: { type: 'processing', text: '处理中' },
  supplement: { type: 'warning', text: '要求补充信息' },
  onHold: { type: 'default', text: '已挂起' },
  waiting: { type: 'warning', text: '待确认' },
  done: { type: 'success', text: '已完成' }
};

const TicketListPage = createWithRemoteLoader({
  modules: ['components-admin:BizUnit', 'components-core:Filter', 'components-core:Global@usePreset', 'components-core:FlexBox']
})(({ remoteModules, layoutType = 'layout', mode = 'client', baseUrl }) => {
  const [BizUnit, Filter, usePreset, FlexBox] = remoteModules;
  const { TablePageRender } = BizUnit;
  const { SuperSelectFilterItem } = Filter.fields;
  const { ajax } = usePreset();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const scopeParam = searchParams.get('scope');
  const scope = ['all', 'assigned', 'created'].includes(scopeParam) ? scopeParam : 'assigned';
  const [templates, setTemplates] = useState([]);
  const title = mode === 'manage' ? '全部工单' : '工单';
  const listUrl = mode === 'manage' ? '/api/v1/ticket/manage/list' : '/api/v1/ticket/list';

  useEffect(() => {
    if (mode !== 'client' || ['all', 'assigned', 'created'].includes(scopeParam)) {
      return;
    }
    setSearchParams(
      prev => {
        const next = new URLSearchParams(prev);
        next.set('scope', 'assigned');
        return next;
      },
      { replace: true }
    );
  }, [mode, scopeParam, setSearchParams]);

  useEffect(() => {
    let cancelled = false;
    ajax({ url: '/api/v1/ticket/template/list', method: 'GET', params: { enabledOnly: mode !== 'manage' } })
      .then(res => {
        const body = res?.data ?? res;
        const data = body?.data ?? body?.results ?? [];
        if (!cancelled) {
          setTemplates(Array.isArray(data) ? data : []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTemplates([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [ajax, mode]);

  const getColumns = () => [
    {
      name: 'no',
      title: '编号',
      renderType: 'main',
      onClick: ({ colItem }) => navigate(`${baseUrl}/ticket/${colItem.id}`)
    },
    { name: 'title', title: '标题' },
    { name: 'assigneeName', title: '处理人' },
    { name: 'templateName', title: '模板' },
    {
      name: 'priority',
      title: '优先级',
      renderType: 'tag',
      getValueOf: item => ({ type: 'processing', text: labelOf(PRIORITY_OPTIONS, item.priority) })
    },
    {
      name: 'sla',
      title: 'SLA',
      renderType: 'tag',
      getValueOf: item => item.sla || { type: 'default', text: '-' }
    },
    {
      name: 'overdue',
      title: '时效',
      renderType: 'tag',
      getValueOf: item => (item.overdue ? { type: 'danger', text: '已逾期' } : { type: 'default', text: item.expectAt ? '未逾期' : '-' })
    },
    {
      name: 'status',
      title: '状态',
      renderType: 'status',
      getValueOf: item => STATUS_TAG[item.status] || { type: 'default', text: labelOf(STATUS_OPTIONS, item.status) }
    }
  ];

  const filterList = [
    {
      type: SuperSelectFilterItem,
      props: { name: 'status', label: '状态', single: true, options: STATUS_OPTIONS }
    },
    {
      type: SuperSelectFilterItem,
      props: { name: 'priority', label: '优先级', single: true, options: PRIORITY_OPTIONS }
    },
    {
      type: SuperSelectFilterItem,
      props: {
        name: 'templateId',
        label: '模板',
        single: true,
        options: templates.map(item => ({ value: item.id, label: item.name }))
      }
    }
  ];

  if (mode === 'manage') {
    filterList.push({
      type: SuperSelectFilterItem,
      props: {
        name: 'scope',
        label: '范围',
        single: true,
        options: [
          { value: 'unassigned', label: '未指派' },
          { value: 'mine', label: '我处理的' }
        ]
      }
    });
  }

  const list = (
    <BizUnit
      isNext
      name="ticket"
      apis={{
        list: {
          url: listUrl,
          method: 'GET'
        }
      }}
      onFilterChange={
        mode === 'client'
          ? value => {
              const entry = (Array.isArray(value) ? value : []).find(item => item?.name === 'scope');
              const nextScope = entry?.value?.value || 'all';
              setSearchParams(
                prev => {
                  if (prev.get('scope') === nextScope) {
                    return prev;
                  }
                  const next = new URLSearchParams(prev);
                  next.set('scope', nextScope);
                  return next;
                },
                { replace: true }
              );
            }
          : undefined
      }
      getColumns={getColumns}
      getActionList={({ data }) => [
        {
          name: 'detail',
          children: '详情',
          onClick: () => navigate(`${baseUrl}/ticket/${data.id}`)
        }
      ]}
      filter={{
        list: filterList,
        ...(mode === 'client' && scope !== 'all'
          ? {
              defaultValue: [
                {
                  name: 'scope',
                  label: '范围',
                  value: { value: scope, label: scope === 'created' ? '我发起的' : '指派给我的' }
                }
              ]
            }
          : {})
      }}
      page={layoutType === 'system-layout' ? undefined : { title }}
      options={{
        bizName: '工单',
        keywordFilterName: 'keyword',
        keywordFilterLabel: '标题',
        ...(mode === 'client'
          ? {
              mapFilterValue: (value, getFilterValue) => {
                const mapped = getFilterValue(value || []);
                if (mapped.scope == null || mapped.scope === '') {
                  mapped.scope = 'all';
                }
                return mapped;
              }
            }
          : {}),
        tableProps: {
          pagination: { paramsType: 'params', currentName: 'currentPage', pageSizeName: 'perPage' },
          renderCard: renderTicketCards({ FlexBox, variant: 'card', onOpen: item => navigate(`${baseUrl}/ticket/${item.id}`) }),
          renderMobile: renderTicketCards({ FlexBox, variant: 'mobile', onOpen: item => navigate(`${baseUrl}/ticket/${item.id}`) })
        }
      }}
    >
      {layoutType === 'system-layout'
        ? renderProps => (
            <TablePageRender
              {...renderProps}
              withPage={false}
              tableOptions={
                mode === 'client'
                  ? {
                      ...renderProps.tableOptions,
                      tab: {
                        name: 'scope',
                        label: '范围',
                        list: [
                          { label: '指派给我的', value: 'assigned' },
                          { label: '我发起的', value: 'created' }
                        ]
                      },
                      tabProps: {
                        tabBarExtraContent: (
                          <Button type="primary" onClick={() => navigate(`${baseUrl}/ticket/create`)}>
                            新建工单
                          </Button>
                        )
                      }
                    }
                  : renderProps.tableOptions
              }
            />
          )
        : undefined}
    </BizUnit>
  );

  if (layoutType === 'system-layout') {
    return <Page title={title}>{list}</Page>;
  }

  return list;
});

export default TicketListPage;
