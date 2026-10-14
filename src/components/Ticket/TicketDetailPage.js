import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Button, Empty, Tag, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useLocation, useParams } from 'react-router-dom';
import { createWithRemoteLoader } from '@kne/remote-loader';
import { Page } from '@kne/system-layout';
import { PRIORITY_OPTIONS, PRIORITY_STATE, SLA_STATE, STATUS_OPTIONS, STATUS_STATE, labelOf, unwrap } from './labels';
import { buildMemberSelectApis } from './memberSelectApis';
import { TemplateCreateBody, parentIdOf } from './TemplatePage';
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

// components-core Flow 的 type="dot" 只把圆点 class 交给 antd 6。antd 5 要根节点带 ant-steps-dot，图标才是 ant-steps-icon-dot。
const paintAntd5FlowDots = root => {
  const steps = root?.querySelector('.kne-info-flow-dot');
  if (!steps) {
    return;
  }
  steps.classList.add('ant-steps-dot');
  steps.querySelectorAll('.ant-steps-item-icon > .ant-steps-icon').forEach(icon => {
    if (icon.querySelector('.ant-steps-icon-dot')) {
      return;
    }
    icon.replaceChildren();
    const dot = document.createElement('span');
    dot.className = 'ant-steps-icon-dot';
    icon.appendChild(dot);
  });
};

const eventText = item => {
  const who = item.operatorName || '有人';
  if (item.type === 'assign') {
    return `${who} 将处理人从「${item.fromName || '未指派'}」改为「${item.toName || '未指派'}」`;
  }
  if (item.type === 'sla') {
    return `${item.fromName || '时限'}超时，升级通知 ${item.toName || '下一级'}`;
  }
  return `${who} 将状态从「${labelOf(STATUS_OPTIONS, item.fromValue)}」改为「${labelOf(STATUS_OPTIONS, item.toValue)}」`;
};

const schemaOf = value => {
  if (value && typeof value === 'object') {
    return value;
  }
  if (typeof value === 'string' && value) {
    try {
      return JSON.parse(value);
    } catch (error) {
      return null;
    }
  }
  return null;
};

const hasFillFields = schema => {
  const blocks = schemaOf(schema)?.blocks;
  return Array.isArray(blocks) && blocks.some(block => Array.isArray(block.list) && block.list.length > 0);
};

const CompleteBody = ({ FormInfo, SchemaRendererInner, ajax, onCreateTemplate }) => {
  const { SuperSelectTableList, TextArea } = FormInfo.fields;
  const [template, setTemplate] = useState(null);
  const rowsRef = useRef([]);
  const reloadRef = useRef(null);

  const pickTemplate = value => {
    const picked = Array.isArray(value) ? value[0] : value;
    if (!picked) {
      setTemplate(null);
      return;
    }
    if (typeof picked === 'object' && hasFillFields(picked.schema)) {
      setTemplate({ ...picked, schema: schemaOf(picked.schema) });
      return;
    }
    const id = typeof picked === 'object' ? picked.id : picked;
    const row = rowsRef.current.find(item => String(item.id) === String(id));
    setTemplate(row ? { ...row, schema: schemaOf(row.schema) } : null);
  };

  return (
    <div className={style['complete-body']}>
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
                rowsRef.current = rows;
                return { pageData: rows, totalCount: rows.length };
              }
            }}
            columns={[
              { name: 'name', title: '模板名称', width: 220 },
              { name: 'description', title: '说明' }
            ]}
            onChange={pickTemplate}
            footer={({ close, reload }) => {
              reloadRef.current = reload;
              return (
                <Button
                  type="link"
                  icon={<PlusOutlined />}
                  onClick={() => {
                    close?.();
                    onCreateTemplate?.(() => {
                      reloadRef.current?.();
                    });
                  }}
                >
                  新建模板
                </Button>
              );
            }}
          />
        ]}
      />
      <div className={style['complete-fields']}>
        <div className={style['section-title']}>完成信息</div>
        {template && hasFillFields(template.schema) ? (
          <SchemaRendererInner schema={template.schema} showActions={false} />
        ) : (
          <FormInfo column={1} list={[<TextArea key="note" name="note" label="完成说明" rule="REQ" block placeholder="说明处理结果" />]} />
        )}
      </div>
    </div>
  );
};

const SupplementRequestBody = ({ FormInfo, SchemaRendererInner, ajax }) => {
  const { SuperSelectTableList } = FormInfo.fields;
  const [template, setTemplate] = useState(null);

  return (
    <div className={style['supplement-request']}>
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
            block
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
      {template ? <SchemaRendererInner schema={template.schema || {}} showActions={false} /> : <div className={style['supplement-hint']}>默认使用多行文本，由提单人填写。</div>}
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

const COMMENT_COLORS = ['#4c6fff', '#0f9d8a', '#d48806', '#c4527a', '#5b6ee1'];

const commentInitial = name => String(name || '?').trim().slice(0, 1) || '?';

const commentColor = name => COMMENT_COLORS[[...String(name || '')].reduce((sum, char) => sum + char.charCodeAt(0), 0) % COMMENT_COLORS.length];

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
    'components-admin:Tenant@TenantUserSelect',
    'components-core:ButtonGroup@ButtonFooter',
    'components-core:StateTag'
  ]
})(({ remoteModules, layoutType = 'layout', mode = 'client', baseUrl, ticketId, embedded = false }) => {
  const [usePreset, useGlobalContext, CorePage, SchemaContent, FormInfo, useFormModal, SchemaRendererInner, InfoPage, Flow, TenantUserSelect, ButtonFooter, StateTag] = remoteModules;
  const { Form, SubmitButton } = FormInfo;
  const { ajax, apis } = usePreset();
  const memberApis = useMemo(() => buildMemberSelectApis(ajax, apis), [ajax, apis]);
  const { global } = useGlobalContext('userInfo');
  const companyName = global?.tenant?.name || '';
  const formModal = useFormModal();
  const { id: routeId } = useParams();
  const id = ticketId || routeId;
  const { pathname } = useLocation();
  const PageView = layoutType === 'system-layout' ? Page : CorePage;
  const listUrl = baseUrl ? `${baseUrl}/ticket` : pathname.replace(/\/ticket\/[^/]+$/, '/ticket');
  const pageChrome = extra => (layoutType === 'system-layout' ? { back: true, extra } : { backUrl: listUrl, titleExtra: extra });
  const [detail, setDetail] = useState(null);
  const [commentFormKey, setCommentFormKey] = useState(0);
  const eventFlowRef = useRef(null);

  useLayoutEffect(() => {
    paintAntd5FlowDots(eventFlowRef.current);
  });

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
    if (embedded) {
      return null;
    }
    return <PageView title="工单详情" {...pageChrome()} />;
  }

  const { ticket, comments = [], events = [], completion, supplement } = detail;
  const meId = String(global?.tenantUserInfo?.id || '');
  const assigneeIds = (ticket.assigneeIds || []).map(id => String(id));
  const isAssignee = !!meId && assigneeIds.includes(meId);
  const isReporter = !!meId && String(ticket.reporterTenantUserId || '') === meId;
  const acting = mode === 'manage' || (!!detail.canHandle && (isAssignee || assigneeIds.length === 0));

  const openCompleteTemplate = reload => {
    const schemaRef = { current: null };
    formModal({
      title: '新建完成模板',
      size: 'large',
      width: 'calc(100vw - 48px)',
      okText: '保存模板',
      formProps: {
        onSubmit: async values => {
          try {
            unwrap(
              await ajax({
                url: '/api/v1/ticket/complete-template/save',
                method: 'POST',
                data: {
                  name: values.name,
                  parentId: parentIdOf(values.parentId),
                  enabled: true,
                  usage: 'complete',
                  schema: schemaRef.current
                }
              })
            );
            message.success('模板已创建');
            reload?.();
          } catch (error) {
            message.error(error.message);
            return false;
          }
        }
      },
      children: (
        <TemplateCreateBody
          purpose="complete"
          onSchema={schema => {
            schemaRef.current = schema;
          }}
        />
      )
    });
  };

  const openComplete = () => {
    formModal({
      title: '完成工单',
      className: style['complete-modal'],
      width: 800,
      okText: '提交完成',
      formProps: {
        onSubmit: async values => {
          const picked = Array.isArray(values.templateId) ? values.templateId[0] : values.templateId;
          const templateId = picked && typeof picked === 'object' ? picked.id : picked || null;
          const answers = Object.fromEntries(Object.entries(values).filter(([key]) => key !== 'templateId' && key !== 'note'));
          try {
            await run(acting ? '/api/v1/ticket/manage/complete' : '/api/v1/ticket/complete', {
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
      children: <CompleteBody FormInfo={FormInfo} SchemaRendererInner={SchemaRendererInner} ajax={ajax} onCreateTemplate={openCompleteTemplate} />
    });
  };

  const openReopen = () => {
    formModal({
      title: '重开原因',
      formProps: {
        onSubmit: async values => {
          try {
            await run(acting ? '/api/v1/ticket/manage/status' : '/api/v1/ticket/status', {
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
      className: style['supplement-modal'],
      width: 640,
      okText: '发送给提单人',
      formProps: {
        onSubmit: async values => {
          const picked = Array.isArray(values.templateId) ? values.templateId[0] : values.templateId;
          const templateId = picked && typeof picked === 'object' ? picked.id : picked || null;
          try {
            await run(acting ? '/api/v1/ticket/manage/request-info' : '/api/v1/ticket/request-info', { id: ticket.id, templateId });
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
    const url = acting ? '/api/v1/ticket/manage/comment' : '/api/v1/ticket/comment';
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
  const footerItems = [{ key: 'watch', label: detail.watching ? '取消关注' : '关注', primary: false, onClick: toggleWatch }];
  if (acting && ticket.status === 'pending') {
    footerItems.push({ key: 'accept', label: '受理', primary: true, onClick: () => run('/api/v1/ticket/manage/accept', { id: ticket.id }) });
  }
  if (acting && (ticket.status === 'processing' || ticket.status === 'onHold')) {
    footerItems.push({ key: 'request', label: '要求补充信息', primary: false, onClick: openRequestInfo });
  }
  if (acting && ticket.status === 'processing') {
    footerItems.push({ key: 'complete', label: '完成工单', primary: true, onClick: openComplete });
  }
  if (acting) {
    (HANDLER_NEXT[ticket.status] || []).forEach(item => {
      const reopen = ticket.status === 'done' && item.status === 'processing';
      footerItems.push({
        key: item.status,
        label: item.label,
        primary: ticket.status === 'onHold' || ticket.status === 'supplement' || reopen,
        onClick: () => (reopen ? openReopen() : run(acting ? '/api/v1/ticket/manage/status' : '/api/v1/ticket/status', { id: ticket.id, status: item.status }))
      });
    });
  }
  if (mode === 'client' && isReporter && ticket.status === 'waiting') {
    footerItems.push(
      { key: 'reject', label: '退回处理中', primary: false, onClick: () => run('/api/v1/ticket/status', { id: ticket.id, status: 'processing' }) },
      { key: 'confirm', label: '确认完成', primary: true, onClick: () => run('/api/v1/ticket/status', { id: ticket.id, status: 'done' }) }
    );
  }
  if (mode === 'client' && isReporter && !acting && ticket.status === 'done') {
    footerItems.push({ key: 'reopen', label: '重开', primary: true, onClick: openReopen });
  }
  const footerActions = [...footerItems.filter(item => !item.primary), ...footerItems.filter(item => item.primary)].map(item => (
    <Button key={item.key} type={item.primary ? 'primary' : 'default'} onClick={item.onClick}>
      {item.label}
    </Button>
  ));

  const useLayoutFooter = !embedded && layoutType === 'system-layout';
  const detailBody = (
      <div className={`${style['detail-page']}${embedded ? ` ${style['detail-embed']}` : ''}${useLayoutFooter ? ` ${style['detail-layout-footer']}` : ''}`}>
      <InfoPage>
        <div className={style.section}>
          <Flow orientation="horizontal" current={ticket.status === 'done' ? progress.length - 1 : Math.max(0, progress.findIndex(item => item.status === 'process'))} dataSource={progress} />
          <div className={style['ticket-summary']}>
            <div className={style['summary-facts']}>
              <div className={style['summary-item']}>
                <span className={style['summary-label']}>状态</span>
                <StateTag type={STATUS_STATE[ticket.status] || 'default'} text={labelOf(STATUS_OPTIONS, ticket.status)} />
              </div>
              <div className={style['summary-item']}>
                <span className={style['summary-label']}>优先级</span>
                <StateTag type={PRIORITY_STATE[ticket.priority] || 'default'} text={labelOf(PRIORITY_OPTIONS, ticket.priority)} />
              </div>
              <div className={style['summary-item']}>
                <span className={style['summary-label']}>提单人</span>
                <span>{ticket.reporterName || '—'}</span>
              </div>
              <div className={style['summary-item']}>
                <span className={style['summary-label']}>SLA</span>
                <StateTag type={SLA_STATE[ticket.sla?.type] || 'default'} text={ticket.sla?.text || '-'} />
              </div>
              <div className={style['summary-item']}>
                <span className={style['summary-label']}>响应时限</span>
                <span>{formatTime(ticket.responseDueAt) || '—'}</span>
              </div>
              <div className={style['summary-item']}>
                <span className={style['summary-label']}>解决时限</span>
                <span>{formatTime(ticket.resolveDueAt) || '—'}</span>
              </div>
            </div>
            {['waiting', 'done'].includes(ticket.status) ? (
              <div className={style['summary-item']}>
                <span className={style['summary-label']}>处理人</span>
                <span>{ticket.assigneeName || '—'}</span>
              </div>
            ) : (
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
                    await run(acting ? '/api/v1/ticket/manage/assign' : '/api/v1/ticket/assign', {
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
            )}
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
                  <span className={style['comment-avatar']} style={{ background: commentColor(item.authorName) }}>
                    {commentInitial(item.authorName)}
                  </span>
                  <div className={style['comment-main']}>
                    <div className={style['comment-head']}>
                      <span className={style['comment-author']}>{item.authorName || '未知'}</span>
                      {item.internal ? <Tag>内部备注</Tag> : null}
                      <span className={style['comment-time']}>{formatTime(item.createdAt)}</span>
                    </div>
                    <div className={style['comment-body']}>{item.content}</div>
                    {item.mentionNames?.length ? <div className={style['comment-mention']}>提醒 {item.mentionNames.join('、')}</div> : null}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="还没有评论" />
          )}
          <CommentForm key={commentFormKey} FormInfo={FormInfo} TenantUserSelect={TenantUserSelect} mode={acting ? 'manage' : mode} companyName={companyName} memberApis={memberApis} onSubmit={publish} />
        </div>
        <div className={style.section} ref={eventFlowRef}>
          <div className={style['section-title']}>处理记录</div>
          <Flow
            orientation="vertical"
            type="dot"
            progressDot
            dataSource={[...events]
              .map((item, index) => ({ item, index }))
              .sort((a, b) => new Date(b.item.createdAt).getTime() - new Date(a.item.createdAt).getTime() || b.index - a.index)
              .map(({ item }) => ({
                title: eventText(item),
                description: formatTime(item.createdAt),
                status: 'finish'
              }))}
          />
        </div>
      </InfoPage>
      {footerActions.length ? (
        useLayoutFooter ? (
          <Page.Footer>{footerActions}</Page.Footer>
        ) : (
          <ButtonFooter className={style['form-footer']} placement="bottomEnd">
            {footerActions}
          </ButtonFooter>
        )
      ) : null}
      </div>
  );

  if (embedded) {
    return detailBody;
  }

  return (
    <PageView title={`${ticket.no} ${ticket.title}`} {...pageChrome()}>
      {detailBody}
    </PageView>
  );
});

export default TicketDetailPage;
