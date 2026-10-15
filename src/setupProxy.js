const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function (app) {
  app.use(
    createProxyMiddleware({
      target: 'http://localhost:8049',
      changeOrigin: true,
      pathFilter: '/api'
    })
  );
  // 本地独立运行时服务端即 IdP；保留 Host（localhost:3049），oidc-provider 据此生成 issuer 一致的跳转地址
  app.use(
    createProxyMiddleware({
      target: 'http://localhost:8049',
      // 前缀匹配会误伤前端路由 /oidc-interaction、/oidc-callback
      pathFilter: path => path === '/oidc' || path.startsWith('/oidc/'),
      xfwd: true
    })
  );
};
