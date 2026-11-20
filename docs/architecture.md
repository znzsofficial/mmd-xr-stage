# 舞台代码从哪里改

屏幕观看与 VR 共用一个舞台入口。读代码时，先区分三种寿命：**页面持有文件与布局，一次观看持有可复用的解码数据，当前房间持有可渲染实例和物理世界。** 切房间只替换最后一层；刷新页面才会清掉背包。

## 沿一次放置走读

1. [准备页](../src/mmdVrShowcase/MmdVrPrepApp.tsx)把本地文件交给[背包](../src/mmdVrShowcase/backpack.ts)。此时只有目录条目，角色尚未加载，也不占上场名额。
2. [屏幕](../src/mmdVrShowcase/screen/ScreenStage.tsx)或 [XR 场景](../src/mmdVrShowcase/MmdVrScene.tsx)挂载同一个 [MmdVrStageContent](../src/mmdVrShowcase/components/MmdVrStage.tsx)。它管理本次观看的动作／透明度采样缓存，按布景和切换代次挂载一个 [StageRoom](../src/mmdVrShowcase/stage/StageRoom.tsx)。即使 A → B → A 被合成一次 React 渲染，第一次 A 的异步加载也不能提交到第二次 A。
3. [放置射线](../src/mmdVrShowcase/components/BackpackPlacement.tsx)检查真实地面和遮挡，背包确认后发出带 token 的命令。房间检查命令有效性，通过 [stageActors](../src/mmdVrShowcase/stageActors.ts) 加载或移动实例，成功后才发布上场状态。
4. 离场时由房间判断快照是否完整。背包的 `saveBackpackLayout` 一次写入本景布局、按文件身份匹配的摆放记录及动作绑定；切景后重建实例。布局不是一组隐藏的 Three.js 网格，也不保存 Bullet 世界。

## 按改动找入口

| 要改什么 | 负责的模块 |
|---|---|
| 默认设置、合法值、v1/v2 偏好兼容 | [`settings/preferences.ts`](../src/mmdVrShowcase/settings/preferences.ts)。首次进入、读取旧记录和场内更新共用同一套规则；[`mmdVrStore.ts`](../src/mmdVrShowcase/mmdVrStore.ts) 发布状态和操作。文件、布局和运行时句柄不属于偏好。 |
| 某一间房的模型、入口、机位、遮挡 | [`scenery/`](../src/mmdVrShowcase/scenery/)；按[布景接入指南](./scenery/adding-a-set.md)改注册表和本景布局。菜单切景是否重置视角由 `catalog.ts` 决定；步行跨门由 `connections.ts` 的平移数据决定。 |
| 多景共用的天空、灯、网格和地台 | [`stage/StageEnvironment.tsx`](../src/mmdVrShowcase/stage/StageEnvironment.tsx) 只按当前房间的配置和画质绘制布景。新放置与移动已有资产都由 [`BackpackPlacement.tsx`](../src/mmdVrShowcase/components/BackpackPlacement.tsx) 拾取和校验：按下预览，松开有效落点才提交。 |
| 共用灯光预设或布景的灯光覆盖值 | 六套预设在 [`stage/lighting.ts`](../src/mmdVrShowcase/stage/lighting.ts)，单景覆盖值在 [`scenery/roomSets.tsx`](../src/mmdVrShowcase/scenery/roomSets.tsx)。房间求值一次，让布景与 MMD 角色共用同一个主光源。 |
| 创建角色运行时、连接手追／手柄碰撞或 GPU 预热 | [`stage/createRoomRuntime.ts`](../src/mmdVrShowcase/stage/createRoomRuntime.ts) 组装依赖；MMD/Bullet 实现在 [`mmdRuntime/`](../src/mmdVrShowcase/mmdRuntime/)。句柄在房间的 layout effect 提交，加载、换物理与逐帧更新归房间。 |
| XR 会话创建、绑定和首帧 | [`src/xr/`](../src/xr/) 与[会话生命周期](./xr-session-lifecycle.md)。普通屏幕不申请 XR 会话。 |
| 玩家行走、跳跃、碰头或穿模飞行 | [`movement/`](../src/mmdVrShowcase/movement/)：`roomGround.ts` 管玩家通行范围和入口，`solidColumns.ts` 查附近实际几何，`groundMotor.ts` 管普通模式运动，`usePlayerMovement.ts` 接 XR 姿态、输入和切景。它们不借用角色 Bullet 世界，也不改变背包放置规则。[操作](./gameplay/vr-controls.md#普通与自由移动) |

**改完怎样验：** 偏好迁移看 `settings/preferences.test.ts`；放置、迟到加载、StrictMode、物理切换与回场看 `components/MmdVrStage.test.tsx`。改公共渲染时，另用生产构建进屏幕和模拟 XR，固定灯光、机位比较实际画面。关物理时的 VMD 时间与暂停时仍可推进的 XR 物理时间，见[性能文档](./performance/README.md)。
