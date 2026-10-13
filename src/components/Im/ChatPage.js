import { createWithRemoteLoader } from '@kne/remote-loader';
import { MessageInput, MessageList } from '@kne/react-bot';
import '@kne/react-bot/dist/index.css';
import { Flex, List } from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { openImSocket, sendSocket } from './socket';

const rowsOf = body => {
  const data = body?.data?.data ?? body?.data;
  if (Array.isArray(data)) {
    return data;
  }
  return data?.list || data?.pageData || [];
};

const ChatPage = createWithRemoteLoader({
  modules: ['components-core:Global@usePreset']
})(({ remoteModules, baseUrl = '' }) => {
  const [usePreset] = remoteModules;
  const { ajax } = usePreset();
  const navigate = useNavigate();
  const socketRef = useRef(null);
  const [me, setMe] = useState(null);
  const [colleagues, setColleagues] = useState([]);
  const [notices, setNotices] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [activeName, setActiveName] = useState('');
  const [messages, setMessages] = useState([]);
  const [members, setMembers] = useState([]);

  const loadNotices = async () => {
    const { data } = await ajax({ url: '/api/v1/im/system-messages', params: { page: 1, pageSize: 20 } });
    setNotices(data?.data?.list || []);
    ajax({ url: '/api/v1/im/system-messages/read-all', method: 'POST' }).catch(() => null);
  };

  useEffect(() => {
    let closed = false;
    ajax({ url: '/api/v1/user/getUserInfo' }).then(({ data }) => {
      if (!closed) {
        setMe(data?.data?.userInfo || data?.data || null);
      }
    });
    ajax({ url: '/api/v1/ticket/members' }).then(({ data }) => {
      if (!closed) {
        setColleagues(rowsOf({ data }));
      }
    });
    loadNotices();
    const socket = openImSocket(event => {
      if (event.type === 'systemMessage') {
        loadNotices();
        return;
      }
      if (event.type === 'newMessage' || event.type === 'sendMessageSuccess') {
        const message = event.payload?.message;
        if (!message) {
          return;
        }
        setMessages(current => (current.some(item => item.id === message.id) ? current : current.concat(message)));
      }
    });
    socketRef.current = socket;
    return () => {
      closed = true;
      socket.close();
    };
  }, [ajax]);

  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      setMembers([]);
      return;
    }
    ajax({ url: `/api/v1/im/conversations/${activeId}/messages` }).then(({ data }) => {
      setMessages(data?.data?.list || []);
    });
    ajax({ url: `/api/v1/im/conversations/${activeId}/members` }).then(({ data }) => {
      setMembers(data?.data?.members || []);
    });
  }, [activeId, ajax]);

  const memberUser = useMemo(() => {
    const map = {};
    members.forEach(member => {
      map[member.id] = member.userId;
    });
    return map;
  }, [members]);

  const viewMessages = messages.map(message => {
    const mine = String(memberUser[message.senderId] || message.sender?.userId || '') === String(me?.id || '');
    return {
      id: message.id,
      role: mine ? 'user' : 'assistant',
      content: message.content
    };
  });

  const openChat = async colleague => {
    const { data } = await ajax({
      url: '/api/v1/ticket/chat/open',
      method: 'POST',
      data: { tenantUserId: colleague.id }
    });
    const conversation = data?.data?.conversation;
    if (!conversation?.id) {
      return;
    }
    setActiveName(colleague.name || colleague.email || '同事');
    setActiveId(conversation.id);
  };

  return (
    <Flex style={{ height: '100%', minHeight: 480 }}>
      <div style={{ width: 280, borderRight: '1px solid #f0f0f0', overflow: 'auto' }}>
        <List
          header="工单通知"
          dataSource={notices}
          locale={{ emptyText: '暂无通知' }}
          renderItem={item => (
            <List.Item style={{ cursor: 'pointer' }} onClick={() => item.props?.ticketId && navigate(`${baseUrl}/ticket/${item.props.ticketId}`)}>
              <List.Item.Meta title={item.title} description={item.content} />
            </List.Item>
          )}
        />
        <List
          header="组织同事"
          dataSource={colleagues.filter(item => String(item.userId || '') !== String(me?.id || ''))}
          renderItem={item => (
            <List.Item style={{ cursor: 'pointer', background: activeName === (item.name || item.email) ? '#f5f8ff' : undefined }} onClick={() => openChat(item)}>
              <List.Item.Meta title={item.name || item.email || item.id} description="发消息" />
            </List.Item>
          )}
        />
      </div>
      <Flex vertical flex={1} style={{ minWidth: 0, padding: 16 }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>{activeName || '选择同事开始交流'}</div>
        <div style={{ flex: 1, overflow: 'auto' }}>
          <MessageList markdown={false} messages={viewMessages} />
        </div>
        <MessageInput
          showVoice={false}
          borderType="default"
          placeholder="输入消息"
          disabled={!activeId}
          onSend={text => {
            const content = String(text || '').trim();
            if (!content || !activeId) {
              return;
            }
            sendSocket(socketRef.current, 'sendMessage', { conversationId: activeId, content, type: 'text' });
          }}
        />
      </Flex>
    </Flex>
  );
});

export default ChatPage;
