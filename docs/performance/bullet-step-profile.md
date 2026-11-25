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

## 求解器内部：准备、迭代与收尾

**11 月 25 日实模短验：4/4 个窗口都是迭代第一、准备第二；准备中 4/4 都是关节转换最贵。** 后者只说明建行的费用，不能推出主迭代中也是关节最贵。用上面相同的本机 PMX、真实身体 VMD、随包 WASM 和原求解设置。一次 Node 进程、双世界交替、不绘制；此处只预热 12 帧，正式 4 对 × 6 帧，**不是此前 48 个窗口的再拆分**。

| 求解器内互斥区间 | 桌面短验 ms / `stepSimulation` |
|---|---:|
| 求解器分派及批次间工作（`solveConstraints` 的剩余区间） | 0.05540 |
| 准备：刚体转换 | 0.01616 |
| 准备：关节转换 `convertJoints` | 0.14675 |
| 准备：接触转换 `convertContacts` | 0.02080 |
| 准备：其余（含约束行排序数组的准备） | 0.00512 |
| 迭代：除 split impulse 外的迭代（关节、接触、摩擦与循环控制） | 0.32239 |
| 迭代：穿透修正 `splitImpulse` 的完整调用 | 0.00565 |
| 收尾：写回接触、关节、刚体及清理 | 0.00801 |
| **`solveConstraints` 合计** | **0.58028** |

各项分母相同，都含零子步。按阶段合并：准备 **0.18882**、迭代 **0.32804** ms；不再与明细相加。原版／诊断版外层 `world_step` 均值为 1.13147／1.20250 ms，窗口配对差中位 +0.07594 ms。这些小段含探针扰动，不拿两轮不同时段的绝对数作提速比较。

**边界如何认定。** [固定版本的 Bullet 源码：三段调用顺序](https://github.com/yohawing/mmd-anim/blob/f4f68d7519d7c15f2bfc77f094410e57e94ea7aa/crates/mmd-anim-physics-bullet/vendor/bullet3/src/BulletDynamics/ConstraintSolver/btSequentialImpulseConstraintSolver.cpp#L1836-L1869)。`--solver` 在上述固定摘要的 WASM 中匹配 `solveGroupCacheFriendly{Setup,Iterations,Finish}` 的 `BT_PROFILE` 入口和各自唯一的退出；准备中另标 `convertBodies`、`convertJoints`，迭代中另标 `solveGroupCacheFriendlySplitImpulseIterations`。`convertContacts` 自身没有标记：[源码](https://github.com/yohawing/mmd-anim/blob/f4f68d7519d7c15f2bfc77f094410e57e94ea7aa/crates/mmd-anim-physics-bullet/vendor/bullet3/src/BulletDynamics/ConstraintSolver/btSequentialImpulseConstraintSolver.cpp#L1486-L1506)与该产物中三个连续虚调用逐项吻合（刚体、关节、manifold 各自的指针与数量、同一 `solverInfo`、槽偏移 36/32/28）。探针只包围第三个调用；随后构造和初始化排序数组仍在「准备：其余」。匹配不唯一即失败。

**分不开什么。** [主迭代](https://github.com/yohawing/mmd-anim/blob/f4f68d7519d7c15f2bfc77f094410e57e94ea7aa/crates/mmd-anim-physics-bullet/vendor/bullet3/src/BulletDynamics/ConstraintSolver/btSequentialImpulseConstraintSolver.cpp#L1526-L1695)在一个 `solveSingleIteration` 标记内依次处理关节行、接触与摩擦，关节与摩擦还共用 generic row solver。命名标记不提供按行类型的时间；收尾也只有整个 `Finish` 的边界。`splitImpulse` 只对应接触的穿透修正，入口被调用不等于完成多少次修正。不能拿接触点数、关节数或「主迭代减去 split」来估算各自的求解总费，也不能把窄相生成接触的费用算到转换里。

**等价。** 正式每变体 24 次调用中，诊断世界有 4 次零子步、20 次单子步；20 次 `solveConstraints` 完成 40 组准备→迭代→收尾（可能有空批次，不是模拟岛数）。逐段校验准备中的三次转换、迭代中的 split 及批次顺序；按相邻时间戳互斥分账，子账与父账、外层总账均差 **0 ns**。含预热在 6 个相同动作时刻比较两世界：48,480 个骨矩阵标量、312 个表情权重、384 个蒙皮顶点位置与 6 份完整接触记录逐值一致，最多 330 个接触点；右腕相对第一次取样移动最多 6.48 cm。

**两轮正式对照。** 原版先建／插桩版先建，每变体每轮预热 96 帧，正式 24 窗 × 24 帧。全部 **48/48 窗**的求解器阶段均以迭代为首。每次原生步进均值分别 **1.167／1.178 ms**，其中约束求解 **0.570／0.566 ms**，迭代 **0.324／0.321 ms**，准备 **0.181／0.180 ms**；准备中的关节转换 **0.137／0.138 ms**、接触转换 **0.018／0.019 ms**。阶段嵌套，不累加。每轮含 480 次单子步和 96 次零子步，960 个求解批次，分账差 0 ns；28 个相同动作时刻的 226,240 个骨矩阵标量、1,456 个形态权重、1,792 个蒙皮顶点和完整接触列表逐值一致。插桩使外层调用的配对窗中位差分别为 +0.053／+0.003 ms。

**接下来先查什么。** ① 在诊断构建为**整个关节行循环**和**整个接触／摩擦行循环**分别设边界，再与随包基线验轨迹；不要每行跨 WASM 打点。② 准备段单独调查 `convertJoints` 的 `getInfo1` 行数计算和 `convertJoint`/`getInfo2` 填行；不把随姿态变化的行、关节参数当常量缓存。③ 收尾、停放体 AABB 不优先；窄相仍是原生步进另一条独立调查线。保留关节、有效接触、迭代次数和固定步长；这里没有更换随包求解器或 Quest 帧率结论。

**复现（项目根目录，Node 26.12.1）。** 沿用上面的实验依赖。前两条是边界与实模短验；后两条须等桌面空闲、父会话无基准时逐条运行，每轮新进程，恢复原 96 帧预热、24 对 × 24 帧。把 stdout 分别存为本机 JSON 即可比较：`solver.phaseMs` 是四个同级阶段，`solver.exclusiveMs` 是八个互斥明细，`rows[1].blocks[*].solver` 是每窗原值；另看 `medianPairedAbiDeltaMs` 和两层 `partitionErrorNs`。

```sh
node experiments/bullet-step-profile/boundaries.mjs --solver
node experiments/bullet-step-profile/playback.mjs "<actor.pmx>" "<body.vmd>" --solver --smoke
node experiments/bullet-step-profile/playback.mjs "<actor.pmx>" "<body.vmd>" --solver
node experiments/bullet-step-profile/playback.mjs "<actor.pmx>" "<body.vmd>" --solver --reverse
```
