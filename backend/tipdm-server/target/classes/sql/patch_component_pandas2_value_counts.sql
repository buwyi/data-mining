-- =============================================================================
-- 全量修复：dm_component_script 中与 pandas 2.x 不兼容的 value_counts→DataFrame 列访问
-- 旧写法用列名 0，pandas 2 中该列为 count；并修正 loc[i][0]/[1]、Counter、饼图数据等。
--
-- 覆盖变量名：lable_res（内置脚本拼写）、label_res（若有人改正拼写仍沿用旧列访问）
--
-- 执行：psql -U postgres -d tipdm_DB -f patch_component_pandas2_value_counts.sql
-- 建议先备份：pg_dump ... -t dm_component_script
-- =============================================================================

-- lable_res（KMeans 等内置组件）
UPDATE dm_component_script
SET value = REPLACE(
  REPLACE(
    REPLACE(
      REPLACE(
        REPLACE(
          REPLACE(
            value,
            'lable_res.loc[i][0]',
            'lable_res.loc[i, ''count'']'
          ),
          'lable_res.loc[i][1]',
          'lable_res.loc[i, ''group'']'
        ),
        'lable_res[0].sum()',
        'lable_res[''count''].sum()'
      ),
      'list(Counter(lable_res[0]))',
      'lable_res[''count''].tolist()'
    ),
    'lable_res[''group''],lable_res[0]',
    'lable_res[''group''],lable_res[''count'']'
  ),
  'lable_res[0]',
  'lable_res[''count'']'
)
WHERE value LIKE '%lable_res%'
  AND (
    value LIKE '%lable_res[0]%'
    OR value LIKE '%lable_res.loc[i][0]%'
    OR value LIKE '%lable_res.loc[i][1]%'
    OR value LIKE '%Counter(lable_res[0])%'
  );

-- label_res（同一逻辑的另一变量名）
UPDATE dm_component_script
SET value = REPLACE(
  REPLACE(
    REPLACE(
      REPLACE(
        REPLACE(
          REPLACE(
            value,
            'label_res.loc[i][0]',
            'label_res.loc[i, ''count'']'
          ),
          'label_res.loc[i][1]',
          'label_res.loc[i, ''group'']'
        ),
        'label_res[0].sum()',
        'label_res[''count''].sum()'
      ),
      'list(Counter(label_res[0]))',
      'label_res[''count''].tolist()'
    ),
    'label_res[''group''],label_res[0]',
    'label_res[''group''],label_res[''count'']'
  ),
  'label_res[0]',
  'label_res[''count'']'
)
WHERE value LIKE '%label_res%'
  AND (
    value LIKE '%label_res[0]%'
    OR value LIKE '%label_res.loc[i][0]%'
    OR value LIKE '%label_res.loc[i][1]%'
    OR value LIKE '%Counter(label_res[0])%'
  );
