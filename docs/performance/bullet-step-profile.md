# Bullet `stepSimulation` 内部分段｜2026-11-23

**这套实模播放中，约束阶段最大：两轮各 24 个窗口，48/48 个窗口都是第一。** 它约占原生步进的 49%，窄相派发约 28%；整个世界的 AABB 更新加宽相配对占 16%，其中只有一部分可能来自停放的辅助体。没有依据优先改 22 个辅助体的宽相刷新，也不能通过删关节、关接触来换时间。

| 每次 `stepSimulation` 的均值，ms（含零子步调用） | 原版先建 | 诊断版先建 |
|---|---:|---:|
| AABB 更新 `updateAabbs` | 0.2350 | 0.2287 |
| 宽相配对 `calculateOverlappingPairs` | 0.0105 | 0.0106 |
| 窄相派发 `dispatchAllCollisionPairs` | 0.4213 | 0.4261 |
| 计算模拟岛 `calculateSimulationIslands` | 0.0147 | 0.0143 |
| 约束 `solveConstraints`（含岛内派发、接触与关节求解） | 0.7400 | 0.7321 |
| 其他（子步外工作、预测、积分等） | 0.0929 | 0.0969 |
| **以上合计：原生 `stepSimulation`** | **1.5143** | **1.5087** |

**配对条件。** Windows、Node 26.12.1、CPU 无绘制。沿用[配对播放探针](../../scripts/paired-playback-probe.html)的 505 骨 PMX 和 735,180 字节身体 VMD。每轮两套独立世界，相同 0.1× 模型、343 个作者刚体（317 动态、26 跟骨）、原 605 个关节，另有 2 手柄、12 手部、8 道具槽全部停放。按 1/72 秒推进同一段动作，物理固定步长 1/60。每变体预热 96 帧，正式 24 对 × 24 帧，每对交换先后，第二轮另起进程反转建模和首对顺序。每轮每变体 576 次正常调用；诊断版直接数到 **480 次单子步、96 次零子步**。

**计时边界。** 对随项目分发的 0.8.6 WASM 只在内存中插桩。C 入口通过参数检查后，在真正的 `stepSimulation` 虚调用前后打点；五段取自 Bullet 源码已有的 `BT_PROFILE` 进入和退出位置。`internalSingleStepSimulation` 仅计数；`performDiscreteCollisionDetection`、求解器内部的嵌套标记不另加。用同一单调时钟按相邻打点的差额分账，未覆盖区间单列「其他」。逐调用验证五段按顺序、无重叠；两轮未舍入的六段之和与独立首尾差都是 **0 ns 误差**。另用空世界验证零步、一步、四步限幅为两步，以及非法输入、reset、settle 不计时。

**诊断代价与等价。** 外层 JS `world_step` 均值原版→插桩分别为 1.5224→1.5206、1.5009→1.5148 ms；配对窗口差的中位为 +0.0006、+0.0068 ms。它仅校核边界与扰动，不与表中数字相加。每轮在 28 个相同动作时刻（含预热）比较 226,240 个骨矩阵标量、1,456 个表情权重、1,792 个蒙皮位置及 28 份完整接触记录（最多 292 点），逐值相同；右腕最大位移约 5.06 cm。表中数字含时钟扰动，是桌面单角色、停放输入的分布，不拆算教室 Quest 的 5.04 ms 或 FPS。

**复现。** 项目根目录先装好舞台依赖；WABT 只装在[实验目录](../../experiments/bullet-step-profile/)。以下两轮串行运行，输出含每个窗口。固定发布物 SHA-256，不匹配即停；无标记的 WASM 文本往返校验逐字节相同（除可省的 data-count 段）。原 loader `v0.8.6` 的 `native/third_party/mmd-anim` 为 `f4f68d75`，标记可在其 `crates/mmd-anim-physics-bullet/vendor/bullet3/src` 下的 `btCollisionWorld.cpp` 与 `btDiscreteDynamicsWorld.cpp` 核对。实验不写二进制和用户配置。

```sh
npm ci --prefix experiments/bullet-step-profile --ignore-scripts
node experiments/bullet-step-profile/boundaries.mjs
node experiments/bullet-step-profile/playback.mjs "<actor.pmx>" "<body.vmd>"
node experiments/bullet-step-profile/playback.mjs "<actor.pmx>" "<body.vmd>" --reverse
```
