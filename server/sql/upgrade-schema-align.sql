-- 模型与现库列对齐（幂等）：历史漂移列一次补齐
-- 表前缀：t_micro_ticket_
-- 说明：已存在的列会被 ADD COLUMN IF NOT EXISTS 跳过

DO $$
BEGIN
  -- @kne/fastify-file-manager
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 't_micro_ticket_file_record') THEN
    ALTER TABLE t_micro_ticket_file_record ADD COLUMN IF NOT EXISTS "options" JSONB DEFAULT '{}'::jsonb;
    COMMENT ON COLUMN t_micro_ticket_file_record."options" IS '扩展字段';
  END IF;

  -- @kne/fastify-task
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 't_micro_ticket_task') THEN
    ALTER TABLE t_micro_ticket_task ADD COLUMN IF NOT EXISTS "started_at" TIMESTAMP WITH TIME ZONE;
    ALTER TABLE t_micro_ticket_task ADD COLUMN IF NOT EXISTS "completed_at" TIMESTAMP WITH TIME ZONE;
    COMMENT ON COLUMN t_micro_ticket_task."started_at" IS '任务实际开始执行时间';
    COMMENT ON COLUMN t_micro_ticket_task."completed_at" IS '任务完成时间';
  END IF;

  -- @kne/fastify-im conversation seq
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 't_micro_ticket_im_conversation') THEN
    ALTER TABLE t_micro_ticket_im_conversation ADD COLUMN IF NOT EXISTS "last_seq" INTEGER NOT NULL DEFAULT 0;
    COMMENT ON COLUMN t_micro_ticket_im_conversation."last_seq" IS '会话内已分配的最大序号';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 't_micro_ticket_im_conversation_member') THEN
    ALTER TABLE t_micro_ticket_im_conversation_member ADD COLUMN IF NOT EXISTS "last_read_seq" INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE t_micro_ticket_im_conversation_member ADD COLUMN IF NOT EXISTS "last_read_message_id" BIGINT;
    COMMENT ON COLUMN t_micro_ticket_im_conversation_member."last_read_seq" IS '最后已读序号，只允许前进';
    COMMENT ON COLUMN t_micro_ticket_im_conversation_member."last_read_message_id" IS '最后已读消息ID';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 't_micro_ticket_im_message') THEN
    ALTER TABLE t_micro_ticket_im_message ADD COLUMN IF NOT EXISTS "seq" INTEGER;
    ALTER TABLE t_micro_ticket_im_message ADD COLUMN IF NOT EXISTS "client_msg_id" VARCHAR(255);
    ALTER TABLE t_micro_ticket_im_message ADD COLUMN IF NOT EXISTS "trace_id" VARCHAR(255);
    COMMENT ON COLUMN t_micro_ticket_im_message."seq" IS '会话内单调序号';
  END IF;

  -- 工单模板 / 完成模板 / 片段库文件夹
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 't_micro_ticket_ticket_template') THEN
    ALTER TABLE t_micro_ticket_ticket_template ADD COLUMN IF NOT EXISTS "parent_id" VARCHAR(255);
    COMMENT ON COLUMN t_micro_ticket_ticket_template."parent_id" IS '所属文件夹 code，空为根目录';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 't_micro_ticket_ticket_complete_template') THEN
    ALTER TABLE t_micro_ticket_ticket_complete_template ADD COLUMN IF NOT EXISTS "parent_id" VARCHAR(255);
    ALTER TABLE t_micro_ticket_ticket_complete_template ADD COLUMN IF NOT EXISTS "usage" VARCHAR(255) NOT NULL DEFAULT 'complete';
    COMMENT ON COLUMN t_micro_ticket_ticket_complete_template."parent_id" IS '完成模板文件夹 code';
    COMMENT ON COLUMN t_micro_ticket_ticket_complete_template."usage" IS 'complete 办结 / supplement 补充信息';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 't_micro_ticket_form_library_template') THEN
    ALTER TABLE t_micro_ticket_form_library_template ADD COLUMN IF NOT EXISTS "parent_id" VARCHAR(255);
    COMMENT ON COLUMN t_micro_ticket_form_library_template."parent_id" IS '表单片段文件夹 code，空为根目录';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 't_micro_ticket_ticket_complete_library') THEN
    ALTER TABLE t_micro_ticket_ticket_complete_library ADD COLUMN IF NOT EXISTS "parent_id" VARCHAR(255);
    COMMENT ON COLUMN t_micro_ticket_ticket_complete_library."parent_id" IS '完成模板设计器文件夹 code';
  END IF;

  -- 工单 SLA
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 't_micro_ticket_ticket') THEN
    ALTER TABLE t_micro_ticket_ticket ADD COLUMN IF NOT EXISTS "response_due_at" TIMESTAMP WITH TIME ZONE;
    ALTER TABLE t_micro_ticket_ticket ADD COLUMN IF NOT EXISTS "resolve_due_at" TIMESTAMP WITH TIME ZONE;
    ALTER TABLE t_micro_ticket_ticket ADD COLUMN IF NOT EXISTS "response_met_at" TIMESTAMP WITH TIME ZONE;
    ALTER TABLE t_micro_ticket_ticket ADD COLUMN IF NOT EXISTS "resolve_met_at" TIMESTAMP WITH TIME ZONE;
    ALTER TABLE t_micro_ticket_ticket ADD COLUMN IF NOT EXISTS "sla_paused_at" TIMESTAMP WITH TIME ZONE;
    ALTER TABLE t_micro_ticket_ticket ADD COLUMN IF NOT EXISTS "escalation_level" INTEGER NOT NULL DEFAULT 0;
  END IF;

  -- 公共问卷
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 't_micro_ticket_ticket_base_template') THEN
    ALTER TABLE t_micro_ticket_ticket_base_template ADD COLUMN IF NOT EXISTS "code" VARCHAR(255);
    ALTER TABLE t_micro_ticket_ticket_base_template ADD COLUMN IF NOT EXISTS "builtin" BOOLEAN NOT NULL DEFAULT false;
  END IF;

  -- 租户 setting secrets（较新字段）
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 't_micro_ticket_tenant_setting') THEN
    ALTER TABLE t_micro_ticket_tenant_setting ADD COLUMN IF NOT EXISTS "secrets" JSON DEFAULT '[]'::json;
  END IF;
END $$;

-- IM 会话 last_seq 回填为消息最大 seq
UPDATE t_micro_ticket_im_conversation c
SET last_seq = COALESCE((
  SELECT MAX(m.seq) FROM t_micro_ticket_im_message m
  WHERE m.conversation_id = c.id AND m.deleted_at IS NULL AND m.seq IS NOT NULL
), 0)
WHERE EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 't_micro_ticket_im_conversation' AND column_name = 'last_seq'
);

-- task started_at 回填
UPDATE t_micro_ticket_task
SET "started_at" = created_at
WHERE "started_at" IS NULL
  AND status IN ('running', 'waiting', 'success', 'failed', 'canceled')
  AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 't_micro_ticket_task' AND column_name = 'started_at'
  );
