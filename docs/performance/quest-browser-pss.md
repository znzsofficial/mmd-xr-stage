# 放角色前后，Quest 浏览器进程用了多少内存？

电脑通过已授权的 ADB 连接 Quest，头显只留一个舞台标签页，在同一景站好。电脑运行 `node scripts/quest-browser-pss.mjs`，跟随终端提示用回车标记四个阶段：空场、准备点放置、角色已站稳、收回背包。除放置过程外，各段等至少三行有效读数。再进一次可另录；页面自己的 VR JSON 也照常导出。若浏览器包名不同，以第二个命令行参数指定；多设备时用 `ANDROID_SERIAL`。

工具使用 Android [`dumpsys meminfo`](https://developer.android.com/tools/dumpsys#meminfo) 的 `TOTAL PSS`：只加同包名及 `包名:` 前缀进程的读数。每轮前后检查 PID 与名字、按进程顺序读数，两轮间隔至少两秒。进程集合变化、取样跨越人工标记、设备断开或格式无法识别均保留为无效样本。报告在本机 `local-review/verification/quest-memory/`；不含进程名、命令行、设备序号或角色名。

`maxSampleKiB` 是采到的进程组总和的最大值；短促的首次分配可能完全漏采，多个进程也不是同一瞬间取的。它不是系统总内存、单页独占、GPU 驱动驻留或精确峰值。其他应用、系统合成器、名字不属该包的进程不在内。各段有效样本数为零时不作比较。采样本身影响性能，这一趟不要兼作 FPS 基准。
