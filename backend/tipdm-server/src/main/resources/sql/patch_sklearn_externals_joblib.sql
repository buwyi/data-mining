-- =============================================================================
-- scikit-learn 0.24+ 已移除 sklearn.externals.joblib；请使用独立包 joblib（pip install joblib）。
-- 组件脚本若在 execute() 内仍写 from sklearn.externals import joblib 会报错。
-- =============================================================================

UPDATE dm_component_script
SET value = REPLACE(
  REPLACE(
    value,
    E'\tfrom sklearn.externals import joblib',
    E'\timport joblib'
  ),
  'from sklearn.externals import joblib',
  'import joblib'
)
WHERE value LIKE '%sklearn.externals%'
  AND value LIKE '%import joblib%';
