-- =============================================================================
-- pandas 2.0+ 已移除 DataFrame/Series.as_matrix()，请使用 to_numpy() 或 values。
-- 可与其它 patch_*.sql 一并执行；亦可用：python3 scripts/patch_pandas2_component_scripts.py
-- =============================================================================

UPDATE dm_component_script
SET value = regexp_replace(value, '\.as_matrix\s*\(\s*\)', '.to_numpy()', 'g')
WHERE value LIKE '%as_matrix%';
