export const STATUS_OPTIONS = [
  { value: 'pending', label: '待受理' },
  { value: 'processing', label: '处理中' },
  { value: 'supplement', label: '要求补充信息' },
  { value: 'onHold', label: '已挂起' },
  { value: 'waiting', label: '待确认' },
  { value: 'done', label: '已完成' }
];

export const PRIORITY_OPTIONS = [
  { value: 'low', label: '低' },
  { value: 'medium', label: '中' },
  { value: 'high', label: '高' },
  { value: 'urgent', label: '紧急' }
];

export const labelOf = (options, value) => options.find(item => item.value === value)?.label || value || '-';

export const STATUS_STATE = {
  pending: 'info',
  processing: 'progress',
  supplement: 'progress',
  onHold: 'default',
  waiting: 'info',
  done: 'success'
};

export const PRIORITY_STATE = {
  low: 'default',
  medium: 'info',
  high: 'progress',
  urgent: 'danger'
};

export const SLA_STATE = {
  success: 'success',
  danger: 'danger',
  processing: 'progress',
  default: 'default'
};

export const unwrap = response => {
  const body = response?.data ?? response;
  if (body && (body.code === 0 || body.code === 200)) {
    return body.results !== undefined ? body.results : body.data;
  }
  throw new Error(body?.msg || body?.message || '请求失败');
};
