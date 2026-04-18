-- =============================================================================
-- 去掉 dm_component_script 中仅指定 SimHei 的 matplotlib 配置（macOS 通常无该字体，会大量 findfont 告警）
-- 新版本运行时已通过 script/python/mpl_fonts.py 注入跨平台字体列表。
-- 可与 patch_component_pandas2_value_counts.sql 一起执行。
-- =============================================================================

UPDATE dm_component_script
SET value = REPLACE(
  REPLACE(
    REPLACE(
      REPLACE(
        value,
        'plt.rcParams[''font.sans-serif'']=[''SimHei'']',
        ''
      ),
      'plt.rcParams[''font.sans-serif''] = [''SimHei'']',
      ''
    ),
    'plt.rcParams["font.sans-serif"]=["SimHei"]',
    ''
  ),
  'plt.rcParams["font.sans-serif"] = ["SimHei"]',
  ''
)
WHERE value LIKE '%SimHei%'
  AND value LIKE '%font.sans-serif%';
