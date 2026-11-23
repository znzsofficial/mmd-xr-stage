# 扩展与重构判断

审查基线：`ef638f8`。**可以继续加布景、随身玩具和单演员姿势，无需先重写舞台。** 近期的六种体位、三件玩具和三裙型修正已经走过这些入口，在屏幕和模拟 XR 验过。判断是否要拆代码，看新功能是否要接管另一模块的状态或每帧执行顺序，而不只看文件有多长。

## 直接扩展，还是先改结构？

| 下一次想做什么 | 现有入口 | 何时要重新设计 |
|---|---|---|
| 加一把绘景枪、一个花火道具 | [道具目录](../../src/mmdVrShowcase/play/propCatalog.ts)登记握点、外观与动作；[屏幕腕持](../../src/mmdVrShowcase/play/screenWristCue.tsx)和 XR 手柄从真实出口驱动同一个效果。 | 若要两件道具同时持有、各自切换或收回，先改持有人与输入归属；不要再加一个全局「当前道具」。 |
| 加一个体位或一种衣物修正 | [体位数据](../../src/mmdVrShowcase/pose/presetShapes.ts)描述方向和支撑；拟合器按演员骨长落地。[裙片修正](../../src/mmdVrShowcase/mmdRuntime/poseSkirtClearance.ts)是可撤回的显示层。 | 双人联动需要两位演员共同的定位、取消与恢复规则。手动定格的防穿也不能直接推广到舞蹈每帧。 |
| 加一颗星、一个可走区域 | [布景接入](../scenery/adding-a-set.md)负责身份、通行、摆放和机位；[重力查询](./gravity.md)可供新物体按位置采样。 | 新玩法若要接管玩家脚位，先明确它怎样进入、中断、落地并交回控制。普通道具不应修改头显原点。 |

## 最值得整理的三个位置

以下行数为该版本物理行数，只用于定位。建议在下一次改到相应职责时小步拆，不把这三项当成待执行的功能任务。

1. **角色运行时优先。** [`mmdRuntime.ts`](../../src/mmdVrShowcase/mmdRuntime/mmdRuntime.ts)（1,240 行）同时做角色装载、物理重建、每帧求值与姿势还原。下次加入一种身体或衣物显示层时，先收拢“求值前还原、求值后呈现、重绑时清空”的调用。普通帧与切换时机不同，要保留明确的调用顺序。验收看[运行时重建／失败回滚](../../src/mmdVrShowcase/mmdRuntime/mmdRuntimeLifecycle.test.ts)、暂停拨衣、恢复原动作和顶点还原；不要把一次拆文件算成性能提升。
2. **房间仍应只有一个帧调度者。** [`StageRoom.tsx`](../../src/mmdVrShowcase/stage/StageRoom.tsx)（780 行）既处理房间快照，也在帧内消费移除、显隐、变换等命令。下一次增加同类命令，可先把这一组执行逻辑提成房间自己的函数；过期房间检查仍在消费命令之前，保存快照仍在释放之前。用[切房、退出和过期帧用例](../../src/mmdVrShowcase/components/MmdVrStage.test.tsx)验证。
3. **HUD 可先按页面拆。** [`MmdVrHud.tsx`](../../src/mmdVrShowcase/components/MmdVrHud.tsx)（908 行）里已有独立的 `MaterialPanel` 和 `LoadRecoveryPanel`。下次扩这些页面时可以原样移出；B 键召回、拖动和按键释放仍由共同面板管理。用[导航](../../src/mmdVrShowcase/components/MmdVrHudNavigation.test.tsx)和[背包](../../src/mmdVrShowcase/components/BackpackHud.test.tsx)回归，再实点一次开页／返回。

## 清理与验证预算

- `dist/` 和 Vite 依赖缓存可以重建。发布时 `dist/` 是已验收制品，要留到主域名哈希核对完。旧标签页还会请求历史分块，[兼容清单](../../scripts/retain-legacy-scene.mjs)及 [loader 补丁](../three-mmd-loader-maintenance.md)都有运行时用途，不能按文件年龄清理。
- `sample/` 是私有输入；`local-review/` 是实模前后图、原始数据和复现工具，不是构建缓存。两者均已被 Git 忽略，清理工程不应一并删除。
- 本地可以并行编辑；浏览器／WebGL／IWER 一次一个，关闭后再跑全套或构建。桌面用于验证可见效果、时序与还原；Quest 的帧率、双眼可读性和舒适度看[实戴短测](../performance/next-quest-export.md)。
