-- @kne/fastify-task 3.x、@kne/fastify-message 2.x 存量表补列（幂等，仅修改已有表）
-- 表前缀：t_micro_ticket_
-- task 3.x 模型声明了 parent_task_id / priority 索引，老表缺列时 sync 建索引失败会阻断启动，须在 sync 前补列
-- message 2.x 启动时 upgradeSchema 也会补列并创建唯一索引 / status 索引，这里只补列兜底，索引交给插件

DO $$
BEGIN
  -- @kne/fastify-task 3.x
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 't_micro_ticket_task') THEN
    ALTER TABLE t_micro_ticket_task ADD COLUMN IF NOT EXISTS "priority" INTEGER DEFAULT 0;
    ALTER TABLE t_micro_ticket_task ADD COLUMN IF NOT EXISTS "parent_task_id" BIGINT;
    ALTER TABLE t_micro_ticket_task ADD COLUMN IF NOT EXISTS "retry_count" INTEGER DEFAULT 0;
    ALTER TABLE t_micro_ticket_task ADD COLUMN IF NOT EXISTS "max_retries" INTEGER DEFAULT 0;
    ALTER TABLE t_micro_ticket_task ADD COLUMN IF NOT EXISTS "timeout" INTEGER DEFAULT 3600000;
    ALTER TABLE t_micro_ticket_task ADD COLUMN IF NOT EXISTS "completed_user_id" BIGINT;
    COMMENT ON COLUMN t_micro_ticket_task."priority" IS '任务优先级，数值越大越优先';
    COMMENT ON COLUMN t_micro_ticket_task."parent_task_id" IS '父任务ID，用于任务依赖/链式执行';
    COMMENT ON COLUMN t_micro_ticket_task."retry_count" IS '已重试次数';
    COMMENT ON COLUMN t_micro_ticket_task."max_retries" IS '最大重试次数，0表示不自动重试';
    COMMENT ON COLUMN t_micro_ticket_task."timeout" IS '任务超时时间（毫秒），0表示不超时，默认3600000ms';
    COMMENT ON COLUMN t_micro_ticket_task."completed_user_id" IS '完成任务的用户ID';
  END IF;

  -- @kne/fastify-message 2.x 消息模版
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 't_micro_ticket_template') THEN
    ALTER TABLE t_micro_ticket_template ADD COLUMN IF NOT EXISTS "subject" TEXT;
    ALTER TABLE t_micro_ticket_template ADD COLUMN IF NOT EXISTS "description" TEXT;
    ALTER TABLE t_micro_ticket_template ADD COLUMN IF NOT EXISTS "variables" JSON;
    ALTER TABLE t_micro_ticket_template ADD COLUMN IF NOT EXISTS "extra" JSON;
    ALTER TABLE t_micro_ticket_template ADD COLUMN IF NOT EXISTS "tenant_id" VARCHAR(255) NOT NULL DEFAULT '';
    ALTER TABLE t_micro_ticket_template ADD COLUMN IF NOT EXISTS "tenant_open" BOOLEAN DEFAULT TRUE;
    COMMENT ON COLUMN t_micro_ticket_template."subject" IS '邮件主题模版（Liquid）';
    COMMENT ON COLUMN t_micro_ticket_template."description" IS '模版描述';
    COMMENT ON COLUMN t_micro_ticket_template."variables" IS '模版变量 [{ name, label, example }]';
    COMMENT ON COLUMN t_micro_ticket_template."extra" IS '其它分段（Liquid），如短信服务商模版编码';
    COMMENT ON COLUMN t_micro_ticket_template."tenant_id" IS '所属租户，空字符串为全局模版';
    COMMENT ON COLUMN t_micro_ticket_template."tenant_open" IS '系统模版是否开放给租户端定制，仍受 mailSettingTemplateCodes 限制';
  END IF;

  -- @kne/fastify-message 2.x 发送记录
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 't_micro_ticket_record') THEN
    ALTER TABLE t_micro_ticket_record ADD COLUMN IF NOT EXISTS "options" JSON;
    ALTER TABLE t_micro_ticket_record ADD COLUMN IF NOT EXISTS "status" INTEGER DEFAULT 0;
    ALTER TABLE t_micro_ticket_record ADD COLUMN IF NOT EXISTS "error" TEXT;
    ALTER TABLE t_micro_ticket_record ADD COLUMN IF NOT EXISTS "retry_count" INTEGER DEFAULT 0;
    ALTER TABLE t_micro_ticket_record ADD COLUMN IF NOT EXISTS "tenant_id" VARCHAR(255);
    COMMENT ON COLUMN t_micro_ticket_record."options" IS '发送参数（附件只保留描述信息），重发时使用';
    COMMENT ON COLUMN t_micro_ticket_record."status" IS '发送状态: 0:成功,1:失败,2:待发送';
    COMMENT ON COLUMN t_micro_ticket_record."error" IS '失败原因';
    COMMENT ON COLUMN t_micro_ticket_record."retry_count" IS '重试次数';
    COMMENT ON COLUMN t_micro_ticket_record."tenant_id" IS '所属租户，重发时据此取租户模版与 SMTP 配置';
  END IF;
END $$;
