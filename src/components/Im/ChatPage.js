import { BellOutlined, CommentOutlined, LeftOutlined } from '@ant-design/icons';
import { createWithRemoteLoader } from '@kne/remote-loader';
import { MessageInput, MessageList } from '@kne/react-bot';
import '@kne/react-bot/dist/index.css';
import { MOBILE_BREAKPOINT, useIsMobile } from '@kne/responsive-utils';
import { Page } from '@kne/system-layout';
import { Button, Segmented } from 'antd';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import TicketDetailPage from '../Ticket/TicketDetailPage';
import { openImSocket, refreshImUnread, sendSocket } from './socket';
import style from './style.module.scss';

const AVATAR_COLORS = ['#4c6fff', '#0f9d8a', '#d48806', '#c4527a', '#5b6ee1'];

const rowsOf = body => {
  const data = body?.data?.data ?? body?.data;
  if (Array.isArray(data)) {
    return data;
  }
  return data?.list || data?.pageData || [];
};

const initialOf = name => String(name || '?').trim().slice(0, 1) || '?';

const colorOf = name => AVATAR_COLORS[[...String(name || '')].reduce((sum, char) => sum + char.charCodeAt(0), 0) % AVATAR_COLORS.length];

const ChatPage = createWithRemoteLoader({
  modules: ['components-core:Global@usePreset']
})(({ remoteModules, baseUrl = '' }) => {
  const [usePreset] = remoteModules;
  const { ajax } = usePreset();
  const layoutMobile = useIsMobile();
  const pageRef = useRef(null);
  const [pageNarrow, setPageNarrow] = useState(false);
  const socketRef = useRef(null);
  const selectionRef = useRef(0);
  const [me, setMe] = useState(null);
  const [colleagues, setColleagues] = useState([]);
  const [notices, setNotices] = useState([]);
  const [pane, setPane] = useState('notice');
  const [activeId, setActiveId] = useState(null);
  const [activeName, setActiveName] = useState('');
  const [thread, setThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [members, setMembers] = useState([]);

  const loadNotices = async () => {
    const { data } = await ajax({ url: '/api/v1/im/system-messages', params: { page: 1, pageSize: 20 } });
    setNotices(data?.data?.list || []);
    ajax({ url: '/api/v1/im/system-messages/read-all', method: 'POST' })
      .catch(() => null)
      .finally(() => refreshImUnread());
  };

  useLayoutEffect(() => {
    const el = pageRef.current;
    if (!el) {
      return undefined;
    }
    const fit = () => {
      setPageNarrow(el.clientWidth < MOBILE_BREAKPOINT);
      const scroller = el.closest('.is-scroller');
      if (!scroller) {
        el.style.height = '';
        return;
      }
      const offset = el.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
      const height = Math.max(320, Math.round(scroller.clientHeight - offset));
      el.style.height = `${height}px`;
      const extra = scroller.scrollHeight - scroller.clientHeight;
      if (extra > 0) {
        el.style.height = `${Math.max(320, height - extra)}px`;
      }
    };
    fit();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', fit);
      return () => window.removeEventListener('resize', fit);
    }
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    const scroller = el.closest('.is-scroller');
    if (scroller) {
      observer.observe(scroller);
    }
    window.addEventListener('resize', fit);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', fit);
    };
  }, []);

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

  const people = colleagues.filter(item => String(item.userId || '') !== String(me?.id || ''));
  const narrow = layoutMobile || pageNarrow;

  const viewMessages = messages.map(message => {
    const mine = String(memberUser[message.senderId] || message.sender?.userId || '') === String(me?.id || '');
    return {
      id: message.id,
      role: mine ? 'user' : 'assistant',
      content: message.content
    };
  });

  const openNotice = item => {
    selectionRef.current += 1;
    setActiveId(null);
    setActiveName('');
    setThread({
      kind: 'ticket',
      key: item.id,
      ticketId: item.props?.ticketId || null,
      title: item.title || '工单通知',
      content: item.content || ''
    });
  };

  const openChat = async colleague => {
    const token = ++selectionRef.current;
    const { data } = await ajax({
      url: '/api/v1/ticket/chat/open',
      method: 'POST',
      data: { tenantUserId: colleague.id }
    });
    if (token !== selectionRef.current) {
      return;
    }
    const conversation = data?.data?.conversation;
    if (!conversation?.id) {
      return;
    }
    const name = colleague.name || colleague.email || '同事';
    setActiveName(name);
    setActiveId(conversation.id);
    setThread({ kind: 'chat', key: colleague.id, name });
  };

  const noticeKey = notices.map(item => item.id).join('|');
  const peopleKey = people.map(item => item.id).join('|');

  useEffect(() => {
    if (narrow || pane !== 'notice' || !notices.length) {
      return;
    }
    if (thread?.kind === 'ticket' && notices.some(item => item.id === thread.key)) {
      return;
    }
    openNotice(notices[0]);
  }, [narrow, pane, noticeKey]);

  useEffect(() => {
    if (narrow || pane !== 'people' || !people.length) {
      return;
    }
    if (thread?.kind === 'chat' && people.some(item => String(item.id) === String(thread.key))) {
      return;
    }
    openChat(people[0]);
  }, [narrow, pane, peopleKey]);

  const closeThread = () => {
    setActiveId(null);
    setActiveName('');
    setThread(null);
  };

  const showList = !narrow || !thread;
  const showThread = !narrow || !!thread;

  return (
    <Page title="消息">
      <div ref={pageRef} className={style.page}>
        {showList ? (
          <aside className={style.rail}>
            <div className={style.switcher}>
              <Segmented
                block
                value={pane}
                onChange={setPane}
                options={[
                  { label: `通知${notices.length ? ` ${notices.length}` : ''}`, value: 'notice' },
                  { label: '同事', value: 'people' }
                ]}
              />
            </div>
            <div className={style.list}>
              {pane === 'notice' ? (
                notices.length ? (
                  notices.map(item => (
                    <button key={item.id} type="button" className={`${style.row}${thread?.kind === 'ticket' && thread.key === item.id ? ` ${style.active}` : ''}`} onClick={() => openNotice(item)}>
                      <span className={`${style.avatar} ${style['avatar-notice']}`}>
                        <BellOutlined />
                      </span>
                      <span className={style.meta}>
                        <span className={style.name}>{item.title}</span>
                        <span className={style.preview}>{item.content}</span>
                      </span>
                    </button>
                  ))
                ) : (
                  <div className={style.blank}>暂无通知</div>
                )
              ) : people.length ? (
                people.map(item => {
                  const name = item.name || item.email || '同事';
                  const active = thread?.kind === 'chat' && thread.key === item.id;
                  return (
                    <button key={item.id} type="button" className={`${style.row}${active ? ` ${style.active}` : ''}`} onClick={() => openChat(item)}>
                      <span className={style.avatar} style={{ background: colorOf(name) }}>
                        {initialOf(name)}
                      </span>
                      <span className={style.meta}>
                        <span className={style.name}>{name}</span>
                        <span className={style.preview}>{item.email || item.options?.position || '同事'}</span>
                      </span>
                    </button>
                  );
                })
              ) : (
                <div className={style.blank}>暂无同事</div>
              )}
            </div>
          </aside>
        ) : null}
        {showThread ? (
          <section className={style.thread}>
            {thread?.kind === 'ticket' ? (
              <div className={style.ticketPane}>
                {narrow ? (
                  <div className={style.header}>
                    <Button type="text" icon={<LeftOutlined />} onClick={closeThread} aria-label="返回" />
                  </div>
                ) : null}
                {thread.ticketId ? <TicketDetailPage key={thread.ticketId} embedded ticketId={thread.ticketId} mode="client" baseUrl={baseUrl} /> : <div className={style.noticeBody}>{thread.content || '这条通知没有关联工单'}</div>}
              </div>
            ) : activeId ? (
              <>
                <div className={style.header}>
                  {narrow ? <Button type="text" icon={<LeftOutlined />} onClick={closeThread} aria-label="返回" /> : null}
                  <span className={style.headerName}>{activeName}</span>
                </div>
                <div className={style.messages}>
                  {viewMessages.length ? (
                    <MessageList
                      markdown={false}
                      messages={viewMessages}
                      roles={{
                        user: { placement: 'right', name: '我' },
                        assistant: { placement: 'left', name: activeName }
                      }}
                    />
                  ) : (
                    <div className={style.blank}>还没有消息</div>
                  )}
                </div>
                <div className={style.composer}>
                  <MessageInput
                    showVoice={false}
                    borderType="default"
                    placeholder="输入消息"
                    onSend={text => {
                      const content = String(text || '').trim();
                      if (!content || !activeId) {
                        return;
                      }
                      sendSocket(socketRef.current, 'sendMessage', { conversationId: activeId, content, type: 'text' });
                    }}
                  />
                </div>
              </>
            ) : (
              <div className={style.empty}>
                <CommentOutlined className={style.emptyIcon} />
                <div className={style.emptyTitle}>选择一条消息</div>
                <div className={style.emptyDesc}>通知和同事都会在这里打开</div>
              </div>
            )}
          </section>
        ) : null}
      </div>
    </Page>
  );
});

export default ChatPage;
