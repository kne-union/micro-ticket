import { useEffect, useMemo, useState } from 'react';
import { Button, Empty, Space, Tag, message } from 'antd';
import { useParams } from 'react-router-dom';
import { createWithRemoteLoader } from '@kne/remote-loader';
import { Page } from '@kne/system-layout';
import { PRIORITY_OPTIONS, STATUS_OPTIONS, labelOf, unwrap } from './labels';
import { buildMemberSelectApis } from './memberSelectApis';
import style from './style.module.scss';

const formatTime = value => {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const pad = number => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const eventText = item => {
  const who = item.operatorName || '有人';
  if (item.type === 'assign') {
    return `${who} 将处理人从「${item.fromName || '未指派'}」改为「${item.toName || '未指派'}」`;
  }
  return `${who} 将状态从「${labelOf(STATUS_OPTIONS, item.fromValue)}」改为「${labelOf(STATUS_OPTIONS, item.toValue)}」`;
};

const CompleteBody = ({ FormInfo, SchemaRendererInner, ajax }) => {
  const { SuperSelectTableList, TextArea } = FormInfo.fields;
  const [template, setTemplate] = useState(null);

  return (
    <div>
      <FormInfo
        column={1}
        list={[
          <SuperSelectTableList
            key="templateId"
            name="templateId"
            label="完成模板"
            single
            isPopup={false}
            allowClear
            labelKey="name"
            valueKey="id"
            placeholder="不选则直接填写说明"
            pagination={{ paramsType: 'data' }}
            api={{
              loader: async () => {
                const rows = unwrap(await ajax({ url: '/api/v1/ticket/complete-template/list', method: 'GET', params: { enabledOnly: true, usage: 'complete' } })) || [];
                return { pageData: rows, totalCount: rows.length };
              }
            }}
            columns={[
              { name: 'name', title: '模板名称', width: 240 },
              { name: 'description', title: '说明', width: 360 }
            ]}
            onChange={value => setTemplate((Array.isArray(value) ? value[0] : value) || null)}
          />
        ]}
      />
      {template ? <SchemaRendererInner schema={template.schema || {}} showActions={false} /> : <FormInfo column={1} list={[<TextArea key="note" name="note" label="完成说明" rule="REQ" block />]} />}
    </div>
  );
};

const SupplementRequestBody = ({ FormInfo, SchemaRendererInner, ajax }) => {
  const { SuperSelectTableList } = FormInfo.fields;
  const [template, setTemplate] = useState(null);

  return (
    <div>
      <FormInfo
        column={1}
        list={[
          <SuperSelectTableList
            key="templateId"
            name="templateId"
            label="补充模板"
            single
            isPopup={false}
            allowClear
            labelKey="name"
            valueKey="id"
            placeholder="不选则让提单人填写多行文本"
            pagination={{ paramsType: 'data' }}
            api={{
              loader: async () => {
                const rows = unwrap(await ajax({ url: '/api/v1/ticket/complete-template/list', method: 'GET', params: { enabledOnly: true, usage: 'supplement' } })) || [];
                return { pageData: rows, totalCount: rows.length };
              }
            }}
            columns={[
              { name: 'name', title: '模板名称', width: 240 },
              { name: 'description', title: '说明', width: 360 }
            ]}
            onChange={value => setTemplate((Array.isArray(value) ? value[0] : value) || null)}
          />
        ]}
      />
      {template ? <SchemaRendererInner schema={template.schema || {}} showActions={false} /> : <div>默认使用多行文本，由提单人填写。</div>}
    </div>
  );
};

const PROGRESS = [
  { key: 'pending', title: '待受理' },
  { key: 'processing', title: '处理中' },
  { key: 'waiting', title: '待确认' },
  { key: 'done', title: '已完成' }
];

const progressOf = status => {
  const index = status === 'onHold' ? 1 : Math.max(0, PROGRESS.findIndex(item => item.key === status));
  return PROGRESS.map((item, step) => ({
    title: item.title,
    description: item.key === 'processing' && status === 'onHold' ? '已挂起' : item.key === 'processing' && status === 'supplement' ? '要求补充信息' : '',
    status: status === 'done' ? 'finish' : step < index ? 'finish' : step === index ? 'process' : 'wait'
  }));
};

const personIds = value => (Array.isArray(value) ? value : value ? [value] : []).map(item => (item && typeof item === 'object' ? item.id || item.value : item)).filter(Boolean);

const HANDLER_NEXT = {
  processing: [{ status: 'onHold', label: '挂起' }],
  supplement: [{ status: 'processing', label: '继续处理' }],
  onHold: [{ status: 'processing', label: '恢复处理' }],
  waiting: [{ status: 'processing', label: '退回处理中' }],
  done: [{ status: 'processing', label: '重开' }]
};

const CommentForm = ({ FormInfo, TenantUserSelect, mode, companyName, memberApis, onSubmit }) => {
  const { Form, SubmitButton } = FormInfo;
  const { TextArea, Switch } = FormInfo.fields;

  return (
    <div className={style['comment-form']}>
      <Form onSubmit={onSubmit}>
        <FormInfo
          column={1}
          list={[
            <TextArea key="content" name="content" label="评论" rule="REQ" block rows={3} placeholder={mode === 'manage' ? '回复处理进展' : '补充说明'} />,
            <TenantUserSelect.Input key="mentionIds" name="mentionIds" label="提醒人" single={false} isPopup placeholder="选择要提醒的人" companyName={companyName} orgApi={memberApis.orgApi} userApi={memberApis.userApi} />,
            mode === 'manage' ? <Switch key="internal" name="internal" label="内部备注" /> : null,
            <div key="submit" className={style['comment-actions']}>
              <SubmitButton type="primary">发表评论</SubmitButton>
            </div>
          ].filter(Boolean)}
        />
      </Form>
    </div>
  );
};

const TicketDetailPage = createWithRemoteLoader({
  modules: [
    'components-core:Global@usePreset',
    'components-core:Global@useGlobalContext',
    'components-core:Layout@Page',
    'components-thirdparty:FormCreator@SchemaContent',
    'components-core:FormInfo',
    'components-core:FormInfo@useFormModal',
    'components-thirdparty:FormCreator@SchemaRendererInner',
    'components-core:InfoPage',
    'components-core:InfoPage@Flow',
    'components-admin:Tenant@TenantUserSelect'
  ]
})(({ remoteModules, layoutType = 'layout', mode = 'client' }) => {
  const [usePreset, useGlobalContext, CorePage, SchemaContent, FormInfo, useFormModal, SchemaRendererInner, InfoPage, Flow, TenantUserSelect] = remoteModules;
  const { Form, SubmitButton } = FormInfo;
  const { ajax, apis } = usePreset();
  const memberApis = useMemo(() => buildMemberSelectApis(ajax, apis), [ajax, apis]);
  const { global } = useGlobalContext('userInfo');
  const companyName = global?.tenant?.name || '';
  const formModal = useFormModal();
  const { id } = useParams();
  const PageView = layoutType === 'system-layout' ? Page : CorePage;
  const [detail, setDetail] = useState(null);
  const [commentFormKey, setCommentFormKey] = useState(0);

  const load = async () => {
    const data = unwrap(
      await ajax({
        url: mode === 'manage' ? '/api/v1/ticket/manage/detail' : '/api/v1/ticket/detail',
        method: 'GET',
        params: { id }
      })
    );
    setDetail(data);
  };

  useEffect(() => {
    load().catch(error => message.error(error.message));
  }, [id]);

  const run = async (url, data) => {
    unwrap(await ajax({ url, method: 'POST', data }));
    message.success('已更新');
    load();
  };

  if (!detail?.ticket) {
    return <PageView title="工单详情" />;
  }

  const { ticket, comments = [], events = [], completion, supplement } = detail;

  const openComplete = () => {
    formModal({
      title: '完成工单',
      size: 'large',
      width: 'calc(100vw - 48px)',
      okText: '提交完成',
      formProps: {
        onSubmit: async values => {
          const picked = Array.isArray(values.templateId) ? values.templateId[0] : values.templateId;
          const templateId = picked && typeof picked === 'object' ? picked.id : picked || null;
          const answers = Object.fromEntries(Object.entries(values).filter(([key]) => key !== 'templateId' && key !== 'note'));
          try {
            await run('/api/v1/ticket/manage/complete', {
              id: ticket.id,
              templateId,
              answers: templateId ? answers : {},
              note: values.note || ''
            });
          } catch (error) {
            message.error(error.message);
            return false;
          }
        }
      },
      children: <CompleteBody FormInfo={FormInfo} SchemaRendererInner={SchemaRendererInner} ajax={ajax} />
    });
  };

  const openReopen = () => {
    formModal({
      title: '重开原因',
      formProps: {
        onSubmit: async values => {
          try {
            await run(mode === 'manage' ? '/api/v1/ticket/manage/status' : '/api/v1/ticket/status', {
              id: ticket.id,
              status: 'processing',
              note: values.note
            });
          } catch (error) {
            message.error(error.message);
            return false;
          }
        }
      },
      children: <FormInfo column={1} list={[<FormInfo.fields.TextArea name="note" label="重开原因" rule="REQ" block />]} />
    });
  };

  const toggleWatch = () => run(detail.watching ? '/api/v1/ticket/unwatch' : '/api/v1/ticket/watch', { id: ticket.id });

  const openRequestInfo = () => {
    formModal({
      title: '要求补充信息',
      size: 'large',
      width: 'calc(100vw - 48px)',
      okText: '发送给提单人',
      formProps: {
        onSubmit: async values => {
          const picked = Array.isArray(values.templateId) ? values.templateId[0] : values.templateId;
          const templateId = picked && typeof picked === 'object' ? picked.id : picked || null;
          try {
            await run('/api/v1/ticket/manage/request-info', { id: ticket.id, templateId });
          } catch (error) {
            message.error(error.message);
            return false;
          }
        }
      },
      children: <SupplementRequestBody FormInfo={FormInfo} SchemaRendererInner={SchemaRendererInner} ajax={ajax} />
    });
  };

  const publish = async values => {
    const mentionIds = (Array.isArray(values.mentionIds) ? values.mentionIds : [])
      .map(item => (item && typeof item === 'object' ? item.value || item.id : item))
      .filter(Boolean);
    const url = mode === 'manage' ? '/api/v1/ticket/manage/comment' : '/api/v1/ticket/comment';
    try {
      await run(url, {
        id: ticket.id,
        content: values.content,
        internal: !!values.internal,
        mentionIds
      });
      setCommentFormKey(key => key + 1);
    } catch (error) {
      message.error(error.message);
      return false;
    }
  };

  const progress = progressOf(ticket.status);

  return (
    <PageView title={`${ticket.no} ${ticket.title}`}>
      <InfoPage className={style['detail-page']}>
        <div className={style.section}>
          <Flow orientation="horizontal" current={ticket.status === 'done' ? progress.length - 1 : Math.max(0, progress.findIndex(item => item.status === 'process'))} dataSource={progress} />
          <div className={style['ticket-summary']}>
            <div className={style['summary-facts']}>
              <div className={style['summary-item']}>
                <span className={style['summary-label']}>状态</span>
                <Tag>{labelOf(STATUS_OPTIONS, ticket.status)}</Tag>
              </div>
              <div className={style['summary-item']}>
                <span className={style['summary-label']}>优先级</span>
                <Tag>{labelOf(PRIORITY_OPTIONS, ticket.priority)}</Tag>
              </div>
              <div className={style['summary-item']}>
                <span className={style['summary-label']}>提单人</span>
                <span>{ticket.reporterName || '—'}</span>
              </div>
            </div>
            <Form
              key={(ticket.assigneeIds || []).join(',')}
              data={{ assigneeIds: ticket.assignees || [] }}
              onSubmit={async values => {
                const assigneeIds = personIds(values.assigneeIds);
                if (!assigneeIds.length) {
                  message.warning('请选择处理人');
                  return false;
                }
                try {
                  await run(mode === 'manage' ? '/api/v1/ticket/manage/assign' : '/api/v1/ticket/assign', {
                    id: ticket.id,
                    assigneeIds
                  });
                } catch (error) {
                  message.error(error.message);
                  return false;
                }
              }}
            >
              <div className={style['summary-assign']}>
                <TenantUserSelect.Input name="assigneeIds" label="处理人" rule="REQ" single={false} isPopup placeholder="请选择处理人" companyName={companyName} orgApi={memberApis.orgApi} userApi={memberApis.userApi} />
                <SubmitButton type="primary">指派</SubmitButton>
              </div>
            </Form>
          </div>
        </div>
        <div className={style.section}>
          <div className={style['section-title']}>工单内容</div>
          <SchemaContent schema={ticket.schemaSnapshot || {}} data={ticket.answers || {}} />
        </div>
        {supplement ? (
          <div className={style.section}>
            <div className={style['section-title']}>补充信息{supplement.templateName ? ` · ${supplement.templateName}` : ''}</div>
            {supplement.submitted ? (
              supplement.templateId ? (
                <SchemaContent schema={supplement.schemaSnapshot || {}} data={supplement.answers || {}} />
              ) : (
                <div className={style['comment-body']}>{supplement.note}</div>
              )
            ) : (
              <div className={style['comment-body']}>{supplement.templateId ? '已选择模板，等待提单人填写' : '等待提单人用多行文本补充'}</div>
            )}
          </div>
        ) : null}
        {mode === 'client' && ticket.status === 'supplement' && supplement ? (
          <div className={style.section}>
            <div className={style['section-title']}>填写补充</div>
            <Form
              onSubmit={async values => {
                const answers = Object.fromEntries(Object.entries(values).filter(([key]) => key !== 'note'));
                try {
                  await run('/api/v1/ticket/submit-info', {
                    id: ticket.id,
                    note: values.note || '',
                    answers: supplement.templateId ? answers : {}
                  });
                } catch (error) {
                  message.error(error.message);
                  return false;
                }
              }}
            >
              {supplement.templateId ? (
                <SchemaRendererInner schema={supplement.schemaSnapshot || {}} showActions={false} />
              ) : (
                <FormInfo column={1} list={[<FormInfo.fields.TextArea key="note" name="note" label="补充说明" rule="REQ" block />]} />
              )}
              <SubmitButton type="primary">提交补充</SubmitButton>
            </Form>
          </div>
        ) : null}
        {completion ? (
          <div className={style.section}>
            <div className={style['section-title']}>完成内容{completion.templateName ? ` · ${completion.templateName}` : ''}</div>
            {completion.templateId ? <SchemaContent schema={completion.schemaSnapshot || {}} data={completion.answers || {}} /> : <div className={style['comment-body']}>{completion.note}</div>}
          </div>
        ) : null}
        <div className={style.section}>
          <div className={style['section-title']}>评论</div>
          {comments.length ? (
            <div className={style['comment-list']}>
              {comments.map(item => (
                <div key={item.id} className={style.comment}>
                  <div className={style['comment-head']}>
                    <span className={style['comment-author']}>{item.authorName || '未知'}</span>
                    {item.internal ? <Tag>内部备注</Tag> : null}
                    <span className={style['comment-time']}>{formatTime(item.createdAt)}</span>
                  </div>
                  <div className={style['comment-body']}>{item.content}</div>
                  {item.mentionNames?.length ? <div className={style['comment-mention']}>提醒 {item.mentionNames.join('、')}</div> : null}
                </div>
              ))}
            </div>
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="还没有评论" />
          )}
          <CommentForm key={commentFormKey} FormInfo={FormInfo} TenantUserSelect={TenantUserSelect} mode={mode} companyName={companyName} memberApis={memberApis} onSubmit={publish} />
        </div>
        {events.length ? (
          <div className={style.section}>
            <div className={style['section-title']}>处理记录</div>
            <div className={style['event-list']}>
              {events.map(item => (
                <div key={item.id} className={style.event}>
                  <span className={style['comment-time']}>{formatTime(item.createdAt)}</span>
                  <span>{eventText(item)}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      {mode === 'manage' && ticket.status === 'pending' ? (
        <Button type="primary" onClick={() => run('/api/v1/ticket/manage/accept', { id: ticket.id })}>
          受理
        </Button>
      ) : null}
      {mode === 'manage' && ticket.status === 'processing' ? (
        <Space>
          <Button type="primary" onClick={openComplete}>
            完成工单
          </Button>
          <Button onClick={openRequestInfo}>要求补充信息</Button>
        </Space>
      ) : null}
      {mode === 'manage' && ticket.status === 'onHold' ? (
        <Button onClick={openRequestInfo}>要求补充信息</Button>
      ) : null}
      {mode === 'manage' ? (
        <Space style={{ margin: '12px 0' }}>
          {(HANDLER_NEXT[ticket.status] || []).map(item => (
            <Button key={item.status} onClick={() => (ticket.status === 'done' && item.status === 'processing' ? openReopen() : run('/api/v1/ticket/manage/status', { id: ticket.id, status: item.status }))}>
              {item.label}
            </Button>
          ))}
        </Space>
      ) : null}
      {mode === 'client' && ticket.status === 'waiting' ? (
        <Space>
          <Button type="primary" onClick={() => run('/api/v1/ticket/status', { id: ticket.id, status: 'done' })}>
            确认完成
          </Button>
          <Button onClick={() => run('/api/v1/ticket/status', { id: ticket.id, status: 'processing' })}>退回处理中</Button>
        </Space>
      ) : null}
      {mode === 'client' && ticket.status === 'done' ? <Button onClick={openReopen}>重开</Button> : null}
      <Button onClick={toggleWatch}>{detail.watching ? '取消关注' : '关注'}</Button>
      </InfoPage>
    </PageView>
  );
});

export default TicketDetailPage;
