-- =============================================================================
-- PostgreSQL：将当前库内对业务用户 admin 可用的权限尽量全部授予（开发/内网环境）
-- 需以超级用户（如 postgres）连接**目标数据库**后执行。
--
-- 注意：
-- 1) 无法替代「表不存在」类错误：若报 relation "admin.xxx" does not exist，
--    说明该表未创建或已被删，与 GRANT 无关，需检查工作流上游节点与临时表生命周期。
-- 2) 生产环境请按需收敛权限，避免 ALL + 全 schema 的粗放授权。
-- 3) 将库名、用户名按实际修改（默认库 tipdm_DB、用户 admin）。
-- =============================================================================

-- 使用：\c tipdm_DB   或  psql -U postgres -d tipdm_DB -f postgres_grant_admin_all.sql

-- 库级（对「当前连接的数据库」授权，需先 \c 到 tipdm_DB 再执行本文件）
DO $$
BEGIN
  EXECUTE format('GRANT ALL PRIVILEGES ON DATABASE %I TO admin', current_database());
END $$;

-- 对所有非系统 schema 授予 USAGE/CREATE（按需），并对其中对象授予 ALL
DO $$
DECLARE
  s TEXT;
BEGIN
  FOR s IN
    SELECT nspname
    FROM pg_namespace
    WHERE nspname NOT IN ('pg_catalog', 'information_schema')
      AND nspname NOT LIKE 'pg\_%' ESCAPE '\'
      AND nspname NOT LIKE 'pg_toast%'
  LOOP
    EXECUTE format('GRANT USAGE, CREATE ON SCHEMA %I TO admin', s);
    EXECUTE format('GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA %I TO admin', s);
    EXECUTE format('GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA %I TO admin', s);
    EXECUTE format('GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA %I TO admin', s);
    -- 之后新建对象默认也授予 admin（若对象属主执行 DDL 时生效）
    EXECUTE format(
      'ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT ALL PRIVILEGES ON TABLES TO admin',
      s
    );
    EXECUTE format(
      'ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT ALL PRIVILEGES ON SEQUENCES TO admin',
      s
    );
  END LOOP;
END $$;

-- 若希望 admin 成为某 schema 下现有表的所有者（极强权限，慎用）
-- ALTER SCHEMA admin OWNER TO admin;
-- 单表：ALTER TABLE admin.some_table OWNER TO admin;
