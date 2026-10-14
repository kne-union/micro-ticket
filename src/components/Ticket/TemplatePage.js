import { useEffect, useMemo, useRef, useState } from 'react';
import { App, Button, Space } from 'antd';
import { createWithRemoteLoader } from '@kne/remote-loader';
import { Page } from '@kne/system-layout';
import { unwrap } from './labels';
import { TICKET_PERMISSION, hasAny } from './permissions';
import style from './style.module.scss';

const GROUP_TYPE = 'ticket-template';
const FORM_LIBRARY_TYPE = 'ticket-form-library';

const templateApis = {
  groupList: { url: '/api/v1/group/group-list', method: 'GET' },
  create: { url: '/api/v1/group/save', method: 'POST' },
  save: { url: '/api/v1/group/save', method: 'POST' },
  remove: { url: '/api/v1/group/remove', method: 'POST' },
  list: { url: '/api/v1/ticket/template/list', method: 'GET' },
  saveTemplate: { url: '/api/v1/ticket/template/save', method: 'POST' },
  libraryList: { url: '/api/v1/ticket/form-library/list', method: 'GET' },
  librarySave: { url: '/api/v1/ticket/form-library/save', method: 'POST' },
  completeList: { url: '/api/v1/ticket/complete-template/list', method: 'GET' },
  completeSave: { url: '/api/v1/ticket/complete-template/save', method: 'POST' },
  completeLibraryList: { url: '/api/v1/ticket/complete-library/list', method: 'GET' },
  completeLibrarySave: { url: '/api/v1/ticket/complete-library/save', method: 'POST' }
};

const PURPOSES = {
  content: {
    title: '工单模板',
    groupType: GROUP_TYPE,
    libraryType: FORM_LIBRARY_TYPE,
    list: templateApis.list,
    save: templateApis.saveTemplate,
    libraryList: templateApis.libraryList,
    librarySave: templateApis.librarySave
  },
  complete: {
    title: '完成模板',
    groupType: 'ticket-complete',
    libraryType: 'ticket-complete-library',
    list: templateApis.completeList,
    save: templateApis.completeSave,
    libraryList: templateApis.completeLibraryList,
    librarySave: templateApis.completeLibrarySave,
    usage: 'complete'
  },
  supplement: {
    title: '补充模板',
    groupType: 'ticket-supplement',
    libraryType: 'ticket-complete-library',
    list: templateApis.completeList,
    save: templateApis.completeSave,
    libraryList: templateApis.completeLibraryList,
    librarySave: templateApis.completeLibrarySave,
    usage: 'supplement'
  }
};

const purposeOf = purpose => PURPOSES[purpose] || PURPOSES.content;

const unwrapPayload = resData => {
  if (resData && typeof resData === 'object' && 'code' in resData) {
    if (resData.code !== 0 && resData.code !== 200) {
      throw new Error(resData.msg || resData.message || '请求失败');
    }
    return resData.results !== undefined ? resData.results : resData.data;
  }
  return resData;
};

const callApi = async (ajax, request) => {
  const { data: resData } = await ajax(request);
  return unwrapPayload(resData);
};

const mapTemplateRows = payload => {
  const rows = Array.isArray(payload) ? payload : payload?.pageData || [];
  return rows.map(item => ({
    id: item.id,
    name: item.name,
    parentId: item.parentId ? String(item.parentId) : null,
    schema: item.schema
  }));
};

const buildGroupApis = (ajax, type) => ({
  groupList: {
    loader: async () => {
      const data = await callApi(ajax, { ...templateApis.groupList, params: { type, output: 'tree' } });
      return data || [];
    }
  },
  create: async ({ data } = {}) => callApi(ajax, { ...templateApis.create, data: { ...data, type } }),
  save: async ({ data } = {}) => callApi(ajax, { ...templateApis.save, data: { ...data, type } }),
  remove: async ({ data } = {}) => callApi(ajax, { ...templateApis.remove, data: { ...data, type } })
});

const savePayload = data => ({
  id: data?.id,
  name: data?.name,
  parentId: data?.parentId || null,
  enabled: data?.enabled !== false,
  schema: data?.schema
});

/** 工单内容模板和完成模板各用自己的文件夹、自己的模板接口。 */
export const buildTicketFormCreatorApis = (ajax, purpose = 'content') => {
  const current = purposeOf(purpose);
  return {
    ...buildGroupApis(ajax, current.groupType),
    list: async () =>
      mapTemplateRows(
        await callApi(ajax, {
          ...current.list,
          params: current.usage ? { usage: current.usage } : {}
        })
      ),
    saveTemplate: async ({ data } = {}) =>
      callApi(ajax, { ...current.save, data: { ...savePayload(data), ...(current.usage ? { usage: current.usage } : {}) } })
  };
};

/** 设计器左侧片段库，完成模板和工单内容各一套。 */
export const buildFormLibraryApis = (ajax, purpose = 'content') => {
  const current = purposeOf(purpose);
  return {
    ...buildGroupApis(ajax, current.libraryType),
    list: async () => mapTemplateRows(await callApi(ajax, current.libraryList)),
    saveTemplate: async ({ data } = {}) =>
      callApi(ajax, {
        ...current.librarySave,
        data: {
          id: data?.id,
          name: data?.name,
          parentId: data?.parentId || null,
          schema: data?.schema
        }
      })
  };
};

export const parentIdOf = value => {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw == null || raw === '' || raw?.isAll) {
    return null;
  }
  if (typeof raw === 'object') {
    const id = raw.code ?? raw.id ?? raw.value;
    return id == null || id === '' ? null : id;
  }
  return raw;
};

export const TemplateCreateBody = createWithRemoteLoader({
  modules: ['components-thirdparty:FormCreator', 'components-thirdparty:FormCreator@defaultSchema', 'components-core:Global@usePreset']
})(({ remoteModules, onSchema, initialSchema, purpose = 'content' }) => {
  const [FormCreator, defaultSchema, usePreset] = remoteModules;
  const { ajax } = usePreset();
  const current = purposeOf(purpose);
  const apis = useMemo(() => buildFormLibraryApis(ajax, purpose), [ajax, purpose]);
  const [schema, setSchema] = useState(() => (initialSchema && typeof initialSchema === 'object' ? initialSchema : defaultSchema()));

  useEffect(() => {
    onSchema?.(schema);
  }, [onSchema, schema]);

  return (
    <div className={style['template-modal']}>
      <div className={style['template-meta']}>
        <TemplateCreateForm groupType={current.groupType} />
      </div>
      <div className={style['template-designer']}>
        <FormCreator value={schema} onChange={setSchema} groupType={current.libraryType} apis={apis} />
      </div>
    </div>
  );
});

const groupApis = {
  groupList: templateApis.groupList,
  create: templateApis.create,
  save: templateApis.save,
  remove: templateApis.remove
};

export const TemplateCreateForm = createWithRemoteLoader({
  modules: ['components-core:FormInfo', 'components-admin:GroupSelect@GroupFolderField']
})(({ remoteModules, groupType = GROUP_TYPE }) => {
  const [FormInfo, GroupFolderField] = remoteModules;
  const { Input } = FormInfo.fields;

  return (
    <FormInfo
      column={1}
      list={[
        <GroupFolderField
          key="parentId"
          name="parentId"
          label="文件夹"
          groupName="文件夹"
          placeholder="不选则放在根目录"
          type={groupType}
          valueKey="code"
          labelKey="name"
          single
          isPopup
          allowClear
          interceptor="object-output-value"
          manageable
          apis={groupApis}
        />,
        <Input key="name" name="name" label="模板名称" rule="REQ LEN-0-100" />
      ]}
    />
  );
});

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

const ImportPicker = createWithRemoteLoader({
  modules: ['components-core:FormInfo', 'components-core:Global@usePreset']
})(({ remoteModules }) => {
  const [FormInfo, usePreset] = remoteModules;
  const { ajax } = usePreset();
  const [options, setOptions] = useState([]);

  useEffect(() => {
    callApi(ajax, { url: '/api/v1/ticket/base-template/list', method: 'GET', params: { currentPage: 1, perPage: 100 } })
      .then(data => {
        const rows = Array.isArray(data?.pageData) ? data.pageData : [];
        setOptions(
          rows.map(item => ({
            label: item.description ? `${item.name}（${item.description}）` : item.name,
            value: item.id
          }))
        );
      })
      .catch(() => setOptions([]));
  }, [ajax]);

  return (
    <>
      <div style={{ marginBottom: 12 }}>导入后是本租户自己的副本，可以编辑。系统问卷本身不能改。</div>
      <FormInfo
        column={1}
        list={[<FormInfo.fields.Select name="id" label="公共模板" rule="REQ" options={options} placeholder={options.length ? '选择要导入的模板' : '后台还没有可导入的模板'} />]}
      />
    </>
  );
});

const TemplatePage = createWithRemoteLoader({
  modules: ['components-thirdparty:FormCreator', 'components-core:FormInfo@useFormModal', 'components-core:Global@usePreset', 'components-core:Layout@Page', 'components-core:Permissions@usePermissions']
})(({ remoteModules, layoutType = 'layout', purpose = 'content' }) => {
  const [FormCreator, useFormModal, usePreset, CorePage, usePermissions] = remoteModules;
  const { permissions } = usePermissions();
  const canEdit = hasAny(permissions, TICKET_PERMISSION.templateEdit);
  const { ajax } = usePreset();
  const { message } = App.useApp();
  const formModal = useFormModal();
  const schemaRef = useRef(null);
  const current = purposeOf(purpose);
  const apis = useMemo(() => buildTicketFormCreatorApis(ajax, purpose), [ajax, purpose]);
  const [listKey, setListKey] = useState(0);
  const PageView = layoutType === 'system-layout' ? Page : CorePage;

  const openEditor = record => {
    schemaRef.current = null;
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
            unwrap(
              await ajax({
                ...current.save,
                data: {
                  id: record?.id,
                  name: values.name,
                  parentId: parentIdOf(values.parentId),
                  enabled: record ? record.enabled !== false : true,
                  schema: schemaRef.current,
                  usage: current.usage
                }
              })
            );
          } catch (error) {
            message.error(error.message);
            return false;
          }
          message.success(record ? '模板已保存' : '模板已创建');
          setListKey(key => key + 1);
        }
      },
      children: (
        <TemplateCreateBody
          key={record?.id || 'create'}
          purpose={purpose}
          initialSchema={schemaOf(record?.schema)}
          onSchema={schema => {
            schemaRef.current = schema;
          }}
        />
      )
    });
  };

  const openImport = () => {
    formModal({
      title: '导入公共模板',
      formProps: {
        onSubmit: async values => {
          try {
            unwrap(
              await ajax({
                url: '/api/v1/ticket/template/import',
                method: 'POST',
                data: { id: values.id }
              })
            );
          } catch (error) {
            message.error(error.message);
            return false;
          }
          message.success('已复制为本租户模板，可以再改。系统问卷原文不变');
          setListKey(key => key + 1);
        }
      },
      children: <ImportPicker />
    });
  };

  const createButton = canEdit ? (
    <Space>
      {purpose === 'content' ? <Button onClick={openImport}>导入公共模板</Button> : null}
      <Button type="primary" onClick={() => openEditor(null)}>
        新建模板
      </Button>
    </Space>
  ) : null;

  return (
    <PageView title={current.title} extra={createButton} titleExtra={createButton}>
      <div className={style['template-designer']}>
        <FormCreator key={listKey} apis={apis} groupType={current.groupType} />
      </div>
    </PageView>
  );
});

export default TemplatePage;
