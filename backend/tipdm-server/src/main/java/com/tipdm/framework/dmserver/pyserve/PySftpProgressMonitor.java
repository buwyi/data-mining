package com.tipdm.framework.dmserver.pyserve;

import com.jcraft.jsch.ChannelExec;
import com.jcraft.jsch.JSchException;
import com.jcraft.jsch.Session;
import com.jcraft.jsch.SftpProgressMonitor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Created by TipDM on 2017/6/1.
 * E-mail:devp@tipdm.com
 */
public class PySftpProgressMonitor implements SftpProgressMonitor {

    private final static Logger logger = LoggerFactory.getLogger(PySftpProgressMonitor.class);

    private Session session;

    private List<String> msgQueue;

    private AtomicBoolean isDone;

    private String dest;

    /** 远程 shell 上用于执行脚本的解释器，如 python3、python（见 PyConnectionPool.xml 的 pythoncmd） */
    private final String pythonExecutable;

    public PySftpProgressMonitor(Session session, List<String> msgQueue, AtomicBoolean isDone, String pythonExecutable) {
        this.session = session;
        this.msgQueue = msgQueue;
        this.isDone = isDone;
        this.pythonExecutable = (pythonExecutable == null || pythonExecutable.trim().isEmpty())
                ? "python3"
                : pythonExecutable.trim();
    }

    /** sh 单引号安全包裹（路径中含空格、单引号时可用） */
    private static String shellSingleQuote(String s) {
        return "'" + s.replace("'", "'\"'\"'") + "'";
    }

    /**
     * 远程执行时 Python 将 FutureWarning/DeprecationWarning 打到 stderr，而本类把 stderr 全部记入 msgQueue，
     * 会导致 {@link PySession} 误判为算法失败。若无 Traceback，则丢弃典型告警行。
     */
    private static void filterBenignStderr(List<String> msgQueue) {
        if (msgQueue == null || msgQueue.isEmpty()) {
            return;
        }
        boolean traceback = false;
        for (String line : msgQueue) {
            if (line != null && line.contains("Traceback")) {
                traceback = true;
                break;
            }
        }
        if (traceback) {
            return;
        }
        msgQueue.removeIf(line -> line != null && isBenignWarningLine(line));
    }

    private static boolean isBenignWarningLine(String line) {
        String t = line;
        return t.contains("FutureWarning:")
                || t.contains("DeprecationWarning:")
                || t.contains("PendingDeprecationWarning:")
                || t.contains("PerformanceWarning:");
    }

    @Override
    public void init(int i, String source, String dest, long l) {
        this.dest = dest;
    }

    @Override
    public boolean count(long l) {
        return true;
    }

    @Override
    public void end() {
        ChannelExec channelExec = null;
        ChannelExec channelRm = null;
        BufferedReader in = null;
        //上传成功后开始执行
        try {
            channelExec = (ChannelExec) session.openChannel("exec");
            //保持编码一致性；解释器由 PyConnectionPool.xml 的 pythoncmd 配置（默认 python3，适配 macOS）
            String command = "export LANG=zh_CN.UTF-8;" +
                             "export LC_CTYPE=zh_CN.UTF-8;" +
                             "export LC_ALL=zh_CN.UTF-8; " +
                             pythonExecutable + " " + shellSingleQuote(dest);
            logger.info("exec command: {}", command);
            channelExec.setCommand(command);
            in = new BufferedReader(new InputStreamReader(channelExec.getErrStream()));
            channelExec.connect();

            String msg = null;
            while ((msg = in.readLine()) != null) {
                msgQueue.add(msg);
            }
            filterBenignStderr(msgQueue);
            //删除
            channelRm = (ChannelExec) session.openChannel("exec");
            channelRm.setCommand("rm -fr -- " + shellSingleQuote(dest));
            channelRm.connect();
        } catch (JSchException e) {
            msgQueue.add(e.getMessage());
        } catch (IOException e) {
            msgQueue.add(e.getMessage());
        } finally {

            if (in != null) {
                try {
                    in.close();
                } catch (IOException e) {
                    logger.error(e.getMessage());
                }
            }

            if (channelExec != null) {
                channelExec.disconnect();
            }
            if (channelRm != null) {
                channelRm.disconnect();
            }
            isDone.getAndSet(true);
        }
    }
}
