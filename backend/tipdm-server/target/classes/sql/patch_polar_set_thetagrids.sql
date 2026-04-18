-- =============================================================================
-- 极坐标雷达图：angles 经 np.concatenate 闭合后长度为 N+1，labels 仍为 N，
-- matplotlib 3.x 中 set_thetagrids 要求刻度位置数与标签数一致，须使用 angles[:-1]。
-- 可与 patch_component_pandas2_value_counts.sql、patch_matplotlib_simhei.sql 一起执行。
-- =============================================================================

UPDATE dm_component_script
SET value = REPLACE(
  REPLACE(
    REPLACE(
      REPLACE(
        REPLACE(
          value,
          'ax.set_thetagrids(angles * 180 / np.pi, labels, fontproperties="SimHei")',
          'ax.set_thetagrids(angles[:-1] * 180 / np.pi, labels)'
        ),
        'ax.set_thetagrids(angles * 180 / np.pi, labels, fontproperties=''SimHei'')',
        'ax.set_thetagrids(angles[:-1] * 180 / np.pi, labels)'
      ),
      E'\tax.set_thetagrids(angles * 180 / np.pi, labels, fontproperties="SimHei")',
      E'\tax.set_thetagrids(angles[:-1] * 180 / np.pi, labels)'
    ),
    'ax.set_thetagrids(angles * 180 / np.pi, labels)',
    'ax.set_thetagrids(angles[:-1] * 180 / np.pi, labels)'
  ),
  E'\tax.set_thetagrids(angles * 180 / np.pi, labels)',
  E'\tax.set_thetagrids(angles[:-1] * 180 / np.pi, labels)'
)
WHERE value LIKE '%set_thetagrids%'
  AND value LIKE '%angles * 180 / np.pi%'
  AND value NOT LIKE '%angles[:-1] * 180 / np.pi%';
