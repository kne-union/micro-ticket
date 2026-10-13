import { useEffect, useState } from 'react';
import { Button, Empty, Flex, Spin } from 'antd';
import { PlusOutlined, RightOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { createWithRemoteLoader } from '@kne/remote-loader';
import { Page } from '@kne/system-layout';
import { PRIORITY_OPTIONS, STATUS_OPTIONS, labelOf, unwrap } from '@components/Ticket/labels';
import style from './style.module.scss';

const priorityText = value => {
  const label = labelOf(PRIORITY_OPTIONS, value);
  if (!value || label === '-') return '';
  if (value === 'urgent') return '紧急';
  return `${label}优先级`;
};

const STATS = [
  { key: 'assignedOpen', label: '待我处理', hint: '指派给我、尚未完成', scope: 'assigned' },
  { key: 'waitingConfirm', label: '待我确认', hint: '处理完毕等我确认', scope: 'created' },
  { key: 'createdOpen', label: '我发起进行中', hint: '我提交、还没关闭', scope: 'created' },
  { key: 'done', label: '已完成', hint: '我参与且已完成', scope: 'assigned' }
];

const greeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return '上午好';
  if (hour < 18) return '下午好';
  return '晚上好';
};

const RecentList = ({ title, scope, ajax, baseUrl, navigate }) => {
  const [rows, setRows] = useState(null);

  useEffect(() => {
    ajax({ url: '/api/v1/ticket/list', method: 'GET', params: { scope, perPage: 5, currentPage: 1 } })
      .then(res => setRows(unwrap(res)?.pageData || []))
      .catch(() => setRows([]));
  }, [ajax, scope]);

  return (
    <div className={style['panel']}>
      <Flex justify="space-between" align="center" className={style['panel-header']}>
        <span className={style['panel-title']}>{title}</span>
        <Button type="link" size="small" onClick={() => navigate(`${baseUrl}/ticket?scope=${scope}`)}>
          全部 <RightOutlined />
        </Button>
      </Flex>
      {rows === null ? (
        <Flex justify="center" className={style['panel-empty']}>
          <Spin />
        </Flex>
      ) : rows.length ? (
        rows.map(item => (
          <div key={item.id} className={style['ticket-item']} onClick={() => navigate(`${baseUrl}/ticket/${item.id}`)}>
            <div className={style['ticket-main']}>
              <div className={style['ticket-title']}>{item.title}</div>
              <div className={style['ticket-meta']}>
                {[item.no, priorityText(item.priority)].filter(Boolean).join(' · ')}
              </div>
            </div>
            <span className={style['ticket-status']} data-status={item.status}>
              <span className={style['ticket-status-dot']} />
              {labelOf(STATUS_OPTIONS, item.status)}
            </span>
          </div>
        ))
      ) : (
        <Empty className={style['panel-empty']} image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无工单" />
      )}
    </div>
  );
};

const Home = createWithRemoteLoader({
  modules: ['components-core:Global@usePreset', 'components-core:Global@useGlobalContext']
})(({ remoteModules, baseUrl = '' }) => {
  const [usePreset, useGlobalContext] = remoteModules;
  const { ajax } = usePreset();
  const { global } = useGlobalContext('userInfo');
  const navigate = useNavigate();
  const [stats, setStats] = useState({});
  const name = global?.tenantUserInfo?.name || global?.userInfo?.nickname || '';
  const tenantName = global?.tenant?.name || '';

  useEffect(() => {
    ajax({ url: '/api/v1/ticket/summary', method: 'GET' })
      .then(res => setStats(unwrap(res) || {}))
      .catch(() => setStats({}));
  }, [ajax]);

  return (
    <Page title="首页">
      <div className={style['home']}>
        <Flex className={style['hero']} justify="space-between" align="center" wrap gap={16}>
          <div>
            <div className={style['hero-title']}>
              {greeting()}
              {name ? `，${name}` : ''}
            </div>
            <div className={style['hero-desc']}>{tenantName ? `${tenantName} · 工单中心` : '工单中心'}</div>
          </div>
          <Flex gap={8}>
            <Button onClick={() => navigate(`${baseUrl}/ticket?scope=assigned`)}>查看工单</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate(`${baseUrl}/ticket/create`)}>
              新建工单
            </Button>
          </Flex>
        </Flex>

        <div className={style['stats']}>
          {STATS.map(item => (
            <div key={item.key} className={style['stat']} onClick={() => navigate(`${baseUrl}/ticket?scope=${item.scope}`)}>
              <div className={style['stat-label']}>{item.label}</div>
              <div className={style['stat-value']}>{stats[item.key] ?? '-'}</div>
              <div className={style['stat-hint']}>{item.hint}</div>
            </div>
          ))}
        </div>

        <div className={style['lists']}>
          <RecentList title="指派给我的" scope="assigned" ajax={ajax} baseUrl={baseUrl} navigate={navigate} />
          <RecentList title="我发起的" scope="created" ajax={ajax} baseUrl={baseUrl} navigate={navigate} />
        </div>
      </div>
    </Page>
  );
});

export default Home;
