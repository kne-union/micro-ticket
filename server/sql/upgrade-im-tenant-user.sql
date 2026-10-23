-- @kne/fastify-im 身份由账号改为租户成员（幂等）
-- 表前缀：t_micro_ticket_
-- 1. 删除 user_id / target_user_id / created_by 指向账号用户表的外键，之后写入租户成员 id
-- 2. 历史 IM 数据按账号身份写入、跨租户混在一起，全部软删除归档；只在本次删掉了外键时归档，重复执行不会归档新数据
-- 须在新版本服务启动前执行，否则写入租户成员 id 会被旧外键拒绝

DO $$
DECLARE
  r record;
  t text;
  dropped integer := 0;
BEGIN
  FOR r IN
    SELECT c.conname, cls.relname
    FROM pg_constraint c
    JOIN pg_class cls ON cls.oid = c.conrelid
    JOIN pg_namespace ns ON ns.oid = cls.relnamespace
    WHERE c.contype = 'f'
      AND ns.nspname = 'public'
      AND cls.relname IN ('t_micro_ticket_im_conversation', 't_micro_ticket_im_conversation_member', 't_micro_ticket_im_system_message')
      AND EXISTS (
        SELECT 1
        FROM unnest(c.conkey) AS k(attnum)
        JOIN pg_attribute a ON a.attrelid = cls.oid AND a.attnum = k.attnum
        WHERE a.attname IN ('user_id', 'target_user_id', 'created_by')
      )
  LOOP
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', r.relname, r.conname);
    dropped := dropped + 1;
  END LOOP;

  IF dropped = 0 THEN
    RETURN;
  END IF;

  FOREACH t IN ARRAY ARRAY[
    't_micro_ticket_im_message_receipt',
    't_micro_ticket_im_message',
    't_micro_ticket_im_conversation_member',
    't_micro_ticket_im_conversation',
    't_micro_ticket_im_notification',
    't_micro_ticket_im_system_message'
  ]
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
      EXECUTE format('UPDATE %I SET deleted_at = NOW() WHERE deleted_at IS NULL', t);
    END IF;
  END LOOP;
END $$;
