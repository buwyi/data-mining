-- =============================================================================
-- PostgreSQL：为业务用户授予某 schema 下表的读权限
-- 适用场景：算法/报表执行时报
--   psycopg2.errors.InsufficientPrivilege: permission denied for table xxx
-- 原因：表由其他角色（如 postgres）创建，未对当前登录用户（常与 DataSchema 名一致）授权。
--
-- 使用方式：以超级用户（如 postgres）连接目标库 tipdm_DB 后执行；
--          将下面的 YOUR_SCHEMA、YOUR_ROLE 改为实际 schema 名与数据库登录名（示例均为 admin）。
-- =============================================================================

-- 示例：schema 与登录用户均为 admin，表名为 air_data 所在 schema
GRANT USAGE ON SCHEMA admin TO admin;

-- 已有表的 SELECT
GRANT SELECT ON ALL TABLES IN SCHEMA admin TO admin;

-- 之后在该 schema 新建表时，默认也授予 YOUR_ROLE 可读（可选）
ALTER DEFAULT PRIVILEGES IN SCHEMA admin GRANT SELECT ON TABLES TO admin;

-- 若仍需写入临时结果表等，可按需增加（按需取消注释）
-- GRANT INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA admin TO admin;
-- ALTER DEFAULT PRIVILEGES IN SCHEMA admin GRANT INSERT, UPDATE, DELETE ON TABLES TO admin;
