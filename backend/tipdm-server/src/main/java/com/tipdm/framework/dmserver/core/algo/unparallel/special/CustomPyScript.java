package com.tipdm.framework.dmserver.core.algo.unparallel.special;

import com.tipdm.framework.common.Constants;
import com.tipdm.framework.common.utils.*;
import com.tipdm.framework.dmserver.core.algo.unparallel.AbstractPythonAlgorithm;
import com.tipdm.framework.dmserver.exception.AlgorithmException;
import com.tipdm.framework.dmserver.utils.PandasLegacyCompat;
import com.tipdm.framework.model.dmserver.DataSchema;
import com.tipdm.framework.service.dmserver.DataSchemaService;
import org.apache.commons.collections.MapUtils;
import org.apache.commons.lang3.exception.ExceptionUtils;

import java.io.File;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.net.URI;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Created by TipDM on 2018/2/8.
 * E-mail:devp@tipdm.com
 */
public class CustomPyScript extends AbstractPythonAlgorithm {

    private final static String TAB = "    ";

    private static String METHOD_SIGN = "def execute(conn, inputs):\n";

    private static DataSchemaService dataSchemaService = SpringUtils.getBean("dataSchemaService", DataSchemaService.class);

    /**
     * pandas 2.0+：DataFrame.drop 不再允许第二个位置参数表示 axis（如 drop('y', 1)），须写 axis=1。
     * 自定义脚本保存在流程参数 content 中，不经过 dm_component_script，因此在服务端做一次迁移。
     */
    private static String migratePandas2DropAxis(String content) {
        if (content == null || content.indexOf("drop") < 0) {
            return content;
        }
        String s = content;
        // 常见字面量（含全角逗号、全角 1）
        s = s.replace(".drop('y', 1)", ".drop('y', axis=1)");
        s = s.replace(".drop(\"y\", 1)", ".drop(\"y\", axis=1)");
        s = s.replace(".drop('y', １)", ".drop('y', axis=1)");
        s = s.replace(".drop('y'，1)", ".drop('y', axis=1)");
        s = s.replace(".drop('y'，１)", ".drop('y', axis=1)");
        String comma = "(?:,|，)";
        String one = "[1１]";
        s = s.replaceAll(
                "\\.drop\\(\\s*'([^']*)'" + comma + "\\s*" + one + "\\s*\\)",
                ".drop('$1', axis=1)");
        s = s.replaceAll(
                "\\.drop\\(\\s*\\\"([^\"]*)\\\"" + comma + "\\s*" + one + "\\s*\\)",
                ".drop(\"$1\", axis=1)");
        s = s.replaceAll(
                "\\.drop\\(\\s*(\\[[^\\[\\]]*\\])" + comma + "\\s*" + one + "\\s*\\)",
                ".drop($1, axis=1)");
        s = s.replaceAll(
                "\\.drop\\(\\s*([a-zA-Z_]\\w*)" + comma + "\\s*" + one + "\\s*\\)",
                ".drop($1, axis=1)");
        s = s.replaceAll(
                "\\.drop\\(\\s*'([^']*)'" + comma + "\\s*0\\s*\\)",
                ".drop('$1', axis=0)");
        s = s.replaceAll(
                "\\.drop\\(\\s*\\\"([^\"]*)\\\"" + comma + "\\s*0\\s*\\)",
                ".drop(\"$1\", axis=0)");
        s = s.replaceAll(
                "\\.drop\\(\\s*(\\[[^\\[\\]]*\\])" + comma + "\\s*0\\s*\\)",
                ".drop($1, axis=0)");
        s = s.replaceAll(
                "\\.drop\\(\\s*([a-zA-Z_]\\w*)" + comma + "\\s*0\\s*\\)",
                ".drop($1, axis=0)");
        return s;
    }

    /** pandas 2.0+ 已移除 as_matrix()，与 patch_pandas2_component_scripts.py 中规则一致。 */
    private static String migratePandasAsMatrix(String content) {
        if (content == null || content.indexOf("as_matrix") < 0) {
            return content;
        }
        return content.replaceAll("\\.as_matrix\\s*\\(\\s*\\)", ".to_numpy()");
    }

    @Override
    protected void execute() throws AlgorithmException {

        if (!getParams().containsKey("content")) {
            throw new AlgorithmException("参数缺失，参数名：content");
        }

        if (!getOutputs().containsKey("output")) {
            throw new AlgorithmException("算法执行错误，缺失必须的输出项【output】");
        }

        String content = migratePandasAsMatrix(migratePandas2DropAxis(getParams().get("content")));
        String[] lines = StringKit.split(content, "\n");
        for (int i = 0; i < lines.length; i++) {
            lines[i] = TAB + lines[i];
        }
        DataSchema dataSchema = dataSchemaService.findByName(component.getCreatorName());
        String script = METHOD_SIGN + StringKit.join(lines, "\n");

        LinkedHashMap<String, String> dbConfig = PropertiesUtil.getProperties("sysconfig/database.properties");
        String url = dbConfig.get("db.url");
        URI uri = URI.create(url.substring(5));
        String host = uri.getHost();
        int port = uri.getPort();
        String dbName = uri.getPath().substring(1);
        String user = dataSchema.getName();
        String password = dataSchema.getPassword();

        StringBuilder sb = new StringBuilder("#coding=utf-8\n"
                + PandasLegacyCompat.BEFORE_IMPORT_PANDAS
                + "import pandas as pd\n"
                + PandasLegacyCompat.AFTER_IMPORT_PANDAS
                + "import sys\n" +
                "sys.path.append('" + com.tipdm.framework.dmserver.utils.Constants.PYSERVER_COMMON_DIR + "')\n" +
                "import db_utils as db_utils\n" +
                "import report_utils as report_utils\n" +
                "import mpl_fonts as mpl_fonts\n" +
                "mpl_fonts.configure_matplotlib_fonts()\n" +
                "try:\n" +
                "    import joblib\n" +
                "except ImportError:\n" +
                "    from sklearn.externals import joblib\n" +
                "import psycopg2 as pg\n");

        sb.append(script).append("\n");
        sb.append("conn = None").append("\n");
        sb.append("try:").append("\n");
        sb.append(TAB).append("conn = db_utils.getConnection(host=\"").append(host).append("\"")
                .append(", port=").append(port)
                .append(", dbname=\"").append(dbName).append("\"")
                .append(", user=\"").append(user).append("\"")
                .append(", password=\"").append(password).append("\"")
                .append(", schema=\"").append(user).append("\"")
                .append(")\n");

        sb.append(TAB).append("inputs = {}\n");
        if (MapUtils.isNotEmpty(getInputs())) {
            for (Map.Entry<String, String> input : getInputs().entrySet()) {
                sb.append(TAB).append("inputs['" + input.getKey() + "'] = ").append("'" + input.getValue() + "'")
                        .append("\n");
            }
        }

        sb.append(TAB).append("outputs = {}\n");
        if (MapUtils.isNotEmpty(getOutputs())) {
            for (Map.Entry<String, String> output : getOutputs().entrySet()) {
                sb.append(TAB).append("outputs['" + output.getKey() + "'] = ").append("'" + output.getValue() + "'")
                        .append("\n");
            }
        }

        sb.append(TAB).append("output = execute(conn, inputs)").append("\n");
        sb.append(TAB).append("db_utils.dbWriteTable(conn, outputs['output'], output)").append("\n");
        sb.append("finally:").append("\n");
        //关闭连接
        sb.append(TAB).append("db_utils.closeConnection(conn)").append("\n");

        File pyFile = new File(RedisUtils.get("upload/tmp", String.class), UUID.randomUUID().toString() + ".py");
        try {
            FileKit.writeStringToFile(pyFile, sb.toString(), Constants.CHARACTER);
        } catch (IOException e) {
            throw new AlgorithmException("Python文件生成失败");
        }
        String reportFile = component.getClientId() + ".html";
        String model = getOutputs().get("model");
        try {
            pySession.train(pyFile, reportFile, model);
        } catch (FileNotFoundException e) {
            logger.error(ExceptionUtils.getRootCauseMessage(e));
            throw new AlgorithmException("Python文件不存在");
        } catch (AlgorithmException e) {
            logger.error(ExceptionUtils.getRootCauseMessage(e));
            throw e;
        }
    }
}
