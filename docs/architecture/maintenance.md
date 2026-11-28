# 扩展与重构判断

审查基线：`ef638f8`。**可以继续加布景、随身玩具和单演员姿势，无需先重写舞台。** 近期的六种体位、三件玩具和三裙型修正已经走过这些入口，在屏幕和模拟 XR 验过。判断是否要拆代码，看新功能是否要接管另一模块的状态或每帧执行顺序，而不只看文件有多长。

## 直接扩展，还是先改结构？

| 下一次想做什么 | 现有入口 | 何时要重新设计 |
|---|---|---|
| 加一把绘景枪、一个花火道具 | [道具目录](../../src/mmdVrShowcase/play/propCatalog.ts)登记握点、外观与动作；[屏幕腕持](../../src/mmdVrShowcase/play/screenWristCue.tsx)和 XR 手柄从真实出口驱动同一个效果。 | 若要两件道具同时持有、各自切换或收回，先改持有人与输入归属；不要再加一个全局「当前道具」。 |
| 加一个体位或一种衣物修正 | [体位数据](../../src/mmdVrShowcase/pose/presetShapes.ts)描述方向和支撑；拟合器按演员骨长落地。[裙片修正](../../src/mmdVrShowcase/mmdRuntime/poseSkirtClearance.ts)是可撤回的显示层。 | 双人联动需要两位演员共同的定位、取消与恢复规则。手动定格的防穿也不能直接推广到舞蹈每帧。 |
| 加一颗星、一个可走区域 | [布景接入](../scenery/adding-a-set.md)负责身份、通行、摆放和机位；[重力查询](./gravity.md)可供新物体按位置采样。 | 新玩法若要接管玩家脚位，先明确它怎样进入、中断、落地并交回控制。普通道具不应修改头显原点。 |

## 已拆出的三个入口

`76ef87c` 之后已完成第一次局部整理。以后按职责扩展；本轮不以行数或帧率变化作为验收目标。

1. **演员显示与还原。** 新衣物或身体显示效果从 [`actorPoseDisplay.ts`](../../src/mmdVrShowcase/mmdRuntime/actorPoseDisplay.ts) 接入。这里明确区分普通帧还原、重绑清空、隐藏、移除和成功求值后的呈现。[运行时](../../src/mmdVrShowcase/mmdRuntime/mmdRuntime.ts)仍拥有 VMD／Bullet 时钟、单位缩放下的物理求值、失败回滚和材质还原。新增一层时同时查进入与退出，特别是暂停拨衣、重置和恢复原动作。[失败与重建回归](../../src/mmdVrShowcase/mmdRuntime/mmdRuntimeLifecycle.test.ts)
2. **房间命令。** [`StageRoom.tsx`](../../src/mmdVrShowcase/stage/StageRoom.tsx) 仍是唯一帧调度者，检查过期代次和物理重建状态之后，才交给 [`roomModelCommands.ts`](../../src/mmdVrShowcase/stage/roomModelCommands.ts) 执行移除、显隐、变换。各队列执行后立即发布，再取下一组。房间负责物理重置及离场快照；异步放置和回场不是这一组命令。[过期帧、切景与退出](../../src/mmdVrShowcase/stage/MmdVrStage.test.tsx)
3. **XR 公共面板。** 资产详情、材质列表和参数在 [`AssetPanels.tsx`](../../src/mmdVrShowcase/hud/AssetPanels.tsx)，贴图失败的详情、继续和重试在 [`LoadRecoveryPanel.tsx`](../../src/mmdVrShowcase/hud/LoadRecoveryPanel.tsx)。[`MmdVrHud.tsx`](../../src/mmdVrShowcase/hud/MmdVrHud.tsx) 仍决定显示哪一页，拥有 B 键召回和公共拖动状态。[导航](../../src/mmdVrShowcase/hud/MmdVrHudNavigation.test.tsx) · [背包与错误优先级](../../src/mmdVrShowcase/backpack/BackpackHud.test.tsx)

**实际验收。** 重构前后用同一套模拟 XR 扳机操作：材质详情显隐并返回、右转 15°、复位、整人显隐、移除、B 键召回；并用损坏贴图的可解析 PMX 走「继续观看 → 加载详情 → 继续观看」，角色仍在。另用本机穿裙 PMX 实点抬腿、跪撑和恢复原动作，退出后修正顶点归零。[暂停拨衣探针](../../scripts/paused-cloth-smoke.html)用实际 Bullet 检查暂停拨衣、跳播、重置与循环：暂停拨衣时腕矩阵无偏移，回到起点时腕和衣摆回到基准。以上不是实戴性能测试。

## 移除演员后恢复哪份布局

背包「收回」按命令 token 执行，XR 资产详情「移除」在当前房间的渲染帧执行。两者成功后都调用 `commitActorLayout()`：先更新未解决的加载告警，再保存完整布局。旧版详情页只更新在场名单，此时立即重建渲染器会把移走的演员带回来。[双演员回归](../../src/mmdVrShowcase/stage/MmdVrStage.test.tsx)分别走两个入口，核对剩余演员的位置和动作文件，并确认旧帧不能取走新房间的命令。若其他演员仍有修复告警，保留上一次完整布局。

## 清理与验证预算

**旧标签页：已改用制品生成清单。** 过去漏过 `emulate`、浏览器适配和星球物理的间接依赖。现在由[发布工具](../deployment.md#从上一版制品生成旧标签页清单)从上一版完整收据和制品登记固定部署、原路径和 SHA-256，两个资源目录各自验哈希、拒绝覆盖。历史 309 条保留，`5972872` 自动新增 94 条；[跨发布实景验证](../../scripts/verify-old-tab.mjs)用已选好模型的旧页首次进入 WebGPU，实际放置并在星球上行走。

**WebGPU XR 拖动：已区分失追、失焦和仍可见的慢帧。** [宿主](../../scripts/webgpu-actor/stage-host.jsx)在不再推进房间的那一帧就通知[当前会话的输入订阅者](../../src/mmdVrShowcase/xr/floorInput.ts)。持有按压的袜面或姿势手柄撤销自己的操作；撕扯时若只丢一帧头姿，恢复后无需重新打开模式，但要重新按住才会产生破口。正常可见的长帧仍计入报告。[成品路径与双眼证据](../performance/actor-tools-regression.md#外置丝袜的裂口与覆盖)。[搭档面板](../../src/mmdVrShowcase/pelvic/store.ts)的离页／换演员／显式交接规则暂缓，等增加持有模式时再收口。

- `dist/` 和 Vite 依赖缓存可以重建。发布时 `dist/` 是已验收制品，要留到主域名哈希核对完。旧标签页还会请求历史分块，[兼容清单](../../scripts/retain-legacy-scene.mjs)及 [loader 补丁](../three-mmd-loader-maintenance.md)都有运行时用途，不能按文件年龄清理。
- `sample/` 是私有输入；`local-review/` 是实模前后图、原始数据和复现工具，不是构建缓存。两者均已被 Git 忽略，清理工程不应一并删除。
- 本地可以并行编辑；浏览器／WebGL／IWER 一次一个，关闭后再跑全套或构建。桌面用于验证可见效果、时序与还原；Quest 的帧率、双眼可读性和舒适度看[实戴短测](../performance/next-quest-export.md)。
