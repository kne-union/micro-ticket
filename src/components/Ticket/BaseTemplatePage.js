import { useEffect, useRef, useState } from 'react';
import { createWithRemoteLoader } from '@kne/remote-loader';
import style from './style.module.scss';

const listApi = { url: '/api/v1/admin/ticket-base-template/list', method: 'GET' };
const saveApi = { url: '/api/v1/admin/ticket-base-template/save', method: 'POST' };
const removeApi = { url: '/api/v1/admin/ticket-base-template/remove', method: 'POST' };

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

const emptyLibraryApis = {
  groupList: { loader: async () => [] },
  create: async () => ({}),
  save: async () => ({}),
  remove: async () => ({}),
  list: async () => [],
  saveTemplate: async () => ({})
};

const EditorBody = createWithRemoteLoader({
  modules: ['components-core:FormInfo', 'components-thirdparty:FormCreator', 'components-thirdparty:FormCreator@defaultSchema']
})(({ remoteModules, onSchema, initialSchema }) => {
  const [FormInfo, FormCreator, defaultSchema] = remoteModules;
  const { Input, TextArea, Switch } = FormInfo.fields;
  const [schema, setSchema] = useState(() => schemaOf(initialSchema) || defaultSchema());

  useEffect(() => {
    onSchema?.(schema);
  }, [onSchema, schema]);

  return (
    <div className={style['template-modal']}>
      <div className={style['template-meta']}>
        <FormInfo
          column={1}
          list={[
            <Input name="name" label="模板名称" rule="REQ LEN-0-100" />,
            <TextArea name="description" label="说明" rule="LEN-0-500" />,
            <Switch name="enabled" label="允许导入" />
          ]}
        />
      </div>
      <div className={style['template-designer']}>
        <FormCreator
          value={schema}
          onChange={next => {
            setSchema(next);
            onSchema?.(next);
          }}
          apis={emptyLibraryApis}
        />
      </div>
    </div>
  );
});

const BaseTemplatePage = createWithRemoteLoader({
  modules: ['components-admin:BizUnit', 'components-core:FormInfo@useFormModal', 'components-thirdparty:FormCreator@SchemaRendererInner']
})(({ remoteModules }) => {
  const [BizUnit, useFormModal, SchemaRendererInner] = remoteModules;
  const formModal = useFormModal();
  const schemaRef = useRef(null);
  const editingRef = useRef(null);

  const templatePayload = (formData, id) => ({
    ...saveApi,
    data: {
      id,
      name: formData.name,
      description: formData.description,
      enabled: formData.enabled !== false,
      schema: schemaRef.current
    }
  });

  const openView = record => {
    formModal({
      title: '查看公共模板',
      size: 'large',
      width: 'calc(100vw - 48px)',
      footerButtons: [{ children: '关闭' }],
      formProps: {
        onSubmit: () => true
      },
      children: (
        <div className={style['template-view']}>
          <div>
            <div className={style['view-name']}>{record.name}</div>
            <div className={style['view-desc']}>{record.description || '—'}</div>
          </div>
          <SchemaRendererInner schema={schemaOf(record.schema) || {}} showActions={false} />
        </div>
      )
    });
  };

  return (
    <BizUnit
      isNext
      name="ticketBaseTemplate"
      page={{ title: '工单模板' }}
      apis={{
        list: listApi,
        create: ({ formData }) => templatePayload(formData),
        save: ({ formData, data }) => templatePayload(formData, data.id),
        remove: ({ data }) => ({ ...removeApi, data: { id: data.id } })
      }}
      getColumns={() => [
        { name: 'name', title: '名称', renderType: 'main' },
        { name: 'description', title: '说明', renderType: 'description', ellipsis: true },
        {
          name: 'enabled',
          title: '状态',
          renderType: 'tag',
          getValueOf: item => (item.builtin ? { type: 'processing', text: '系统预设' } : item.enabled === false ? { type: 'default', text: '已停用' } : { type: 'success', text: '可导入' })
        },
        { name: 'updatedAt', title: '更新时间', format: 'datetime' }
      ]}
      getFormInner={() => (
        <EditorBody
          key={editingRef.current?.id || 'create'}
          initialSchema={schemaRef.current}
          onSchema={schema => {
            schemaRef.current = schema;
          }}
        />
      )}
      getActionList={({ data }) =>
        data.builtin
          ? [
              { name: 'save', reset: () => ({ hidden: true }) },
              { name: 'remove', reset: () => ({ hidden: true }) },
              { children: '查看', onClick: () => openView(data) }
            ]
          : [{ name: 'save' }, { name: 'remove' }]
      }
      options={{
        bizName: '公共模板',
        keywordFilterName: 'keyword',
        keywordFilterLabel: '名称',
        formSize: 'large',
        showLength: 2,
        createButtonProps: { children: '新建模板', type: 'primary' },
        editButtonProps: { children: '编辑' },
        removeButtonProps: { children: '删除' },
        removeMessage: '已导入到租户的模板不受影响。',
        formModalProps: { width: 'calc(100vw - 48px)', okText: '保存' },
        createFormModalProps: { title: '新建公共模板' },
        editFormModalProps: { title: '编辑公共模板' },
        formProps: ({ action, data }) => {
          if (action === 'edit') {
            editingRef.current = data;
            schemaRef.current = schemaOf(data?.schema);
            return {};
          }
          editingRef.current = null;
          schemaRef.current = null;
          return { data: { enabled: true } };
        },
        tableProps: {
          pagination: { paramsType: 'params', currentName: 'currentPage', pageSizeName: 'perPage' }
        }
      }}
    />
  );
});

export default BaseTemplatePage;
