-- @kne/fastify-task 任务表补 started_at / completed_at（幂等，仅修改已有表）
-- 表前缀：t_micro_ticket_

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 't_micro_ticket_task'
  ) THEN
    ALTER TABLE t_micro_ticket_task
      ADD COLUMN IF NOT EXISTS "started_at" TIMESTAMP WITH TIME ZONE;
    COMMENT ON COLUMN t_micro_ticket_task."started_at" IS '任务实际开始执行时间';

    ALTER TABLE t_micro_ticket_task
      ADD COLUMN IF NOT EXISTS "completed_at" TIMESTAMP WITH TIME ZONE;
    COMMENT ON COLUMN t_micro_ticket_task."completed_at" IS '任务完成时间';
  END IF;
END $$;

UPDATE t_micro_ticket_task
SET "started_at" = created_at
WHERE EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 't_micro_ticket_task'
)
AND "started_at" IS NULL
AND status IN ('running', 'waiting', 'success', 'failed', 'canceled');
