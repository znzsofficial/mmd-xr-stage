# 性能：下一轮先修什么

**等待新版 Quest 报告。** 11 月 20 日 14:43Z 的教室记录早于修复：回场 8.74 秒中有 6.26 秒等大动作，首开物理 949 ms 中有 893 ms 等 Bullet。最近大动作缓存和放置后模块预热均已上线。下一步按[教室短测](./next-quest-export.md)验证命中、首开和稳态；[原报告条件](./viewing-and-diagnostics.md#已有测量)。

## 首次开物理

旧礼拜堂首次开物理耗时 **12.631 秒**，没有分段；同场首次从背包放下角色则是 **5.521 秒**（其中 `init-core` 3.183 秒）。`1abb982` 的教室记录能把这两种操作分开，且同一会话第二次开物理只需 134 ms。

**桌面刻意不派发 idle 回调**，同一 PMX／15.45 MiB VMD 的首开墙钟为 174.6 ms（按需）和 21.6 ms（放置后一秒定时任务已预热）。首开前两页都没有运行角色物理。头显上要核对放置后有无新顿挫，而不只看开关数字。[预热与回场诊断](./physics-warm-start.md) · [本地复核探针](../../scripts/physics-toggle-probe.html)

用 `physicsRebuilds[].work` 判断改动落在哪一段：

| 哪一段长 | 含义与下一步 |
|---|---|
| `waitForSlotMs` | 切换在串行队列中等候；先查前一次任务和触发顺序。 |
| `bulletModuleMs` | 等动态模块及 Bullet JS/WASM 就绪。若首次仍慢，查 `moduleAtFirstRequest` 判断没启动、正在预热还是已就绪；同时核对空场首帧及首次放置。 |
| `createBackendMs`、`evaluatorMs`、`bindAndSwapMs` | 分别查建后端、建求值器、还原绑定姿态／绑动作／换求值器。只优化占主导的阶段，验证动作不跳、缩放正确、失败可回滚。 |
| `publishUiMs` 或其余墙钟 | 查模型／材质列表刷新和未覆盖的等待。关闭时另有 `readModelMs`，失败可能有 `rollbackMs`。不要把未解释部分归给 Bullet。 |

子阶段按操作内的多个角色累加，**不再加到 `durationWallMs` 上**。首个原生播种帧可能在忙段结束之后；忙段、首个就绪帧和恢复稳定播放应分开看。

## 持续播放

11 月 20 日 14:43Z 教室阴影关，离开教室前的稳定播放窗物理关／开中位 **64／42 FPS**，开着回场后另计 45.5 FPS。旧礼拜堂阴影开为 61／34 FPS。这不是锁定条件的版本或阴影 A/B。缓存不改变求解器，预热不减少每帧步进；XR 回调间隔也不是 GPU 耗时。

本地候选用[配对播放探针](../../scripts/paired-playback-probe.html)比较总更新、原生步进、慢帧和轨迹。保留有效接触和 PMX 关节，复核骨矩阵、蒙皮轨迹、暂停拨衣首触、移开回落及追踪恢复。单项计时变短而总耗时无稳定改善，不作为帧率收益。[已做的等价优化和隔离实验](./xr-runtime-performance.md)

## 回场与后续验收

- **回教室**：按 14:43Z 的条件保留大动作和物理开关。先看 `motionWork[].cache` 与 `loadWallMs`，再看总恢复时间和仍需重建的模型任务（旧报告 1546 ms）。桌面回放命中后动作任务 3.3／2.9 ms，旧按需路径 1156.9／1342.0 ms。[同姿态与清空验证](./physics-warm-start.md) · [贴图阶段的单独对照](./load-work-room-alpha.md)
- **跨区**：新[校园电玩环线与秦淮河街](./new-street-validation.md)已在屏幕／模拟 XR 验证。真机看过门等待；同一布局多轮往返才判断资源是否持续增长。[早期校园基线](./campus-passage.md)
- **暂停休眠**尚未实现。先分别测衣摆静止、手靠近和实际触碰；首触不漏、收手回落、追踪恢复与 seek／循环通过，才试减少求解。地台、草坪各 15 分钟分别导出，不混入教室短测。

## 查记录或跑对照

[单角色 Three/Babylon 本机 A/B](../../experiments/mmd-engine-ab/README.md)：同一 PMX、动作和贴图，分别测开关物理的角色更新时间与静态姿态绘制；实验包与线上舞台隔离。

[玩家碰撞查询的桌面配对与报告导出预演](./player-collision-work.md)：普通行走的网格查询、站定时的角色物理和过门恢复分别取证。

[实模物理前骨架遍历对照](./pmx-root-propagation.md)：改成只更新根节点没有稳定的整模更新收益，本轮不采用。两处新景的[接地阴影合批和资源回访](../scenery/private-retreats.md)另有实测。

[Quest 报告字段和历次测量](./viewing-and-diagnostics.md) · [物理切换与姿态验证](./physics-toggle.md) · [模型加载对照](../../scripts/room-load-probe.html) · [真实 Bullet 暂停拨衣](../../scripts/paused-cloth-smoke.html)。开发探针只使用本地素材。
