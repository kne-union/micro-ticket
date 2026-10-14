import { useMemo, useRef, useState } from 'react';
import { App, Button, Empty, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { createWithRemoteLoader } from '@kne/remote-loader';
import { Page } from '@kne/system-layout';
import { useIsMobile } from '@kne/responsive-utils';
import { PRIORITY_OPTIONS, unwrap } from './labels';
import { buildMemberSelectApis } from './memberSelectApis';
import { TemplateCreateBody, parentIdOf } from './TemplatePage';
import style from './style.module.scss';

const FormApiBridge = ({ useFormContext, formApiRef }) => {
  const { openApi } = useFormContext();
  formApiRef.current = openApi;
  return null;
};

const FIXED_KEYS = ['title', 'priority', 'templateId', 'expectAt', 'attachments', 'assigneeIds'];

const personIds = value => (Array.isArray(value) ? value : value ? [value] : []).map(item => (item && typeof item === 'object' ? item.id || item.value : item)).filter(Boolean);

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

const TicketCreatePage = createWithRemoteLoader({
  modules: [
    'components-core:Global@usePreset',
    'components-core:Global@useGlobalContext',
    'components-core:FormInfo',
    'components-admin:Tenant@TenantUserSelect',
    'components-core:ButtonGroup@ButtonFooter',
    'components-core:Layout@Page',
    'components-thirdparty:FormCreator@SchemaRendererInner',
    'components-core:FormInfo@useFormModal'
  ]
})(({ remoteModules, layoutType = 'system-layout', baseUrl }) => {
  const [usePreset, useGlobalContext, FormInfo, TenantUserSelect, ButtonFooter, CorePage, SchemaRendererInner, useFormModal] = remoteModules;
  const { Form, SubmitButton, CancelButton, fields } = FormInfo;
  const { Input, Select, DatePicker, Upload, SuperSelectTableList } = fields;
  const { ajax, apis } = usePreset();
  const memberApis = useMemo(() => buildMemberSelectApis(ajax, apis), [ajax, apis]);
  const { global } = useGlobalContext('userInfo');
  const companyName = global?.tenant?.name || '';
  const { message, modal } = App.useApp();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const formModal = useFormModal();
  const formApiRef = useRef(null);
  const schemaRef = useRef(null);
  const pickerRef = useRef({ close: null, reload: null });
  const PageView = layoutType === 'system-layout' ? Page : CorePage;
  const [current, setCurrent] = useState(null);

  const openTemplateEditor = (record, reload) => {
    schemaRef.current = schemaOf(record?.schema);
    formModal({
      title: record ? '编辑模板' : '新建模板',
      size: 'large',
      width: 'calc(100vw - 48px)',
      okText: '保存模板',
      formProps: {
        data: {
          name: record?.name || '',
          parentId: record?.parentId || null
        },
        onSubmit: async values => {
          try {
            const saved = unwrap(
              await ajax({
                url: '/api/v1/ticket/template/save',
                method: 'POST',
                data: {
                  id: record?.id,
                  name: values.name,
                  parentId: parentIdOf(values.parentId),
                  enabled: record ? record.enabled !== false : true,
                  schema: schemaRef.current
                }
              })
            );
            if (!record || current?.id === record.id) {
              setCurrent(saved);
              formApiRef.current?.setFields([{ name: 'templateId', value: [saved] }]);
            }
            reload?.();
            message.success(record ? '模板已保存' : '模板已创建');
          } catch (error) {
            message.error(error.message);
            return false;
          }
        }
      },
      children: (
        <TemplateCreateBody
          key={record?.id || 'create'}
          initialSchema={schemaOf(record?.schema)}
          onSchema={schema => {
            schemaRef.current = schema;
          }}
        />
      )
    });
  };

  const openCreateTemplate = reload => openTemplateEditor(null, reload);

  const removeTemplate = (record, reload) => {
    modal.confirm({
      title: `删除「${record.name}」？`,
      content: '已提交的工单不受影响。',
      okText: '删除',
      okButtonProps: { danger: true },
      onOk: async () => {
        unwrap(await ajax({ url: '/api/v1/ticket/template/remove', method: 'POST', data: { id: record.id } }));
        if (current?.id === record.id) {
          setCurrent(null);
          formApiRef.current?.setFields([{ name: 'templateId', value: [] }]);
        }
        message.success('已删除');
        reload?.();
      }
    });
  };

  const submit = async formData => {
    const attachments = [].concat(formData.attachments || []);
    const picked = Array.isArray(formData.templateId) ? formData.templateId[0] : formData.templateId;
    const templateId = picked && typeof picked === 'object' ? picked.id : picked;
    const data = unwrap(
      await ajax({
        url: '/api/v1/ticket/create',
        method: 'POST',
        data: {
          title: formData.title,
          priority: formData.priority,
          templateId,
          assigneeIds: personIds(formData.assigneeIds),
          expectAt: formData.expectAt?.toISOString ? formData.expectAt.toISOString() : formData.expectAt || null,
          attachmentIds: attachments.map(item => (typeof item === 'string' ? item : item?.id || item?.fileId)).filter(Boolean),
          answers: Object.fromEntries(Object.entries(formData || {}).filter(([key]) => !FIXED_KEYS.includes(key)))
        }
      })
    );
    message.success(`已提交 ${data.no}`);
    navigate(`${baseUrl}/ticket/${data.id}`);
  };

  return (
    <PageView title="新建工单" back>
      <div className={style['create-page']}>
        <Form data={{ priority: 'medium' }} onSubmit={submit}>
          <FormApiBridge useFormContext={FormInfo.useFormContext} formApiRef={formApiRef} />
          <div className={style['section']}>
            <FormInfo
              title="选择模板"
              subtitle={current?.description || '不同类型的问题对应不同模板，选择后会出现需要填写的内容'}
              column={1}
              list={[
                <SuperSelectTableList
                  name="templateId"
                  label="工单模板"
                  rule="REQ"
                  single
                  isPopup={false}
                  placeholder="请选择工单模板"
                  labelKey="name"
                  valueKey="id"
                  pagination={{ paramsType: 'data' }}
                  getSearchProps={keyword => ({ keyword })}
                  api={{
                    loader: async ({ data } = {}) => {
                      const rows = unwrap(await ajax({ url: '/api/v1/ticket/template/list', method: 'GET', params: { enabledOnly: true } })) || [];
                      const keyword = String(data?.keyword || '').trim();
                      const filtered = keyword ? rows.filter(item => String(item.name || '').includes(keyword)) : rows;
                      const currentPage = Number(data?.currentPage) || 1;
                      const perPage = Number(data?.perPage) || 20;
                      const start = (currentPage - 1) * perPage;
                      return { pageData: filtered.slice(start, start + perPage), totalCount: filtered.length };
                    }
                  }}
                  columns={[
                    {
                      name: 'name',
                      title: '模板名称',
                      width: 220,
                      valueOf: item => (item.builtin ? `${item.name}（系统，不可修改）` : item.name)
                    },
                    { name: 'description', title: '说明', width: 280 },
                    {
                      name: 'options',
                      title: '操作',
                      renderType: 'options',
                      width: 140,
                      getValueOf: item =>
                        item.builtin
                          ? []
                          : [
                              {
                                children: '编辑',
                                onClick: event => {
                                  event?.stopPropagation?.();
                                  const { close, reload } = pickerRef.current;
                                  close?.();
                                  openTemplateEditor(item, reload);
                                }
                              },
                              {
                                children: '删除',
                                onClick: event => {
                                  event?.stopPropagation?.();
                                  removeTemplate(item, pickerRef.current.reload);
                                }
                              }
                            ]
                    }
                  ]}
                  onChange={value => setCurrent((Array.isArray(value) ? value[0] : value) || null)}
                  footer={({ close, reload }) => {
                    pickerRef.current = { close, reload };
                    return (
                      <Button
                        type="link"
                        icon={<PlusOutlined />}
                        onClick={() => {
                          close?.();
                          openCreateTemplate(reload);
                        }}
                      >
                        新建模板
                      </Button>
                    );
                  }}
                />
              ]}
            />
          </div>
          <div className={style['section']}>
            <FormInfo
              title="基本信息"
              column={isMobile ? 1 : 2}
              list={[
                <Input name="title" label="标题" rule="REQ LEN-0-200" placeholder="一句话描述问题" block />,
                <Select name="priority" label="优先级" rule="REQ" options={PRIORITY_OPTIONS} />,
                <DatePicker name="expectAt" label="期望完成时间" />,
                <TenantUserSelect.Input name="assigneeIds" label="处理人" single={false} isPopup placeholder="可以先不指派" companyName={companyName} orgApi={memberApis.orgApi} userApi={memberApis.userApi} block />,
                <Upload name="attachments" label="附件" block />
              ]}
            />
          </div>
          <div className={style['section']}>
            <div className={style['section-title']}>工单内容</div>
            {current?.schema ? <SchemaRendererInner schema={current.schema} showActions={false} /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<Typography.Text type="secondary">选择模板后填写</Typography.Text>} />}
          </div>
          {layoutType === 'system-layout' ? (
            <Page.Footer>
              <CancelButton onClick={() => navigate(-1)}>取消</CancelButton>
              <SubmitButton type="primary">提交工单</SubmitButton>
            </Page.Footer>
          ) : (
            <ButtonFooter className={style['form-footer']} placement="bottomEnd">
              <CancelButton onClick={() => navigate(-1)}>取消</CancelButton>
              <SubmitButton type="primary">提交工单</SubmitButton>
            </ButtonFooter>
          )}
        </Form>
      </div>
    </PageView>
  );
});

export default TicketCreatePage;
