import { useEffect, useRef, useState } from 'react';
import { App, Button, Space, Tag } from 'antd';
import { createWithRemoteLoader } from '@kne/remote-loader';
import { unwrap } from './labels';
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
  modules: ['components-core:Layout@TablePage', 'components-core:FormInfo@useFormModal', 'components-core:Global@usePreset', 'components-core:Filter']
})(({ remoteModules }) => {
  const [TablePage, useFormModal, usePreset, Filter] = remoteModules;
  const { SearchInput, getFilterValue } = Filter;
  const { ajax } = usePreset();
  const { message, modal } = App.useApp();
  const formModal = useFormModal();
  const ref = useRef(null);
  const schemaRef = useRef(null);
  const [filter, setFilter] = useState([]);
  const filterValue = getFilterValue(filter);

  const reload = () => ref.current?.reload?.();

  const openEditor = record => {
    schemaRef.current = schemaOf(record?.schema);
    formModal({
      title: record ? '编辑公共模板' : '新建公共模板',
      size: 'large',
      width: 'calc(100vw - 48px)',
      okText: '保存',
      formProps: {
        data: {
          name: record?.name || '',
          description: record?.description || '',
          enabled: record ? record.enabled !== false : true
        },
        onSubmit: async values => {
          try {
            unwrap(
              await ajax({
                ...saveApi,
                data: {
                  id: record?.id,
                  name: values.name,
                  description: values.description,
                  enabled: values.enabled !== false,
                  schema: schemaRef.current
                }
              })
            );
          } catch (error) {
            message.error(error.message);
            return false;
          }
          message.success(record ? '公共模板已保存' : '公共模板已创建');
          reload();
        }
      },
      children: (
        <EditorBody
          key={record?.id || 'create'}
          initialSchema={schemaOf(record?.schema)}
          onSchema={schema => {
            schemaRef.current = schema;
          }}
        />
      )
    });
  };

  const remove = record => {
    modal.confirm({
      title: `删除「${record.name}」？`,
      content: '已导入到租户的模板不受影响。',
      okText: '删除',
      okButtonProps: { danger: true },
      onOk: async () => {
        unwrap(await ajax({ ...removeApi, data: { id: record.id } }));
        message.success('已删除');
        reload();
      }
    });
  };

  return (
    <TablePage
      {...listApi}
      params={filterValue}
      ref={ref}
      name="ticketBaseTemplate"
      pagination={{ paramsType: 'params' }}
      page={{
        title: '工单模板',
        filter: {
          value: filter,
          onChange: setFilter,
          list: []
        },
        titleExtra: (
          <Space align="center">
            <SearchInput name="keyword" label="名称" />
            <Button type="primary" onClick={() => openEditor(null)}>
              新建模板
            </Button>
          </Space>
        )
      }}
      columns={[
        { name: 'name', title: '名称', primary: true },
        { name: 'description', title: '说明' },
        {
          name: 'enabled',
          title: '状态',
          valueOf: item =>
            item.builtin ? (
              <Tag color="blue">系统预设</Tag>
            ) : item.enabled === false ? (
              <Tag>已停用</Tag>
            ) : (
              <Tag color="green">可导入</Tag>
            )
        },
        { name: 'updatedAt', title: '更新时间', type: 'datetime' },
        {
          name: 'options',
          title: '操作',
          type: 'options',
          valueOf: item =>
            item.builtin
              ? []
              : [
                  { children: '编辑', onClick: () => openEditor(item) },
                  { children: '删除', onClick: () => remove(item) }
                ]
        }
      ]}
    />
  );
});

export default BaseTemplatePage;
