import { getOidcClient } from '../../commons/oidcClient';

export const apiUrl = path => `${String(window.runtimeApiUrl || '').replace(/\/+$/, '')}${path}`;

export const authFetch = async (url, init = {}) => {
  const headers = await getOidcClient().getAuthHeaders({ method: init.method || 'GET', url });
  return fetch(url, Object.assign({}, init, { headers: Object.assign({}, init.headers, headers) }));
};

export const openImSocket = onEvent => {
  // WebSocket 只在握手时校验令牌；OidcAuthenticate 保证渲染时已有可用令牌
  const token = getOidcClient()?.getTokenSet()?.accessToken;
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = process.env.NODE_ENV === 'development' ? 'localhost:8049' : window.location.host;
  const base = window.runtimeApiUrl ? new URL(String(window.runtimeApiUrl), window.location.href).href.replace(/^http/, 'ws').replace(/\/$/, '') : `${protocol}//${host}`;
  const socket = new WebSocket(`${base}/api/v1/im/ws?token=${encodeURIComponent(token || '')}`);
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

export const sendSocket = (socket, type, payload) => {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    return;
  }
  socket.send(JSON.stringify({ type, payload }));
};
