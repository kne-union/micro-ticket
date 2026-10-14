-- @kne/fastify-file-manager file_record 补 options（幂等，仅修改已有表）
-- 表前缀：t_micro_ticket_

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 't_micro_ticket_file_record'
  ) THEN
    ALTER TABLE t_micro_ticket_file_record
      ADD COLUMN IF NOT EXISTS "options" JSONB DEFAULT '{}'::jsonb;
    COMMENT ON COLUMN t_micro_ticket_file_record."options" IS '扩展字段';
  END IF;
END $$;
