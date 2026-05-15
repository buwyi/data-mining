# coding=utf-8
"""
Matplotlib 跨平台字体：避免仅指定 SimHei 时在 macOS/Linux 上出现大量 findfont 告警。
主程序生成的脚本会在 import 后调用 configure_matplotlib_fonts()。
"""
import logging
import warnings


def configure_matplotlib_fonts():
    """设置 sans-serif 候选列表（matplotlib 使用列表中第一个可用的字体）。"""
    try:
        import matplotlib

        matplotlib.use("Agg")
        import matplotlib.pyplot as plt

        plt.rcParams["axes.unicode_minus"] = False
        # 勿只写 SimHei：macOS 常见为 PingFang / Heiti；末位 DejaVu 保证无中文字体时仍可出图
        plt.rcParams["font.sans-serif"] = [
            "PingFang SC",
            "Heiti SC",
            "Songti SC",
            "STHeiti",
            "SimHei",
            "Microsoft YaHei",
            "WenQuanYi Micro Hei",
            "WenQuanYi Zen Hei",
            "Noto Sans CJK SC",
            "Source Han Sans SC",
            "Arial Unicode MS",
            "DejaVu Sans",
        ]

        logging.getLogger("matplotlib.font_manager").setLevel(logging.ERROR)
        logging.getLogger("matplotlib").setLevel(logging.WARNING)
        warnings.filterwarnings("ignore", message=".*Glyph.*")
        warnings.filterwarnings("ignore", message=".*findfont.*")
    except Exception:
        pass
