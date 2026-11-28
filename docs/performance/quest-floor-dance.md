# 摄影地台单人播舞：能否重建同舞段？

**2026-11-27：没有可配对的原 MMD 慢帧样本。** 本机 PATH 的 `adb devices` 只返回设备列表表头，没有连接的 Quest。本次复算的是 11 月 26 日同一台 Quest 3S 在固定预览 `7fd73aba` 的既有记录。两趟入口脚本相同，均为地台、一人、开角色物理、关阴影，实际报告 120 Hz，两眼各 1680×1760。

| 独立记录 | 可见时间端点、取窗规则 | 超过 1.5 个刷新周期的回调 / 有 Hz 的回调 |
|---|---|---:|
| WebGPU 实戴 | 19 个播舞窗全部 `actorStyle:endfield`、`clothMode:gpu`。以首个播放快照为左界，19.993–38.285 s 内余下 18 个整窗，窗口 FPS 中位 36。 | 659 / 659（100%） |
| WebGL 台架回退 | 一人播放的 53 窗沿用历史口径去首 6、尾 2，计入 (8.136, 53.491] s 中间 45 窗，窗口 FPS 中位 61。 | 2,712 / 2,753（98.51%） |

分子为各窗 `slowIntervals` 之和，分母为同窗 `intervalsWithRate` 之和；两段分别覆盖所计窗口的全部间隔。120 Hz 的阈值是 **严格大于 12.5 ms**。这能确认两趟各自存在持续慢回调；不是合成器丢帧数，也没有逐帧 GPU 耗时。两行不是 A/B。

**为什么截不出同舞段：**WebGPU 的原 MMD 快照全部暂停；WebGL 的原衣布局有 16.13 s 循环 VMD 和原生 Bullet 步进，导出未写 `actorStyle` 或 `clothMode`。三次含播种的秒窗不能定位到准确的 VMD 帧。两趟都没有动作时间端点或共同机位标记，图层报告的 `foveation` 也不同（WebGPU 0、WebGL 1）。只裁成相同秒数不能消除这些差异。

### Quest 3S 的帧预算与 Adreno 优化

[Quest 3S](https://www.qualcomm.com/xr-vr-ar/device-finder/meta-quest-3s) 使用 Snapdragon XR2 Gen 2。这份记录按实际视口算，两眼每帧合计 **591 万像素**；若应用逐帧跟上 120 Hz，就是每秒约 **7.10 亿个眼图像素**，尚未计遮挡、周边降采样、透明叠画、MSAA 与转色。这是输出规模，不是 GPU 着色器执行计数。120／90／72 Hz 分别给整个应用约 8.33／11.11／13.89 ms。

复算上表 45 个 WebGL 窗口：模型 CPU 更新的窗口均值再取中位为 **7.45 ms**，其中 Bullet 原生步进 **3.54 ms**；回调间隔中位 **16.4 ms**。18 个 WebGPU 窗口的回调间隔中位为 **27.52 ms**，没有模型 CPU 或逐段 GPU 时间。即便知道 GPU 型号，也不能把回调间隔减去 CPU 更新直接当成 GPU 耗时。此前教室单人开物理另测到 [9.90 ms CPU 更新](./viewing-and-diagnostics.md#已有测量)，已超过 120 Hz 的整帧预算。

**若安排 Adreno 专项，首选保住演员中心清晰度。** 先在设备实际采用的 72 Hz、同 PMX／原画风／舞段／机位下，只改一项：先比固定注视点渲染（FFR，降低视野周边的着色密度）；若该层不支持，再比眼图线性比例 1.0 与 0.85，后者理论像素数少 27.75%。核对导出的真实视口、FFR、场景附件采样数与慢帧。若 GPU 场景耗时随像素数下降，优先查发卡、树叶等多层透明覆盖和重复全屏读写；若 CPU 已超预算且降像素不改善慢帧，就回到 VMD、IK 和 Bullet。WebGPU 的主场景、最终双眼转色与布料要用[分段计时](../xr-rendering-stack.md#xr-输出与性能诊断)分别看，前提是设备支持时间戳。

[高通的移动 Adreno 指南](https://docs.qualcomm.com/bundle/publicresource/topics/80-78185-2/mobile_best_practices.html)建议减少不必要的渲染目标回写／重载。WebXR 可以调整可用的渲染层、绘制和材质；原生 Vulkan 的厂商扩展不是网页上的开关。若比较减少中间目标的方案，必须保留最终颜色转换与正确的左右眼输出。项目已有 [Quest 画质预设](../../src/mmdVrShowcase/settings/questPresets.ts)；整档切换会同时改多项，不用它做单项归因。上述是候选实验，本轮没有头显连接，也没有改默认画质。

**排除重复和旧档：**私有原件在 `local-review/verification/quest-floor-ab/`。上表分别取 `player-338-*.json` 和 `fallback-control.json` 的 `webgl`；后者的 `webgpu` 与 `live-empty-prior.json` 相同，只有空场。两份较晚的 `candidate-*.json` 都无播舞窗。另核 11 月 18–25 日的 12 份正式舞台导出，均无逐窗双眼尺寸、慢间隔计数和舞段时刻；[泳池的物理开关观察](./quest-2026-11-25.md#泳池值得复测角色物理不是同机位优化结论)不能补地台基线。

**下次只补同一段。** 本机候选的[共享导出器](../../src/mmdVrShowcase/diagnostics/performanceReport.ts)在有动作时长、单演员的采样端点附 `stageClock: { timeMs, durationMs }`，取采样时房间最近写入的播放钟；`elapsedMs` 仍是累计可见回调时间。它不是素材标识或逐帧呈现时刻，也不能证明窗内没有 seek。两趟用同一 PMX、衣着、身体 VMD 和摆位，记下同一机位，固定原 MMD、裙摆解算、物理、画质与眼图。预先指定不跨循环／拖进度的舞段；核对完整窗口两端的动作时刻和实际可见时长，再累计慢间隔。端点对不上就报告偏差，不按秒窗比例分摊。现有记录不支持改求解、材质或默认后端。
