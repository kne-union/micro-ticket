import { getToken } from '@kne/token-storage';

export const apiUrl = path => `${String(window.runtimeApiUrl || '').replace(/\/+$/, '')}${path}`;

export const openImSocket = onEvent => {
  const token = getToken('X-User-Token');
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
