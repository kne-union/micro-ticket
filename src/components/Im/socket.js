import { getOidcClient } from '../../commons/oidcClient';

export const apiUrl = path => `${String(window.runtimeApiUrl || '').replace(/\/+$/, '')}${path}`;

export const authFetch = async (url, init = {}) => {
  const headers = await getOidcClient().getAuthHeaders({ method: init.method || 'GET', url });
  return fetch(url, Object.assign({}, init, { headers: Object.assign({}, init.headers, headers) }));
};

export const openImSocket = async onEvent => {
  // IM 身份是当前租户成员，令牌由会话接口签发，只在握手时校验
  const response = await authFetch(apiUrl('/api/v1/ticket/im/session'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}'
  });
  const body = await response.json();
  const token = body?.data?.wsToken;
  if (!token) {
    throw new Error(body?.msg || '消息连接失败');
  }
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = process.env.NODE_ENV === 'development' ? 'localhost:8049' : window.location.host;
  const base = window.runtimeApiUrl ? new URL(String(window.runtimeApiUrl), window.location.href).href.replace(/^http/, 'ws').replace(/\/$/, '') : `${protocol}//${host}`;
  const socket = new WebSocket(`${base}/api/v1/im/ws?token=${encodeURIComponent(token)}`);
  socket.addEventListener('message', event => {
    try {
      onEvent(JSON.parse(event.data));
    } catch (error) {
      console.error(error);
    }
  });
  return socket;
};

export const refreshImUnread = () => {
  window.dispatchEvent(new CustomEvent('im-unread-refresh'));
};
