# 维护审查：下次重构从哪里开始

基线 `b69584a`。这是一次只读审查；以下按优先级排序。文件、观看会话、活动房间的职责已经拆开，参见[舞台架构](./architecture.md)。

## 1. 续场保存已生效的物理开关

[`mmdVrStore.ts`](../src/mmdVrShowcase/mmdVrStore.ts) 的 `setPhysicsEnabled` 先发布用户请求。[`StageRoom.tsx`](../src/mmdVrShowcase/stage/StageRoom.tsx) 的 `saveRoom` 从 store 读取这个值；重建 effect 在异步调用前先 `captureStage()`，成功后才写 `appliedPhysicsEnabledRef`。若恰在重建时退出，`closeOverlay` 会回退到刚保存的布局。

**关→开已在房间集成探针复现。** 沿用 [`MmdVrStage.test.tsx`](../src/mmdVrShowcase/components/MmdVrStage.test.tsx) 的 `setupBag` 放一个角色，初始快照为 `false`。令 runtime 的 `setPhysicsEnabled` 返回未决 Promise，开启后确认 `physicsBusy === true`，此时正常 `closeOverlay`。角色文件仍在，`savedStage.physicsEnabled` 却是 `true`，预期为最后生效的 `false`。这是确定性时序复现，不是真机发生频率的测量。

建议让快照使用房间已应用值，保留即时开关反馈和原有重建流程。回归开→关和关→开：中途退出应保留旧值，成功后退出应保存新值，失败或过期房间不能覆盖最后的完整快照。

## 2. 统一已上场物件的移动执行路径

当前 HUD 的「移动」走 [`BackpackPlacement.tsx`](../src/mmdVrShowcase/components/BackpackPlacement.tsx)，松开扳机确认；[`StageEnvironment.tsx`](../src/mmdVrShowcase/stage/StageEnvironment.tsx) 和 `StageRoom` 仍支持旧 `placeMode` 平面、队列与执行分支。`mmdVrStore.test.ts` 的旧路径拒绝 `(7, 0)`，`placementAreas.test.ts` 的简易地台接受同一点。

先确定旧接口是否仍须兼容，再收束实际移动操作。保留 runtime ID 与背包 asset ID 的区别；用真实放置入口验证水面、隔墙、楼层、朝向、取消和切景中的迟到命令。

## 3. 让泳池布局统一提供岸道和水面的尺寸

[`roomGround.ts`](../src/mmdVrShowcase/movement/roomGround.ts) 和 [`placementAreas.ts`](../src/mmdVrShowcase/scenery/placementAreas.ts) 各自枚举同一组岸道、远端计时台和入口；[`PoolTerrace.tsx`](../src/mmdVrShowcase/scenery/PoolTerrace.tsx) 负责绘制它们。先只让泳池布局导出几何清单。行走和放置各自判断合法性：能跳上一个物件不意味着能把角色放在那里。用岸道接缝、远端计时台、隔水摆放和校园门线回归。

## 4. 复用高级 HUD 的资产编辑控件

[`MmdVrHud.tsx`](../src/mmdVrShowcase/components/MmdVrHud.tsx) 的角色与物件详情各自实现显隐、移动、缩放、旋转、复位、移除，只有角色有材质入口。可先抽公共编辑行，保留两个面板的高度和专属操作。各用一个角色和 GLB 验证目标 ID、忙时禁用和一次松开只执行一次。

## 5. 给重绑前的姿态清理顺序一个入口

[`mmdRuntime.ts`](../src/mmdVrShowcase/mmdRuntime/mmdRuntime.ts) 在替换求值器、换动作和显式物理重置前，三次按同样顺序撤销胸部形变、清指腹状态并恢复用于显示的物理姿态。可只提取这段相同序列；普通播放帧有不同的历史保留语义。回归重绑失败回滚、暂停拨衣、seek 和循环，比较手臂矩阵和衣摆顶点。这项是降低漏清理风险，没有帧率收益测量。
