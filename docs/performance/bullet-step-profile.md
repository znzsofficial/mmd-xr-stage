# Bullet `stepSimulation` 内部分段｜2026-11-23

## 0.9.0 重角色与触觉查询

桌面 Node 26.13.1，Windows 高性能电源计划。用 `--0.9.0` 选择当前发布 WASM；另行核对其摘要、数据段偏移、求解器函数指令和空世界边界，旧命令仍复现 0.8.6。929 刚体、1,608 关节的原衣原件，另有 22 个停放槽；同 VMD、0.1×、72 Hz 求值／60 Hz 物理。每轮预热 96 帧，24 窗 × 24 帧交替运行两套世界，再反转建模与首窗顺序。正式段分别有 480 次单子步和 96 次零子步。

- **定位：**按所有步进调用取均值，约束求解 **2.23／2.22 ms**，窄相碰撞派发 **1.29／1.27 ms**，AABB 更新 **0.82／0.84 ms**；其中关节行本身 **0.75／0.74 ms**。未插桩世界输出回写 **0.21／0.18 ms**。求解器内外分账各自闭合。`node experiments/bullet-step-profile/boundaries.mjs --0.9.0 --rows`；`playback.mjs <PMX> <VMD> --0.9.0 --rows [--reverse]`。
- **没有采用的候选：**`--island-range` 在内存中替换 `processIsland` 的两遍扫描，二分定位已排序的关节段。全部实模端点骨矩阵、蒙皮采样和接触列表一致；重角色 `rt.update` P95 正序 **10.76→10.35 ms**，反序 **9.42→9.58 ms**。海站同机 WebGL 模拟 XR 的双眼帧间隔 P95（原／候选／候选／原）为 **23.1／24.6／22.3／23.7 ms**，无稳定改善。正式站继续用原装 WASM。
- **采用的改动：**在海站开手柄触觉后，正式房间另有 30 Hz 接触查询，常态每次要两遍扫描。fork `c4d56e8` 复用分配的接触缓冲；容量足够时当步只扫一次，增长时扩到返回的完整点数再取，按原顺序判断任一端是否属于手柄。单独的计数接口仍只计数。不会复用上一步接触值。

| 固定舞段，角色求值＋正常频率的手柄查询 P95（ms） | 原版先建：原→新 | 新版先建：原→新 |
|---|---:|---:|
| 重角色，929 个作者刚体 | 41.81→32.50 | 22.91→17.79 |
| 第二份重角色，623 个刚体 | 11.14→9.51 | 9.52→8.49 |
| 普通角色，122 个刚体 | 1.82→1.81 | 1.75→1.76 |

每组两版同世界输入，各 576 帧、240 次查询；只在组内比较。重角色单次查询中位 **18.99→9.82／9.83→5.00 ms**。纯 `rt.update` 不含这笔费用。每份原件另暂停舞段，手柄连续扫入膝侧、撤手、恢复播放；四份实模各 32 个窗口端点的整套骨矩阵、各 80 个蒙皮点及全量接触记录逐值一致，含极端质量尾链。重角色暂停期间各累计 36 个手柄命中，撤手后归零。

**可见帧：**同一台 RTX 4060 Laptop、海站 WebGL / IWER、同一原件、机位与原画风，对照仅切换 loader 接触读取方法。各取舞段 1–6 秒，每趟都确认左右眼绘制、腕部随舞移动，四次按原／新／新／原运行。实测双眼绘制完成间隔 P95 **70.1／59.2／57.4／69.7 ms**，原生接触收集 **202／105／103／202 次**。这是高负载下的桌面模拟结果，和上面索引候选的绝对时长不跨趟比较；没有 Quest 持续帧率实测。本机原始窗、命中序列和复现入口：`local-review/heavy-bullet/`。

### 第二轮：看舞时两只手柄都离开演员

手柄有振动能力时，即使只是拿在身前看舞，旧路径也要约每秒 30 次遍历接触。0.9.0 的原生 `world_collect_contacts` 为每个接触流形查两次刚体编号，包括没有接触点的流形。在同一 929 刚体原件上，每次收集平均约 **1,265 万次**编号比较。对冻结的同一组流形，仅以记录好的两个正确编号代替这两段查找，收集返回的字节完全相同；两轮分别少 **4.79／4.96 ms**。这是定位用的对照，发布版沿用原装 Bullet。

舞台只在能证明**两只手柄与模型都没有接触**时略过收集。一次完整查询确认零命中之后，用本次已写入运动学姿态、尚未开始碰撞派发的原生刚体中心，给每个形状保留能覆盖任意转角的余量。靠近演员、缺数据、重置，或单次调用可能推进多个物理子步，都走精确查询。此前的碰撞不会仅因手柄移开就当作已消失，小角色不做这笔中心读取。求解步长、接触过滤和衣物运动沿用原值。

**验证的是角色更新加查询的 CPU 时间。** 新的中心读取发生在演员更新内，比较时把两项合起来。固定 VMD、72 Hz 求值／60 Hz 物理，持有两只正常跟踪的手柄；另逐帧比对暂停靠近、撤手、失追、重获后再碰与恢复播放。两套世界的手柄计数和完整采样端点一致；两次接近与撤离合计 47 个有命中的帧、164 个接触点。可在 `local-review/heavy-bullet/` 用 `index-scan.mjs`、`controller-bounds-pair.mjs heavy` 和 `--reverse` 重播。当前头显若持续低于物理步频，不能套用 72 Hz 短步的收益。

在桌面两种建模顺序下，929 刚体样本的 576 帧播舞中，240 次轮询由 **240 次原生收集降至 7 次**，含触觉查询的角色更新 P95 分别 **16.96→13.20、16.93→13.06 ms**。即使手柄一直远离，也最多经过 72 步就重新核实接触密度。另一个有 512 个分离静体的稀疏样本，两版本都精确收集 121 次，没有为判断距离额外读取整组中心。暂停托裙和撤手回落期间两版本 300 个衣摆取样位置一致。秒窗中的中心检查记入 `bulletStepWork.feedMs`，不会被误报成求解器变慢。

**接触收集的下一处。** 现有远手柄证明在靠近或补步时仍要走全量收集。先验证只跳过零点流形，保留当前接触反馈和求解器；另外单量其对实际舞台回调的影响。

**零点流形，CPU 工作量对照。** 在 Node 中运行实际舞台求值和 0.9.0 Bullet 的内存探针；未生成或替换发布 WASM。929 刚体实模，远离时 100 次原生收集中，零点流形占 **94.73%**，提前跳过可移除 **95.52%** 的刚体编号比较（约 **12.05 亿 → 0.54 亿**）。贴近及撤手的两次轨迹共 96 次收集，可移除 **95.63%**；两次均有 24 次正接触读数，末尾归零，第二次以 1/30 秒推进，覆盖补步。原路径和候选的接触总数及有序记录逐字节相同；零容量及截断容量也保持总数，已写入的前缀一致。

**同一流形状态的桌面 CPU 计时。** 两轮分别反转首测顺序，在每次原生查询上交替基线／提前跳过，计时路径关闭计数；远离段剔除前 16 次预热。中位数远离 **4.81→0.30／4.87→0.30 ms**，贴近与撤手 **9.18→0.49／9.04→0.49 ms**。这只量原生全量接触收集，不含查询节流、演员或 Bullet 求解步进；不是整帧收益，也不是 Quest 时间。本机脚本 `local-review/heavy-bullet/empty-manifolds.mjs --timing [--reverse]`。

**海站 WebGL 舞台对照。** 桌面 IWER 会话报告 72 Hz，不代表桌面回调被锁到 72；真实硬件 WebGL 画两眼。用同一个 929 刚体实模，舞段 1–6 秒，两只模拟手柄均可振动，右手从远处到膝侧再撤开。浏览器依次载入官方 WASM、内存候选、内存候选、官方 WASM；四趟各 300 次按侧触觉读，接近段右手各触发一次，撤手稳态零命中。原生收集 P95 为 **6.2／0.5／0.5／5.6 ms**，原生步进 P95 为 **7.7／7.1／7.4／7.2 ms**，双眼绘制完成间隔 P95 为 **19.2／12.3／12.7／12.4 ms**。查询收益稳定，反向顺序未显示整帧稳定变化。候选仅注入测试浏览器；原始记录 `local-review/heavy-bullet/empty-xr.json`。

**可复现的原生构建。** [mmd-anim #73](https://github.com/yohawing/mmd-anim/pull/73) 把提前跳过落实到共享 C++ 源码。[构建对照](https://github.com/znzsofficial/mmd-anim/actions/runs/46157898906)用 Emscripten 5.0.7 重现官方 0.9.0 classic / worker 的四个文件，均逐字节一致；候选只变两个 WASM，SHA-256 同为 `7b855c741525910a97973f7ee070732af759a761b4c79d0d355a1a1476205717`，两种入口的 ABI 冒烟通过。实际舞台 Node 路径的 336 帧左右手计数一致，13 个取样点的原生有序记录、零／截断容量及骨矩阵、蒙皮取样也一致。将复编候选送入上面的 WebGL 双眼回放，原生收集 P95 **7.8／0.7／0.6／6.9 ms**，刷过时仍能触发，撤手读数归零，回调间隔收益不稳定；本机原始记录 `local-review/heavy-bullet/empty-native-xr.json`。等含这项改动的匹配 loader 发布制品再晋级。

直接取号是独立备选：编号是当前世界成功追加的槽位，取号后核对范围与对象身份；另测双世界、换定义重建及手柄贴近时的补步。先看跳过空流形后是否还有值得做的查询开销。现行 loader 导出拒绝异于官方包的二进制，不能只替换游戏的公共 WASM。

如果直接取号后触觉查询仍占明显时间，再检查把区间筛选移到原生侧。当前 loader 的 `debugPhysicsContactsForRigidBodyRange` 在 JavaScript 筛选；WASM 仍先写所有刚体的接触，缓冲不足还会再收集一遍。原生区间入口可减少写出与扫描缓冲，须保持旧全量 API；验收与现行区间调用比对，任一端落在半开区间即保留，顺序与方向不变。此项与查号分开，尚未计时。

## 0.8.6 历史分段

**这套实模播放中，约束阶段最大：两轮各 24 个窗口，48/48 个窗口都是第一。** 它约占原生步进的 49%，窄相派发约 28%；整个世界的 AABB 更新加宽相配对占 16%，其中只有一部分可能来自停放的辅助体。没有依据优先改 22 个辅助体的宽相刷新，也不能通过删关节、关接触来换时间。

**11 月 25 日续测：[主迭代行循环](#主迭代行循环)的 48/48 个新窗口中，关节行均比接触与摩擦行合计更耗时。** 两种建模顺序下，关节行约占非 split 迭代的 70%／71%。这里只定位下一处要查的代码，不是墙钟提速或头显收益。

**[实际关节行](#实际关节行)：**同一原衣角色分开站立、保持捧腿和播舞，三次短验每次都是 400 遍、零行被 override 判断跳过。保持捧腿比播舞多执行 51,920 行，主要多在单侧限位。没有改变游戏求解器。

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

**仅用 `--solver` 分不开什么。** [主迭代](https://github.com/yohawing/mmd-anim/blob/f4f68d7519d7c15f2bfc77f094410e57e94ea7aa/crates/mmd-anim-physics-bullet/vendor/bullet3/src/BulletDynamics/ConstraintSolver/btSequentialImpulseConstraintSolver.cpp#L1526-L1695)在一个 `solveSingleIteration` 标记内依次处理关节行、接触与摩擦，关节与摩擦还共用 generic row solver。命名标记不提供按行类型的时间；收尾也只有整个 `Finish` 的边界。`splitImpulse` 只对应接触的穿透修正，入口被调用不等于完成多少次修正。不能拿接触点数、关节数或「主迭代减去 split」来估算各自的求解总费，也不能把窄相生成接触的费用算到转换里。

**等价。** 正式每变体 24 次调用中，诊断世界有 4 次零子步、20 次单子步；20 次 `solveConstraints` 完成 40 组准备→迭代→收尾（可能有空批次，不是模拟岛数）。逐段校验准备中的三次转换、迭代中的 split 及批次顺序；按相邻时间戳互斥分账，子账与父账、外层总账均差 **0 ns**。含预热在 6 个相同动作时刻比较两世界：48,480 个骨矩阵标量、312 个表情权重、384 个蒙皮顶点位置与 6 份完整接触记录逐值一致，最多 330 个接触点；右腕相对第一次取样移动最多 6.48 cm。

**两轮正式对照。** 原版先建／插桩版先建，每变体每轮预热 96 帧，正式 24 窗 × 24 帧。全部 **48/48 窗**的求解器阶段均以迭代为首。每次原生步进均值分别 **1.167／1.178 ms**，其中约束求解 **0.570／0.566 ms**，迭代 **0.324／0.321 ms**，准备 **0.181／0.180 ms**；准备中的关节转换 **0.137／0.138 ms**、接触转换 **0.018／0.019 ms**。阶段嵌套，不累加。每轮含 480 次单子步和 96 次零子步，960 个求解批次，分账差 0 ns；28 个相同动作时刻的 226,240 个骨矩阵标量、1,456 个形态权重、1,792 个蒙皮顶点和完整接触列表逐值一致。插桩使外层调用的配对窗中位差分别为 +0.053／+0.003 ms。

**复现（项目根目录，Node 26.12.1）。** 沿用上面的实验依赖。前两条是边界与实模短验；后两条须等桌面空闲、父会话无基准时逐条运行，每轮新进程，恢复原 96 帧预热、24 对 × 24 帧。把 stdout 分别存为本机 JSON 即可比较：`solver.phaseMs` 是四个同级阶段，`solver.exclusiveMs` 是八个互斥明细，`rows[1].blocks[*].solver` 是每窗原值；另看 `medianPairedAbiDeltaMs` 和两层 `partitionErrorNs`。

```sh
node experiments/bullet-step-profile/boundaries.mjs --solver
node experiments/bullet-step-profile/playback.mjs "<actor.pmx>" "<body.vmd>" --solver --smoke
node experiments/bullet-step-profile/playback.mjs "<actor.pmx>" "<body.vmd>" --solver
node experiments/bullet-step-profile/playback.mjs "<actor.pmx>" "<body.vmd>" --solver --reverse
```

## 主迭代行循环

同一获准 PMX／身体 VMD、随包 `0.8.6` WASM、固定步长与停放槽位。每轮独立 Node 进程、两套世界，各预热 96 帧、正式 24 对 × 24 帧，逐窗交替先后。正／反指**构建世界及首窗的顺序**，两轮都正向播放同一动作。下列新测量只拆 `iterationsExceptSplit`，不含建行、split impulse、写回和窄相。

| 每次 `stepSimulation` 的均值，ms（含零子步） | 原版先建 | 诊断版先建 | 每轮非空整遍数 |
|---|---:|---:|---:|
| 关节行（含逐行 override 次数判断、generic 求解与残差） | **0.31419** | **0.32455** | 9,600 |
| 旧式关节回调遍历（enabled、取 solver body、`solveConstraintObsolete`） | 0.05081 | 0.05097 | 9,600 |
| 接触法向行（lower-limit 求解） | 0.03325 | 0.03303 | 9,550 |
| 切向摩擦行（含按法向冲量判断、限幅与 generic 求解） | 0.03049 | 0.02694 | 9,550 |
| 接触与摩擦交错循环；滚动摩擦循环 | 0 | 0 | 各 0 |
| 其余控制（含空池判断、调度、停止判断及探针开销） | 0.02139 | 0.02102 | — |
| **非 split 迭代合计** | **0.45013** | **0.45651** | **9,600 次 `solveSingleIteration`** |

**结论。** 关节行不含旧式回调，仍占非 split 迭代 **69.8%／71.1%**。分开的接触与摩擦行合计 **0.06374／0.05997 ms**；逐窗比较，**24/24 + 24/24** 都低于关节行。表中计数是执行了几遍非空循环，不是行数或有效冲量数；0 表示这一段动作没有进入该非空循环。旧式遍历的时间也不证明虚调用本身做了多少工作。

**边界。** [`--rows` 探针](../../experiments/bullet-step-profile/row-loops.mjs)在上面固定源码对应的 `solveSingleIteration` 中核对池、排序表、间接求解槽和循环回边。每个分支通过非空条件后，在行索引归零之前开始、最后一次回边退出之后结束；空池、排序打乱及迭代次数判断归控制。`generic` 槽偏移 212 由多个池共用，法向 `lower-limit` 为 216，不能靠函数入口归因。交错模式在同一行循环内先解法向再解摩擦，只允许合计；未为了拆时间改模式。滚动摩擦有独立遍历。单次迭代的入口／退出用于验序；不在循环体内跨 WASM 打点。

**时序与输出。** 每轮两个世界的 **576 对**正式 C 入口参数按调用顺序相同（`dt=1/72`、`maxSubSteps=5`、`fixed=1/60`），没有 seed 调用。诊断世界直接计到 96 次零子步、480 次单子步、960 个求解批次。每次校验 split、主迭代、可选循环及其分支的嵌套和退出；空世界另验 0／1／限幅 2 子步且无非空行循环。行循环子账对非 split 父账、求解器子账对 `solveConstraints`、世界分段对原生首尾差，正式两轮均 **0 ns**。每轮在包括预热的 28 个同动作时刻，与未插桩世界逐值比对 **226,240 个骨矩阵标量、1,456 个表情权重、1,792 个蒙皮点**和 28 份完整接触列表（最多 292 点）；右腕移动 5.06 cm。这是窗口端点采样，不是每一行的冲量对照。

**环境与限制。** 11 月 25 日 UTC 06:25:58–06:26:03／06:26:05–06:26:10，Windows x64 10.0.26300、i9-13900HX（32 逻辑线程）、Node 26.12.1，纯 CPU。两轮依序跑在同一台允许并行工作的主机上；正式段全机繁忙比例约 **12.6%／16.8%**（含自身，非本进程利用率）。原版→诊断版外层 `world_step` 均值分别 1.716→1.765、1.809→1.785 ms，逐窗配对差中位 +0.041／+0.008 ms。整循环也有打点扰动；这里不做跨轮墙钟加速、Quest FPS 或其他角色的推断。

**复现。** `--rows` 包含 `--solver`；无需生成或替换任何 WASM 文件。正式 stdout 原件在本机 `local-review/verification/bullet-solver-rows/{forward,reverse}.json`。`solver.rowLoops` 和 `rows[1].blocks[*].solver.rowLoops` 是全轮／逐窗的互斥均值、非空遍数和未舍入分账误差，`stepInputs` 与 `environment` 记录输入时序与环境。

```sh
node experiments/bullet-step-profile/boundaries.mjs --rows
node experiments/bullet-step-profile/playback.mjs "<actor.pmx>" "<body.vmd>" --rows --smoke
node experiments/bullet-step-profile/playback.mjs "<actor.pmx>" "<body.vmd>" --rows
node experiments/bullet-step-profile/playback.mjs "<actor.pmx>" "<body.vmd>" --rows --reverse
```

## 实际关节行

同一 505 骨原衣 PMX、605 个作者关节、停放的 22 个辅助体。每列另起 Node 进程，用两套世界作原版／诊断版对照。站立不绑动作；保持捧腿从同一站姿通过运行时 `beginPose` 应用 `thighCradle` 并重新播种；二者保持姿态时钟在 0，物理继续按 1/72 秒推进。播舞沿用同一真实身体 VMD。**这是每次预热 12 帧、正式 4 对 × 6 帧的 CPU 短验**，含 4 次零子步、20 次单子步；不是前文的 48 个长窗，也不代表泳池玩家当时采用了捧腿预设。

| `--joint-counts` 实际计数 | 普通站立 | 保持捧腿 | 播舞 |
|---|---:|---:|---:|
| 40 批中每批遍数 | 10 | 10 | 10 |
| 单遍执行行数（小批／大批范围） | 31–35／1,778–1,840 | 82–84／1,877–2,088 | 32–38／1,748–1,831 |
| 总访问＝实际完成 generic 求解 | 370,860 | 420,540 | 368,620 |
| 正显式 override 的行访问／被判断跳过 | 0／0 | 0／0 | 0／0 |
| 线性：仅马达／双向锁定 | 11,190／242,550 | 10,780／243,000 | 10,650／243,000 |
| 线性：限位状态 1／2 | 17,660／8,900 | 16,250／26,860 | 15,340／8,880 |
| 角向：仅马达／双向锁定 | 15,600／65,800 | 15,600／65,770 | 15,600／65,790 |
| 角向：限位状态 1／2 | 6,290／2,870 | 24,520／17,760 | 6,660／2,700 |

**怎样数。** [计数器](../../experiments/bullet-step-profile/joint-counts.mjs)在[6DOF 真正写出一行](https://github.com/yohawing/mmd-anim/blob/f4f68d7519d7c15f2bfc77f094410e57e94ea7aa/crates/mmd-anim-physics-bullet/vendor/bullet3/src/BulletDynamics/ConstraintSolver/btGeneric6DofConstraint.cpp#L690-L710)时读取 `rotational`、当前限位状态及上下限是否相等。仅马达指马达启用且无活动限位；有活动限位则按双向锁定、状态 1（正向冲量）、状态 2（负向冲量）分类，不能据此断言马达未启用。分类是**这一子步产生的行**，不是 PMX 关节枚举、关节名称或非零冲量数。按本关节起始行＋写入序号贴标签，验证每批顺序连续、无缺行且与池长相符。每遍通过实际排序表取回标签，访问在 guard 前数，执行在 generic 虚调用返回后数，跳过在 guard 的另一支数。显式 override 来自原关节的正整数设置；未显式设置的行也要比较继承的迭代上限。

标签、计数均在独立 WASM 内存，逐窗整批读回；每遍核对 `访问 = 池长 = 已执行 + 跳过`、八种行合计及旧探针的非空遍数。空世界验零行；另有两个人造 6DOF 关节，一组继承 10 遍、一组显式增加到 12 遍，实跑最后两遍均为访问 12、执行 6、跳过 6。这个反例表明不能把实模的 100% 通过率写成全局规则。

### 建行与填行成本

`--joint-costs` 单独运行，不贴行标签。下表是 `convertJoints` 内两个**完整非空循环**和剩余部分，单位 ms / `stepSimulation`，含零子步和探针开销。`getInfo1` 遍含清反馈、enabled 判断、累加返回行数；填行遍含按需取 solver body、`convertJoint` 的清行、`getInfo2` 虚调用和行末整理。剩余含 `buildJacobian` 遍及临时池管理。

| 同一口径 | 普通站立 | 保持捧腿 | 播舞 |
|---|---:|---:|---:|
| `getInfo1` 整遍 | 0.06867 | 0.12129 | 0.06369 |
| 填行整遍（含 `getInfo2`） | 0.12901 | 0.14501 | 0.06306 |
| 其余 | 0.01463 | 0.04250 | 0.01821 |
| **`convertJoints` 总计** | **0.21231** | **0.30880** | **0.14496** |
| `getInfo1` 调用夹时／相邻空夹（ns/样本） | 189／47 | 316／65 | 177／48 |
| `getInfo2` 调用夹时／相邻空夹（ns/样本） | 170／3,077 | 304／70 | 147／46 |

每趟两种虚调用各实际发生 **12,100 次**，各抽到 377 次。在[固定源码两处虚调用](https://github.com/yohawing/mmd-anim/blob/f4f68d7519d7c15f2bfc77f094410e57e94ea7aa/crates/mmd-anim-physics-bullet/vendor/bullet3/src/BulletDynamics/ConstraintSolver/btSequentialImpulseConstraintSolver.cpp#L1294-L1355)对应的位置，[计时器](../../experiments/bullet-step-profile/joint-costs.mjs)按连续调用序号散列、约每 32 次选 1 次，仅包围实际间接调用，不重复执行；同一采样紧接着取一对空时钟。均值保留原值，不扣空夹，不把最后两行乘以调用数再加到整遍。站立 `getInfo2` 的 377 个空夹合计 1.160 ms，明显受停顿污染；保持捧腿这次正式计时段全机繁忙比例约 53%。**短验能分清工作边界，不能给几个百纳秒的虚调用排稳定名次。**

**同输入、同输出。** 六趟各自在正式段逐次比对 24 对 C 步进参数和 1,152 对写入刚体的索引、位置与四元数（7 个 float32 的比特和 step 边界），没有 seed-only 步混入。含预热的 6 个窗口端点，各趟 48,480 个骨矩阵标量、312 个表情权重、384 个蒙皮顶点、6 份完整接触列表逐值相同；站立／捧腿／播舞最多 333／342／330 点。不绘制，不把 CPU 裙面显示时间计作 Bullet 建行，也未测暂停拨衣的触感。

**复现与下一步。** 先用文首的 `npm ci` 安装实验依赖。Node 26.12.1，项目根目录；占用 CPU 的回放按趟串行，每条输出独立 JSON。以下为一趟舞蹈的短验；同命令加 `--stand` 或 `--held` 分别测另外两种姿态，后二者不读 VMD，可将第二个参数写成 `-`。原件：本机 `local-review/verification/bullet-joints/{stand,held,dance}-{counts,costs}-smoke.json`。

```sh
node experiments/bullet-step-profile/boundaries.mjs --joint-counts
node experiments/bullet-step-profile/boundaries.mjs --joint-costs
node experiments/bullet-step-profile/playback.mjs "<actor.pmx>" "<body.vmd>" --joint-counts --smoke
node experiments/bullet-step-profile/playback.mjs "<actor.pmx>" "<body.vmd>" --joint-costs --smoke
```

排期正式轮时，沿用上轮本机 `local-review/verification/bullet-solver/inputs.json` 的 `pmx`、`vmd`。去掉 `--smoke` 即各预热 96 帧、正式 24 对 × 24 帧；再加 `--reverse` 另起进程反转构建和首窗顺序。`rows[1].blocks[i].solver.jointPasses` 中依次取 `patterns[passIds[j]]` 即还原该窗第 j 遍，字段在 `solver.jointPasses.patternFields`；`solver.jointCosts` 保留两个整遍和抽样原始 ns，逐窗同名字段可定位尖峰。

**不改求解策略。** 播舞约 84% 的实际行是双向锁定，保持捧腿降到约 73%；锁定描述的是作者约束，而非无用工作。没有证据支持缓存活动行、删除 override 判断或给捧腿少算几遍。窄相与裙面显示仍各自独立。

### 同目标直调：离线 A/B 不采用

`--joint-target --smoke` 在播舞的实际关节调用点取目标，原间接调用照常执行。正式段 **368,620 次全是槽 407**，与行计数器的执行数吻合。固定产物中该槽对应 `$f312`，接受三个 `i32`、返回 `f32`；表在模块内定义，不导出，只有一个初始化段，没有运行期改表指令。

[候选](../../experiments/bullet-step-profile/joint-direct.mjs)只改 `solveSingleIteration` 非接触行循环的一处调用：保留原来的参数入栈和一次槽号读取；等于 407 才直接 `call $f312`，否则把刚读的索引交给原 `call_indirect`。不假定下一行的目标与上一行相同。顺序表、override 判断、被调用函数本体和后续浮点残差运算沿用原指令，接触／摩擦路径不参与改写。`node experiments/bullet-step-profile/joint-direct.mjs` 用同一段分支验证了不同有效目标的三参数与返回值，以及类型不符、空槽、越界仍然 trap。

**短验只证等价。** 两种建模顺序各 4 对 × 6 帧：同一原衣 PMX 和 VMD，各 24 对步进参数、1,152 对刚体位置／旋转写入、48,480 个骨矩阵标量、312 个形态权重、384 个蒙皮点及 6 份完整接触记录逐值相同。两趟 `world_step` 均只有 **2/4** 个配对窗候选较快。没有正式提速结论。本机原件：`local-review/verification/bullet-direct/{target-smoke,direct-smoke,reverse-smoke}.json`。

**正式轮结论：不采用。** 原衣舞蹈的单独计数轮实际执行 **8,987,930 行／9,600 遍**，无 override 跳过；独立成本轮 `getInfo1` 整遍、填行整遍分别为 **0.059 / 0.064 ms/步**。这两轮有计数／计时，不能和直调候选跨轮比快慢。用不带打点的两版进行正反顺序 A/B：`world_step` 配对差中位 **−0.0008 / +0.01565 ms**，整次演员更新 **+0.03306 / +0.06552 ms**（正数更慢），分别只在 **8/24、7/24** 个整模窗胜出。同输入，含预热的 226,240 个骨矩阵标量、1,792 个蒙皮点及 28 份接触记录一致。不动线上 WASM，不降低关节精度。四份完整结果在 `local-review/verification/bullet-joints/dance-joint-{counts,costs}-full.json`、`local-review/verification/bullet-direct/{forward,reverse}.json`。

**复现命令。** 以下是两个独立进程；在项目根目录用 PowerShell 7 串行运行。两版 WASM 都无性能打点、目标计数或行标签；候选只在内存生成。每版预热 96 帧，正式 24 对 × 24 帧。两侧保留相同 JS 边界计时和预分配的刚体输入记录，逐窗离开计时后校验。`--reverse` 只反转建模和首窗顺序。

```powershell
$p = Get-Content -Raw -Encoding utf8 local-review/verification/bullet-solver/inputs.json | ConvertFrom-Json
$out = 'local-review/verification/bullet-direct'
New-Item -Force -ItemType Directory $out | Out-Null
node experiments/bullet-step-profile/playback.mjs $p.pmx $p.vmd --joint-direct > "$out/forward.json"
if ($LASTEXITCODE -ne 0) { throw 'Forward A/B failed' }
node experiments/bullet-step-profile/playback.mjs $p.pmx $p.vmd --joint-direct --reverse > "$out/reverse.json"
if ($LASTEXITCODE -ne 0) { throw 'Reverse A/B failed' }
```

两份分别看 `jointDispatch.pairedAbi`（JS 包围的 `world_step`）、`pairedFrame`（整次 `rt.update`，CPU 无绘制）及各窗原值；`medianDeltaMs` 为候选减原版，`wins` 为候选更快的窗数。若反转后收益消失、整模没有可重复改善或出现输入／输出反例，就到此为止；两轮都改善才值得另验暂停拨衣及回落。
