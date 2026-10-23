import { BellOutlined, CommentOutlined, LeftOutlined } from '@ant-design/icons';
import { createWithRemoteLoader } from '@kne/remote-loader';
import { MOBILE_BREAKPOINT, useIsMobile } from '@kne/responsive-utils';
import { Page } from '@kne/system-layout';
import { Button, Segmented, message as toast } from 'antd';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import TicketDetailPage from '../Ticket/TicketDetailPage';
import { imConnectionProps } from './imConfig';
import { refreshImUnread } from './socket';
import style from './style.module.scss';

const rowsOf = body => {
  const data = body?.data?.data ?? body?.data;
  if (Array.isArray(data)) {
    return data;
  }
  return data?.list || data?.pageData || [];
};

const ChatPage = createWithRemoteLoader({
  modules: ['components-core:Global@usePreset', 'components-trtc-conference:Im', 'components-trtc-conference:Im@useIm']
})(({ remoteModules, baseUrl = '' }) => {
  const [usePreset, Im, useIm] = remoteModules;
  const { ajax } = usePreset();
  const live = useIm();
  const layoutMobile = useIsMobile();
  const pageRef = useRef(null);
  const [pageNarrow, setPageNarrow] = useState(false);
  const [notices, setNotices] = useState([]);
  const [pane, setPane] = useState('notice');
  const [thread, setThread] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [callEnabled, setCallEnabled] = useState(false);
  const [members, setMembers] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);

  const loadNotices = async () => {
    const { data } = await ajax({ url: '/api/v1/im/system-messages', params: { page: 1, pageSize: 20 } });
    setNotices(data?.data?.list || []);
  };

  const loadConversations = useCallback(async () => {
    const { data } = await ajax({ url: '/api/v1/ticket/chat/conversations' });
    setConversations(data?.data?.list || []);
    setCallEnabled(!!data?.data?.callEnabled);
  }, [ajax]);

  const markNoticeRead = item => {
    if (item.isRead) {
      return;
    }
    setNotices(current => current.map(notice => (notice.id === item.id ? { ...notice, isRead: true } : notice)));
    ajax({ url: `/api/v1/im/system-messages/${item.id}/read`, method: 'POST', data: {} })
      .catch(() => null)
      .finally(() => refreshImUnread());
  };

  const readAllNotices = () => {
    setNotices(current => current.map(notice => ({ ...notice, isRead: true })));
    ajax({ url: '/api/v1/im/system-messages/read-all', method: 'POST', data: {} })
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
    ajax({ url: '/api/v1/ticket/members' }).then(({ data }) => {
      if (!closed) {
        setMembers(rowsOf({ data }));
      }
    });
    loadNotices();
    return () => {
      closed = true;
    };
  }, [ajax]);

  // 别人新发起的会话先到连接里，列表据此补拉
  const liveConversationKey = (live.conversations || []).map(item => item.id).join('|');
  useEffect(() => {
    loadConversations();
  }, [loadConversations, liveConversationKey]);

  const contacts = useMemo(
    () =>
      members
        .filter(item => String(item.id) !== String(live.userId || ''))
        .map(item => ({
          id: String(item.id),
          name: item.name || item.email || '同事',
          avatar: item.avatar || '',
          userId: String(item.id),
          remark: item.email || ''
        })),
    [members, live.userId]
  );

  const openContactChat = async contact => {
    const { data } = await ajax({
      url: '/api/v1/ticket/chat/open',
      method: 'POST',
      data: { tenantUserId: contact.id }
    });
    const conversation = data?.data?.conversation;
    if (data?.code !== 0 || !conversation?.id) {
      toast.error(data?.msg || '无法发起聊天');
      return null;
    }
    const entry = { id: String(conversation.id), name: contact.name, avatar: contact.avatar, userId: contact.id, contactId: contact.id };
    setConversations(current => (current.some(item => item.id === entry.id) ? current : [entry, ...current]));
    setActiveConversationId(entry.id);
    return entry;
  };

  const openNotice = item => {
    markNoticeRead(item);
    setThread({
      key: item.id,
      ticketId: item.props?.ticketId || null,
      content: item.content || ''
    });
  };

  const narrow = layoutMobile || pageNarrow;
  const noticeKey = notices.map(item => item.id).join('|');

  useEffect(() => {
    if (narrow || pane !== 'notice' || !notices.length) {
      return;
    }
    if (thread && notices.some(item => item.id === thread.key)) {
      return;
    }
    openNotice(notices[0]);
  }, [narrow, pane, noticeKey]);

  const unreadNotices = notices.filter(item => !item.isRead).length;
  const unreadChats = Object.values(live.conversationUnread || {}).reduce((sum, count) => sum + Number(count || 0), 0);
  const showList = !narrow || !thread;
  const showThread = !narrow || !!thread;

  return (
    <Page title="消息">
      <div ref={pageRef} className={style.shell}>
        <div className={style.tabs}>
          <Segmented
            value={pane}
            onChange={setPane}
            options={[
              { label: `通知${unreadNotices ? ` ${unreadNotices}` : ''}`, value: 'notice' },
              { label: `聊天${unreadChats ? ` ${unreadChats}` : ''}`, value: 'chat' }
            ]}
          />
          {pane === 'notice' && unreadNotices ? (
            <Button type="link" size="small" onClick={readAllNotices}>
              全部已读
            </Button>
          ) : null}
        </div>
        {pane === 'chat' ? (
          <div className={style.chatPane}>
            <Im
              {...imConnectionProps()}
              className={style.im}
              conversations={conversations}
              contacts={contacts}
              activeConversationId={activeConversationId}
              onConversationSelect={item => setActiveConversationId(item.id)}
              onContactSelect={openContactChat}
              features={{ phrases: false, raiseHand: false, voiceCall: callEnabled, videoCall: callEnabled }}
            />
          </div>
        ) : (
          <div className={style.page}>
            {showList ? (
              <aside className={style.rail}>
                <div className={style.list}>
                  {notices.length ? (
                    notices.map(item => (
                      <button
                        key={item.id}
                        type="button"
                        className={`${style.row}${item.isRead ? ` ${style.read}` : ''}${thread?.key === item.id ? ` ${style.active}` : ''}`}
                        onClick={() => openNotice(item)}
                      >
                        <span className={`${style.avatar} ${style['avatar-notice']}`}>
                          <BellOutlined />
                        </span>
                        <span className={style.meta}>
                          <span className={style.name}>{item.title}</span>
                          <span className={style.preview}>{item.content}</span>
                        </span>
                        {item.isRead ? null : <span className={style.unreadDot} aria-label="未读" />}
                      </button>
                    ))
                  ) : (
                    <div className={style.blank}>暂无通知</div>
                  )}
                </div>
              </aside>
            ) : null}
            {showThread ? (
              <section className={style.thread}>
                {thread ? (
                  <div className={style.ticketPane}>
                    {narrow ? (
                      <div className={style.header}>
                        <Button type="text" icon={<LeftOutlined />} onClick={() => setThread(null)} aria-label="返回" />
                      </div>
                    ) : null}
                    {thread.ticketId ? <TicketDetailPage key={thread.ticketId} embedded ticketId={thread.ticketId} mode="client" baseUrl={baseUrl} /> : <div className={style.noticeBody}>{thread.content || '这条通知没有关联工单'}</div>}
                  </div>
                ) : (
                  <div className={style.empty}>
                    <CommentOutlined className={style.emptyIcon} />
                    <div className={style.emptyTitle}>选择一条通知</div>
                    <div className={style.emptyDesc}>工单通知会在这里打开</div>
                  </div>
                )}
              </section>
            ) : null}
          </div>
        )}
      </div>
    </Page>
  );
});

export default ChatPage;
