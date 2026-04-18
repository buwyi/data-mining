-- =============================================================================
-- scikit-learn 1.2+ 已从 Lasso / Ridge / ElasticNet 等线性模型移除 normalize 参数。
-- 旧组件脚本中 normalize='True'==params['normalize'] 会报：
--   TypeError: __init__() got an unexpected keyword argument 'normalize'
-- 推荐用项目根目录：python3 scripts/patch_pandas2_component_scripts.py（含正则，覆盖更全）
-- 以下为 PostgreSQL regexp_replace 兜底（单引号键名；双引号键可再套一层替换）。
-- =============================================================================

UPDATE dm_component_script
SET value = regexp_replace(
  regexp_replace(
    regexp_replace(
      value,
      E',\\s*normalize\\s*=\\s*''True''\\s*==\\s*params\\[''normalize''\\]\\s*,',
      ',',
      'g'
    ),
    E',\\s*normalize\\s*=\\s*''True''\\s*==\\s*params\\[''normalize''\\]\\s*\\)',
    ')',
    'g'
  ),
  E'\\(\\s*normalize\\s*=\\s*''True''\\s*==\\s*params\\[''normalize''\\]\\s*\\)',
  '()',
  'g'
)
WHERE value ~ 'normalize';
