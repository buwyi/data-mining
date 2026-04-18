package com.tipdm.framework.dmserver.utils;

import java.io.File;

/**
 * Created by TipDM on 2017/2/17.
 * E-mail:devp@tipdm.com
 */
public class Constants {

    /**
     * 算法日志前缀
     */
    public final static String DOCUMENT_DIR = "doc";

    public final static String MODEL_DIR = "model";

    public final static String REPORT_DIR = "report";

    public final static String JAR_DIR = "jar";

    public final static String SMB_PUBLIC_DIR = "smb-public";

    public final static String SMB_PRIVATE_DIR = "smb-private";

    public final static String PROJECT_HISTORY_VERSION = "project_history_version";

    public final static String MODEL_VERSION = "MODEL_VERSION";

    public final static String UN_SAVED_MODEL = "un_saved_model";//未保存的模型

    public final static String DFT_YYYY_MM_DD_HH_MM_SS= "yyyy-MM-dd HH:mm:ss";

    /**
     * Python 远程机（SFTP）工作根目录：脚本上传、report/、model/ 均在此路径下。
     * 默认位于工程根下 {@code logs/python}（与 *.log 文本日志并列，专用于 Python/SFTP 执行工作目录及产出）。
     * 解析顺序：系统属性 {@code tipdm.home}（推荐在启动 Tomcat 时指向仓库根目录）→ 否则 {@code user.dir}。
     */
    public static final String PYSERVER_COMMON_DIR = resolvePyserveCommonDir();

    private static String resolvePyserveCommonDir() {
        String base = System.getProperty("tipdm.home");
        if (base == null || (base = base.trim()).isEmpty()) {
            base = System.getProperty("user.dir", ".");
        }
        File dir = new File(base, "logs/python");
        if (!dir.exists()) {
            dir.mkdirs();
        }
        return dir.getAbsolutePath();
    }

    public final static String FILE_UPLOAD_ID = "uploadFileKey";

    public final static String WS_CLIENTS = "ws-clients";

    public final static String WS_JOB_TRACKER = "ws-job-tracker";

    public final static String DEFAULT_TENANTID = "public";

}
