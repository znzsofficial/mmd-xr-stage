# 维护审查：下次重构从哪里开始

审查基线 `b69584a`。五项均已实施，下面保留原问题、修改入口和验收证据。文件、观看会话、活动房间的职责见[舞台架构](./architecture.md)。

## 1. 续场保存已生效的物理开关

原问题：[`mmdVrStore.ts`](../src/mmdVrShowcase/mmdVrStore.ts) 的 `setPhysicsEnabled` 先发布用户请求。旧 `saveRoom` 用这个值生成重建前快照；若恰在重建时退出，`closeOverlay` 会回退到包含未生效开关的布局。

旧版复现：用 [`MmdVrStage.test.tsx`](../src/mmdVrShowcase/stage/MmdVrStage.test.tsx) 的 `setupBag` 放一个角色，初始快照为 `false`。令 runtime 的 `setPhysicsEnabled` 返回未决 Promise，开启后确认 `physicsBusy === true`，此时正常 `closeOverlay`。角色文件仍在，`savedStage.physicsEnabled` 却是 `true`，预期为最后生效的 `false`。

**已修复。** [`StageRoom`](../src/mmdVrShowcase/stage/StageRoom.tsx) 只保存最后成功应用的物理状态。双向切换、中途退出、成功、回滚失败与过期重建均有用例；Edge 使用真实 Bullet，在关闭重建中退出后仍保留已开启的状态及角色、GLB。

## 2. 统一已上场物件的移动执行路径

原问题：旧 `placeMode` 平面、队列与背包入口对同一地台落点 `(7, 0)` 有相反判断。仓内应用与 SDK 均无旧接口调用契约。

**已移除旧路径。** 角色与 GLB 都由 [`BackpackPlacement`](../src/mmdVrShowcase/backpack/BackpackPlacement.tsx) 拾取、校验，背包按代次提交。屏幕鼠标和模拟 Quest 扳机实测：按住不移动，松开保留实例 ID 和朝向；拒绝泳池水面、秦淮隔墙，允许从 2.72 米楼廊移到 0.42 米戏台。

## 3. 让泳池布局统一提供岸道和水面的尺寸

**已实施。** 泳池、行走与摆放改为读取 [`LidoLayout.ts`](../src/mmdVrShowcase/scenery/LidoLayout.ts) 的 `POOL_SUPPORT` 和 `POOL.water`。脚下支撑、玩家身体碰撞、摆放的边缘余量仍分别判断。屏幕鼠标和模拟 XR 扳机均在远端计时台实放成功，水面拒放；六向门线、东岸与回程见[路线验收](./scenery/campus-garden-routes.md)。

## 4. 复用高级 HUD 的资产编辑控件

**已实施。** 角色与物件详情共用 [`AssetEditPanel`](../src/mmdVrShowcase/hud/AssetPanels.tsx)，保留两种行高与角色专属材质入口。显隐、缩放、旋转、复位和移除作用于当前 `runtimeId`；移动作用于背包 `assetId`。[HUD 回归](../src/mmdVrShowcase/backpack/BackpackHud.test.tsx)覆盖两类对象、忙时锁定、松开后紧随 click 只执行一次。

## 5. 给重绑前的姿态清理顺序一个入口

**已实施。** [`mmdRuntime.ts`](../src/mmdVrShowcase/mmdRuntime/mmdRuntime.ts) 的 `clearPoseForRebind` 在替换求值器、换动作、显式物理重置前按同一顺序还原形变，普通帧仍保留自己的显示历史。[动作重绑失败用例](../src/mmdVrShowcase/mmdRuntime/mmdRuntimeLifecycle.test.ts)检查回滚采用原始求解姿态。[真实 Bullet 暂停拨衣探针](../scripts/paused-cloth-smoke.html)测得 30 次接触、衣摆顶点抬升 13.72 厘米、腕骨矩阵漂移为 0；重置与同时间 seek、循环首帧与初始帧的腕骨和采样衣摆顶点一致。这些是桌面回归，不是头显性能结论。
