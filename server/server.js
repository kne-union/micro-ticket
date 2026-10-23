
const fastify = require('fastify')({
  logger: true,
  querystringParser: str => require('qs').parse(str)
});

const fastifyEnv = require('@fastify/env');
const packageJson = require('./package.json');
const path = require('path');

const version = `v${packageJson.version.split('.')[0]}`;

const options = {
  name: 'project',
  prefix: `/api/${version}`,
  taskCron: '*/1 * * * *',
  getUserModel: () => {
    return fastify.account.models.user;
  },
  getTenantModels: () => {
    return {
      tenant: fastify.tenant.models.tenant,
      tenantUser: fastify.tenant.models.tenantUser,
      tenantOrg: fastify.tenant.models.tenantOrg
    };
  }
};



const createServer = () => {
  const userEnvSchema = require('./env.schema.json');
  fastify.register(fastifyEnv, {
    dotenv: true,
    schema: {
      type: 'object',
      properties: Object.assign({}, userEnvSchema.properties, {
        PORT: { type: 'number', default: 8049 },
        DB_DIALECT: { type: 'string', default: 'sqlite' },
        DB_HOST: { type: 'string', default: 'data.db' },
        DB_PORT: { type: 'number' },
        DB_USERNAME: { type: 'string' },
        DB_PASSWORD: { type: 'string' },
        DB_DATABASE: { type: 'string' }
      }),
      required: userEnvSchema.required || []
    }
  });

  // 须在其它插件之前注册，否则收集不到先定义的路由；文档由 @kne/fastify-app-runtime 的 /open-api.json 输出
  const appPackageJson = require('../package.json');
  fastify.register(require('@fastify/swagger'), {
    openapi: {
      info: { title: appPackageJson.name, version: appPackageJson.version }
    }
  });

  fastify.register(require('fastify-cron'));

  fastify.register(
    require('fastify-plugin')(async fastify => {
      fastify.register(require('@kne/fastify-sequelize'), {
        db: {
          dialect: fastify.config.DB_DIALECT,
          host: fastify.config.DB_HOST,
          port: fastify.config.DB_PORT,
          database: fastify.config.DB_DATABASE,
          username: fastify.config.DB_USERNAME,
          password: fastify.config.DB_PASSWORD
        },
        modelsGlobOptions: {
          syncOptions: {}
        },
        getUserModel: options.getUserModel,
        getTenantModels: options.getTenantModels
      });

      const claimLegacyUser = require('./libs/oidc-claim')(fastify);
      fastify.register(require('@kne/fastify-account'), {
        isTest: fastify.config.IS_TEST,
        prefix: `${options.prefix}`,
        getUserAuthenticate: () => async request => {
          await fastify.oidc.authenticate.user(request);
          await claimLegacyUser(request);
        },
        sendMessage: async ({ name, type, messageType, props }) => {
          if (messageType === 1 && type === 0) {
            await fastify.message.services.sendMessage({
              name,
              type: 0,
              code: 'REGISTERCODE',
              props,
              options: {
                title: '注册验证码'
              }
            });
          }
          if (messageType === 1 && type === 5) {
            await fastify.message.services.sendMessage({
              name,
              type: 0,
              code: 'RESETPASSWORDCODE',
              props: Object.assign({}, props, {
                url: `${fastify.config.ORIGIN}/account/reset-password/${props.token}${props.options?.referer ? `?referer=${props.options?.referer}` : ''}`
              }),
              options: {
                title: '重置密码'
              }
            });
          }
        }
      });

      fastify.register(require('@kne/fastify-message'), {
        isTest: fastify.config.IS_TEST,
        prefix: `${options.prefix}/message`,
        emailConfig: {
          host: fastify.config.ALISMTP_ENDPOINT,
          port: 465,
          secure: true,
          user: fastify.config.ALISMTP_USER,
          pass: fastify.config.ALISMTP_PASSWORD
        },
        templateDir: path.join(__dirname, './messageTemplate'),
        senders: {}
      });

      fastify.register(require('@kne/fastify-task'), {
        prefix: `${options.prefix}/task`,
        cronTime: options.taskCron,
        task: {
        }
      });

      fastify.register(require('@kne/fastify-tenant'), {
        prefix: `${options.prefix}/tenant`,
        getUserModel: options.getUserModel,
        permissionsProfile: path.resolve(__dirname, './libs/permissions.js'),
        onPermissionChange: payload => fastify.oidc.onPermissionChange(payload)
      });

      // @fastify/env 7 不再把 .env 写入 process.env，fastify-oidc 的环境变量默认值读不到，需显式传入
      fastify.register(require('@kne/fastify-oidc'), {
        selfClient: { clientName: 'micro-ticket' },
        origin: fastify.config.ORIGIN,
        keyEncryptionSecret: fastify.config.OIDC_KEY_SECRET,
        // 部署到应用中心时宿主注入 OIDC_APP_CODE 等，工单带本地租户数据，以 independent 模式托管宿主租户
        tenant: () => fastify.tenant,
        app: { tenantMode: 'independent' }
      });
    })
  );

  fastify.register(
    require('fastify-plugin')(async fastify => {
      const { OSS_REGION, OSS_BUCKET, OSS_ACCESS_KEY_ID, OSS_ACCESS_KEY_SECRET } = fastify.config;
      const ossEnabled = !!(OSS_REGION && OSS_BUCKET && OSS_ACCESS_KEY_ID && OSS_ACCESS_KEY_SECRET);

      fastify.register(require('@kne/fastify-file-manager'), {
        prefix: `${options.prefix}/static`,
        root: path.resolve('./static'),
        ossAdapter: () => (ossEnabled ? fastify.aliyun.services.oss : {})
      });

      if (ossEnabled) {
        fastify.register(require('@kne/fastify-aliyun'), {
          prefix: `${options.prefix}/aliyun`,
          oss: {
            baseDir: 'micro-ticket',
            region: OSS_REGION,
            accessKeyId: OSS_ACCESS_KEY_ID,
            accessKeySecret: OSS_ACCESS_KEY_SECRET,
            bucket: OSS_BUCKET
          }
        });
      }
    })
  );

  fastify.register(
    require('fastify-plugin')(async fastify => {
      await fastify.register(require('@kne/fastify-app-runtime'), {
        root: path.join(__dirname, './build'),
        packageJson: require('../package.json'),
        setting: {
          prefix: `${options.prefix}/setting`
        }
      });

      await fastify.register(require('@kne/fastify-group'), {
        prefix: `${options.prefix}/group`,
        tenant: fastify.tenant,
        getAuthenticate: () => [fastify.tenant.authenticate.user, fastify.tenant.authenticate.tenantUser]
      });

      fastify.register(require('@kne/fastify-namespace'), {
        options,
        name: options.name,
        modules: [
          ['controllers', path.resolve(__dirname, './libs/controllers')],
          [
            'models',
            await fastify.sequelize.addModels(path.resolve(__dirname, './libs/models'), {
              getUserModel: options.getUserModel
            })
          ],
          ['services', path.resolve(__dirname, './libs/services')]
        ]
      });
      await fastify.register(require('@fastify/websocket'));
      const bindImUser = async request => {
        if (request.userInfo?.id && !request.userInfo.userId) {
          request.userInfo.userId = String(request.userInfo.id);
        }
      };
      await fastify.register(require('@kne/fastify-im'), {
        prefix: `${options.prefix}/im`,
        getAuthenticate: () => [fastify.tenant.authenticate.user, fastify.tenant.authenticate.tenantUser, bindImUser],
        verifyToken: async token => {
          const resolveUserPayload = async () => {
            try {
              const payload = await fastify.oidc.verifier.verifyAccessToken(token);
              return (await fastify.oidc.revocation.isRevoked(payload)) ? null : { id: payload.sub };
            } catch (e) {
              const info = await fastify.jwt.verify(token);
              return info.payload;
            }
          };
          const userPayload = await resolveUserPayload();
          if (!userPayload) {
            return null;
          }
          const user = await fastify.account.services.user.getUser(userPayload);
          if (!user || !(user.status === 0 || user.status === 1)) {
            return null;
          }
          return {
            userId: String(user.id),
            role: 'member',
            nickname: user.nickname || user.email || user.id,
            avatar: user.avatar || ''
          };
        }
      });
      await fastify.sequelize.sync();
      if (fastify.project?.services?.ticketBase?.ensureDefaults) {
        await fastify.project.services.ticketBase.ensureDefaults();
      }
      if (fastify.project?.services?.ticket?.ensureColumns) {
        await fastify.project.services.ticket.ensureColumns();
      }
    })
  );

  fastify.register(require('@kne/fastify-response-data-format'));
};

module.exports = {
  fastify,
  createServer,
  start: () => {
    createServer();
    return fastify.then(() => {
      fastify.listen({ port: fastify.config.PORT, host: '0.0.0.0' }, (err, address) => {
        if (err) throw err;
        console.log(`Server is now listening on ${address}`);
      });
    });
  }
};
