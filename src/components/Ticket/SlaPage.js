import { useEffect, useState } from 'react';
import { App } from 'antd';
import { createWithRemoteLoader } from '@kne/remote-loader';
import { Page } from '@kne/system-layout';
import { PRIORITY_OPTIONS, unwrap } from './labels';

const WEEKDAYS = [
  { label: '周一', value: 1 },
  { label: '周二', value: 2 },
  { label: '周三', value: 3 },
  { label: '周四', value: 4 },
  { label: '周五', value: 5 },
  { label: '周六', value: 6 },
  { label: '周日', value: 7 }
];

const hoursOf = minutes => Math.round((Number(minutes) / 60) * 10) / 10;

const toForm = policy => ({
  weekdays: policy.weekdays,
  startTime: policy.startTime,
  endTime: policy.endTime,
  holidays: (policy.holidays || []).join('\n'),
  extraWorkdays: (policy.extraWorkdays || []).join('\n'),
  ...Object.fromEntries(
    PRIORITY_OPTIONS.flatMap(item => [
      [`${item.value}ResponseHours`, hoursOf(policy.targets?.[item.value]?.responseMinutes)],
      [`${item.value}ResolveHours`, hoursOf(policy.targets?.[item.value]?.resolveMinutes)]
    ])
  ),
  escalation: (policy.escalation || []).map(item => ({
    tenantUserId: item.tenantUserId,
    afterHours: hoursOf(item.afterMinutes)
  }))
});

const SlaPage = createWithRemoteLoader({
  modules: ['components-core:FormInfo', 'components-core:Global@usePreset']
})(({ remoteModules }) => {
  const [FormInfo, usePreset] = remoteModules;
  const { Form, SubmitButton, List, fields } = FormInfo;
  const { Input, TextArea, InputNumber, Select, CheckboxGroup } = fields;
  const { ajax } = usePreset();
  const { message } = App.useApp();
  const [policy, setPolicy] = useState(null);
  const [members, setMembers] = useState([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([ajax({ url: '/api/v1/ticket/sla', method: 'GET' }), ajax({ url: '/api/v1/ticket/manage/members', method: 'GET' })])
      .then(([policyRes, memberRes]) => {
        if (cancelled) {
          return;
        }
        setPolicy(toForm(unwrap(policyRes)));
        const rows = unwrap(memberRes);
        setMembers(Array.isArray(rows) ? rows : []);
      })
      .catch(error => message.error(error.message || 'SLA 配置加载失败'));
    return () => {
      cancelled = true;
    };
  }, [ajax, message]);

  if (!policy) {
    return <Page title="SLA" />;
  }

  return (
    <Page title="SLA">
      <Form
        data={policy}
        onSubmit={async values => {
          try {
            unwrap(
              await ajax({
                url: '/api/v1/ticket/sla/save',
                method: 'POST',
                data: {
                  weekdays: values.weekdays,
                  startTime: values.startTime,
                  endTime: values.endTime,
                  holidays: values.holidays,
                  extraWorkdays: values.extraWorkdays,
                  targets: Object.fromEntries(
                    PRIORITY_OPTIONS.map(item => [
                      item.value,
                      {
                        responseMinutes: Math.round(Number(values[`${item.value}ResponseHours`] || 0) * 60),
                        resolveMinutes: Math.round(Number(values[`${item.value}ResolveHours`] || 0) * 60)
                      }
                    ])
                  ),
                  escalation: (values.escalation || [])
                    .filter(item => item?.tenantUserId)
                    .map(item => ({
                      tenantUserId: item.tenantUserId,
                      afterMinutes: Math.round(Number(item.afterHours || 0) * 60)
                    }))
                }
              })
            );
            message.success('已保存');
          } catch (error) {
            message.error(error.message || '保存失败');
            return false;
          }
        }}
      >
        <FormInfo
          title="营业时间"
          column={2}
          list={[
            <CheckboxGroup key="weekdays" name="weekdays" label="工作日" rule="REQ" block options={WEEKDAYS} />,
            <Input key="startTime" name="startTime" label="上班" rule="REQ" placeholder="09:00" />,
            <Input key="endTime" name="endTime" label="下班" rule="REQ" placeholder="18:00" />,
            <TextArea key="holidays" name="holidays" label="节假日" block tips="一行一个日期，当天不计入 SLA。例如 2026-01-01" />,
            <TextArea key="extraWorkdays" name="extraWorkdays" label="调休上班" block tips="周末或节假日里仍要计时的日期。" />
          ]}
        />
        <FormInfo
          title="时限（小时）"
          column={2}
          list={PRIORITY_OPTIONS.flatMap(item => [
            <InputNumber key={`${item.value}-response`} name={`${item.value}ResponseHours`} label={`${item.label}响应`} rule="REQ" min={0.5} step={0.5} />,
            <InputNumber key={`${item.value}-resolve`} name={`${item.value}ResolveHours`} label={`${item.label}解决`} rule="REQ" min={0.5} step={0.5} />
          ])}
        />
        <List
          name="escalation"
          title="升级链"
          maxLength={8}
          addText="添加一级"
          itemTitle={({ index }) => `第 ${index + 1} 级`}
          list={[
            <Select
              key="tenantUserId"
              name="tenantUserId"
              label="通知谁"
              rule="REQ"
              options={members.map(member => ({ value: member.id, label: member.name || member.email || member.id }))}
            />,
            <InputNumber key="afterHours" name="afterHours" label="超时后（小时）" min={0} step={0.5} />
          ]}
        />
        <SubmitButton type="primary">保存</SubmitButton>
      </Form>
    </Page>
  );
});

export default SlaPage;
