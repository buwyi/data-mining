package com.tipdm.framework.dmserver.utils;

/**
 * 生成 Python 脚本时在 {@code import pandas as pd} 之后注入。
 * <ul>
 *   <li>pandas 2.0+：{@code DataFrame.drop} / {@code Series.drop} 不再接受
 *       {@code drop(labels, 0|1)} 两位置参数形式。</li>
 *   <li>pandas 2.0+：已移除 {@code as_matrix()}，旧脚本可继续调用，此处补回为
 *       {@code to_numpy()} 的别名。</li>
 *   <li>pandas 2.0+：已移除 {@code Series.append} / {@code DataFrame.append}，此处用
 *       {@code pd.concat} 实现兼容。</li>
 * </ul>
 */
public final class PandasLegacyCompat {

    private PandasLegacyCompat() {
    }

    /**
     * 放在 import pandas 之前：pandas 等库会把 FutureWarning 打到 stderr，
     * 而 {@link com.tipdm.framework.dmserver.pyserve.PySftpProgressMonitor} 会把任意 stderr 当作算法失败。
     */
    public static final String BEFORE_IMPORT_PANDAS =
            "import warnings\n"
                    + "warnings.filterwarnings('ignore', category=FutureWarning)\n"
                    + "warnings.filterwarnings('ignore', category=DeprecationWarning)\n";

    public static final String AFTER_IMPORT_PANDAS =
            "_orig_df_drop = pd.DataFrame.drop\n"
                    + "def _tipdm_df_drop(self, *args, **kwargs):\n"
                    + "    if len(args) == 2 and 'axis' not in kwargs and 'index' not in kwargs "
                    + "and 'columns' not in kwargs and 'labels' not in kwargs:\n"
                    + "        try:\n"
                    + "            ax = int(args[1])\n"
                    + "        except (TypeError, ValueError):\n"
                    + "            ax = None\n"
                    + "        if ax is not None and ax in (0, 1):\n"
                    + "            return _orig_df_drop(self, args[0], axis=ax, **kwargs)\n"
                    + "    return _orig_df_drop(self, *args, **kwargs)\n"
                    + "pd.DataFrame.drop = _tipdm_df_drop\n"
                    + "_orig_s_drop = pd.Series.drop\n"
                    + "def _tipdm_s_drop(self, *args, **kwargs):\n"
                    + "    if len(args) == 2 and 'axis' not in kwargs and 'index' not in kwargs "
                    + "and 'columns' not in kwargs and 'labels' not in kwargs:\n"
                    + "        try:\n"
                    + "            ax = int(args[1])\n"
                    + "        except (TypeError, ValueError):\n"
                    + "            ax = None\n"
                    + "        if ax is not None and ax in (0, 1):\n"
                    + "            return _orig_s_drop(self, args[0], axis=ax, **kwargs)\n"
                    + "    return _orig_s_drop(self, *args, **kwargs)\n"
                    + "pd.Series.drop = _tipdm_s_drop\n"
                    + "def _tipdm_as_matrix(self):\n"
                    + "    return self.to_numpy()\n"
                    + "pd.DataFrame.as_matrix = _tipdm_as_matrix\n"
                    + "pd.Series.as_matrix = _tipdm_as_matrix\n"
                    + "def _tipdm_series_append(self, other, ignore_index=False, verify_integrity=False, sort=False):\n"
                    + "    return pd.concat([self, other], ignore_index=ignore_index, "
                    + "verify_integrity=verify_integrity, sort=sort)\n"
                    + "pd.Series.append = _tipdm_series_append\n"
                    + "def _tipdm_df_append(self, other, ignore_index=False, verify_integrity=False, sort=False):\n"
                    + "    return pd.concat([self, other], ignore_index=ignore_index, "
                    + "verify_integrity=verify_integrity, sort=sort)\n"
                    + "pd.DataFrame.append = _tipdm_df_append\n";
}
