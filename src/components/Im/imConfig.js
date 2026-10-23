// 会话接口签发租户成员的用户级令牌，一条连接接收当前租户下的全部会话
export const imConnectionProps = () => ({
  sessionUrl: '/api/v1/ticket/im/session',
  callUrl: '/api/v1/im/call',
  apiBase: window.runtimeApiUrl || '',
  devApiHost: 'localhost:8049'
});
