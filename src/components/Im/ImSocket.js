import { useEffect } from 'react';
import { message } from 'antd';
import { useNavigate } from 'react-router-dom';
import { getToken } from '@kne/token-storage';
import { openImSocket } from './socket';

const ImSocket = ({ baseUrl = '' }) => {
  const navigate = useNavigate();

  useEffect(() => {
    const socket = openImSocket(event => {
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
            const token = getToken('X-User-Token');
            fetch(`/api/v1/im/system-messages/${item.id}/read`, {
              method: 'POST',
              headers: token ? { 'x-user-token': token } : {}
            }).catch(() => null);
          }
          if (ticketId) {
            navigate(`${baseUrl}/ticket/${ticketId}`);
          }
        }
      });
    });
    return () => socket.close();
  }, [baseUrl, navigate]);

  return null;
};

export default ImSocket;
