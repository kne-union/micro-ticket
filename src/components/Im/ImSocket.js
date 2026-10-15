import { useEffect, useRef } from 'react';
import { message } from 'antd';
import { useNavigate } from 'react-router-dom';
import { apiUrl, authFetch, openImSocket } from './socket';

const unreadTotal = body => {
  const payload = body?.data?.data ?? body?.data ?? body ?? {};
  const system = Number(payload.system) || 0;
  const conversations = Number(payload.total) || 0;
  return system + conversations;
};

const ImSocket = ({ baseUrl = '', onUnread }) => {
  const navigate = useNavigate();
  const onUnreadRef = useRef(onUnread);
  onUnreadRef.current = onUnread;

  useEffect(() => {
    let closed = false;
    const publishUnread = async () => {
      try {
        const response = await authFetch(apiUrl('/api/v1/im/unread-count'));
        const body = await response.json();
        if (!closed) {
          onUnreadRef.current?.(unreadTotal(body));
        }
      } catch (error) {
        console.error(error);
      }
    };
    publishUnread();
    window.addEventListener('im-unread-refresh', publishUnread);
    const socket = openImSocket(event => {
      if (event.type === 'unreadCount' || event.type === 'unreadCountUpdated' || event.type === 'unreadSystemCount' || event.type === 'systemMessage' || event.type === 'newMessage') {
        publishUnread();
      }
      if (event.type !== 'systemMessage') {
        return;
      }
      const item = event.payload?.message;
      if (!item) {
        return;
      }
      const ticketId = item.props?.ticketId;
      message.info({
        content: item.title ? `${item.title}：${item.content || ''}` : item.content || '收到工单通知',
        onClick: () => {
          if (item.id) {
            authFetch(apiUrl(`/api/v1/im/system-messages/${item.id}/read`), {
              method: 'POST'
            })
              .catch(() => null)
              .finally(() => publishUnread());
          }
          if (ticketId) {
            navigate(`${baseUrl}/ticket/${ticketId}`);
          }
        }
      });
    });
    return () => {
      closed = true;
      window.removeEventListener('im-unread-refresh', publishUnread);
      socket.close();
    };
  }, [baseUrl, navigate]);

  return null;
};

export default ImSocket;
