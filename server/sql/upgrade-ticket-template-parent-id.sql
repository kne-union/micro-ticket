-- 工单模板表补 parent_id（幂等，仅修改已有表）
-- 表前缀：t_micro_ticket_

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 't_micro_ticket_ticket_template'
  ) THEN
    ALTER TABLE t_micro_ticket_ticket_template
      ADD COLUMN IF NOT EXISTS "parent_id" VARCHAR(255);
    COMMENT ON COLUMN t_micro_ticket_ticket_template."parent_id" IS '所属文件夹 code，空为根目录';
  END IF;
END $$;
