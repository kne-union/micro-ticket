-- 工单 SLA 字段（幂等，仅修改已有表）

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 't_micro_ticket_ticket'
  ) THEN
    ALTER TABLE t_micro_ticket_ticket ADD COLUMN IF NOT EXISTS "response_due_at" TIMESTAMP WITH TIME ZONE;
    COMMENT ON COLUMN t_micro_ticket_ticket."response_due_at" IS '响应时限';

    ALTER TABLE t_micro_ticket_ticket ADD COLUMN IF NOT EXISTS "resolve_due_at" TIMESTAMP WITH TIME ZONE;
    COMMENT ON COLUMN t_micro_ticket_ticket."resolve_due_at" IS '解决时限';

    ALTER TABLE t_micro_ticket_ticket ADD COLUMN IF NOT EXISTS "response_met_at" TIMESTAMP WITH TIME ZONE;
    COMMENT ON COLUMN t_micro_ticket_ticket."response_met_at" IS '首次受理时间';

    ALTER TABLE t_micro_ticket_ticket ADD COLUMN IF NOT EXISTS "resolve_met_at" TIMESTAMP WITH TIME ZONE;
    COMMENT ON COLUMN t_micro_ticket_ticket."resolve_met_at" IS '完成时间';

    ALTER TABLE t_micro_ticket_ticket ADD COLUMN IF NOT EXISTS "sla_paused_at" TIMESTAMP WITH TIME ZONE;
    COMMENT ON COLUMN t_micro_ticket_ticket."sla_paused_at" IS 'SLA 暂停开始';

    ALTER TABLE t_micro_ticket_ticket ADD COLUMN IF NOT EXISTS "escalation_level" INTEGER NOT NULL DEFAULT 0;
    COMMENT ON COLUMN t_micro_ticket_ticket."escalation_level" IS '已升级级数';
  END IF;
END $$;
