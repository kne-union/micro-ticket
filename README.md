# micro-ticket

多租户工单系统。租户内可以建单、受理、补充信息、办结，同事可以在线会话，工单变化通过即时消息通知相关人。平台管理员维护可供所有租户引用的系统问卷。

## 本地启动

需要 Node.js 20。

```bash
npm install
npm run init-server
npm start
```

- 前端：http://localhost:3049
- 接口：http://localhost:8049 ，前缀 `/api/v1`
- 默认数据库：`server/data.db`（SQLite，已忽略，不入库）

首次使用先打开 `/account` 注册，再在 `/admin/initAdmin` 初始化超级管理员。进入租户后，管理端在 `/tenant-admin`，成员端在 `/tenant`。

服务端环境变量写在 `server/.env`（不入库）。字段说明见 `server/env.schema.json`。本地不配邮件时，把 `IS_TEST` 设为 `true`，验证码会直接出现在接口返回里。常用项：

| 变量 | 作用 |
| --- | --- |
| `PORT` | 接口端口，默认 `8049` |
| `DB_DIALECT` / `DB_HOST` | 默认 `sqlite` 与 `data.db` |
| `IS_TEST` | 为 `true` 时不真正发信，并在接口中返回验证码 |
| `ORIGIN` | 站点地址，用于重置密码链接 |
| `ALISMTP_USER` / `ALISMTP_PASSWORD` / `ALISMTP_ENDPOINT` | 阿里云邮件 |

## 能做什么

- **工单**：待受理、处理中、已挂起、要求补充信息、待确认、已完成。已完成再打开必须填写重开原因。
- **模板**：平台维护系统问卷，租户只能引用，不能改原文。租户可以导入成自己的副本，也可以维护工单模板、完成模板和补充模板。
- **通知**：新工单通知指定处理人；没有指定时通知租户管理员。受理人、被指派的处理人和主动关注的人会收到后续变化。内部备注不发给提单人。
- **SLA**：按营业时间计算响应和解决时限，跳过节假日。挂起和要求补充信息时暂停解决时钟。超时后按升级链逐级通知。租户管理端可在「SLA」里配置。
- **消息**：租户内同事会话，以及工单系统通知。

列表按是否逾期、优先级、创建时间排序。

默认问卷在 `server/ticketTemplate/`。服务每次启动会按文件覆盖同编码的系统问卷。

## 检查

```bash
cd server && node --test test/ticket-rules.test.js
```

## 构建

```bash
npm run build
```

Docker 镜像基于 Node 20，对外端口 `8049`。

<!--START_SECTION:DOC_MD-->

| 组件 | 简介 |
|------|------|

<!--END_SECTION:DOC_MD-->
