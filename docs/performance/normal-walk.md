# 普通走、跳和眼高：把输入身高与显示结果分开看

对照 [11 月 25 日实戴反馈](./quest-2026-11-25.md)。`327b542` 与 `1b95f29` 的普通平地／母星马达代码相同：平地把追踪空间原点放在支撑脚位上，母星在行走时随各步的径向运输原航向。其后普通跑跳接入重力捕捉，空中固定出发地平线、落地存为倾角。对改前构建 `aa6a0f5` 的 IWER 同路回放，纯走 17.72 m 并转两次仍当地直立，一次向前跑跳后则留约 18.57°；又走 3.30 m 仍留 18.58°。此时模拟追踪身高 1.63 m，双眼中点的径向壳面净高仅 1.29 m。这复现了**一种**走低／走歪的条件，不是初次在真实平地感到低的原因证明。

- **母星。** 从直立支撑起跳且一直在母星引力井时，在空中随实际走过的径向短弧运输原航向，连续检查人工转动的身体净空。跨井、头先接触及主动风道／足印不套这条规则。真实侧身在停住时不搬动原点；摇杆确实迈步后，沿可达支撑逐步把马达移到真实脚印下，不把实头的倾斜当作需要纠正的倾斜。自由飞行时在现实中走动，返回普通时取回最后支撑；不把那段现实位移或飞行高度算进站高。
- **平地。** 0 cm 时只把本帧追踪身高放在支撑之上。低台的高度、转入普通时的安全着陆点和蹲起各自处理。正偏移获准后，现实中抬头靠近低顶仍然 1:1；下一次虚拟步行／跳跃仍须通过净空检查。没有设一个替代身高，也不自动改玩家偏好。

## 复验入口

**相同路线的实际 IWER 双眼。** 用已发布的捕捉前固定版 `1b95f29`、修前 `aa6a0f5` 和本轮构建各走一趟；均为 1.63 m 追踪眼高、0 cm 偏移、两次右杆转向，保持头倾一段再复原，全程没有按 Y。下表取向前跑跳后继续走约 3 m、松杆时的双眼中点和扣除追踪转动后的显示基座；每版有独立原生摇杆采样，并非逐帧相同的物理轨迹。

| 条件 | 跳前纯走距离 | 续走后相对当地径向倾角 | 续走后实际径向净高 |
|---|---:|---:|---:|
| 捕捉以前 `1b95f29` | 16.53 m | 约 0° | 1.65 m |
| 修前 `aa6a0f5` | 17.72 m | 18.58° | 1.29 m |
| 本轮普通跑跳 | 17.72 m | 约 0° | 1.63 m |

本轮跑跳双眼最高到壳外 2.55 m，然后脚先着地；导出记录一次起落、零换井、零回正，收尾的 `drawn.eyes=2`、`drawn.shellClearanceM=1.63`。本机三份原件在 `local-review/verification/normal-walk/{precapture,before,after}/`。这是应用侧画面的实测，实戴观感另验。

另在同一生产构建平地实际点场内控件：普通模式 0 cm 两眼均 1.63 m，−10 cm 后均 1.53 m；复位并进入自由模式，右杆升到约 2.55 m，再选普通模式，双眼都回到 1.63 m。导出记录了这次自由→普通，以及实际绘制眼高。本机记录在 `local-review/verification/normal-walk/memory/flat-export.json`。

- CPU：`pnpm exec vitest run src/mmdVrShowcase/movement/PlanetMotor.test.tsx src/mmdVrShowcase/movement/usePlayerMovement.test.tsx src/mmdVrShowcase/movement/stanceDiagnostics.test.ts --maxWorkers=1`。母星 `-t 'normal route'` 对同一组原生轴／按钮样本跑无跳对照和有跳对照，用实际 Rapier WASM、倾头、横移、两次转向和 0 次 Y；比较虚拟双眼中点与实际壳面。`usePlayerMovement` 包含向下飞离地板、回到平地／18 cm 支撑、归零与蹲起。`TwinLeapMotor.test.tsx` 另外覆盖印外头先捕获、贴牌拒绝回正和风道返航。
- IWER：对待验生产构建串行运行 `node scripts/verify-home-walk-iwer.cjs --comfort`；避免覆盖 `local-review/verification/normal-walk/before/`。这是模拟显示而非 Quest 舒适度；不要用 Y 消除待测差异。
- 真机：平地记录设置偏移并重置到 0；站立、蹲低、自由升降后返回普通，各停两秒。母星同一条开阔路线先只走、转、停，再从同一出发点做一次向前 A 跳并续走。记录感到低／歪的大致时刻，再导出这次会话。

## 读导出

平地看 `windows[].playerStance`，母星看 `windows[].planetMovement.stance`。均是采样窗末单帧，不是窗内最坏值：

| 字段 | 单位与口径 |
|---|---|
| `trackedEyeM`、`requestedOffsetM`、`appliedOffsetM` | 同一帧的参考空间头中点 Y、设置偏移、实际采用偏移，米。0 cm 下站／蹲的 `trackedEyeM` 就是设备本次给出的值。 |
| `mode`、`grounded`、`normalReturns` | 普通／自由、本帧支撑、此马达挂载后自由→普通次数。先定位稳定的普通接地窗。 |
| `navTiltDeg`、`drawn.rigTiltDeg` | 导航上方与**马达脚下**径向的夹角；以及从实际渲染左眼世界矩阵扣除同眼追踪旋转后，相对**双眼中点所在径向**的夹角。平地以世界 +Y 为上。绕星而行很远，这两个角仍可为零；实头横移或贴壳着陆时二者可能不同。 |
| `drawn.trackedRollDeg`、`drawn.viewRollDeg` | 左眼在追踪空间／相对当地上方的显示横滚角，带正负号；仰视或俯视到无法定义横滚时为 `null`。主动歪头应反映在显示角里。 |
| `drawn.eyes`、`drawn.eyeAboveFootM`、`drawn.shellClearanceM` | 实际绘制的眼数、双眼中点相对马达脚位沿当地上方的高度、双眼中点到行星渲染壳面的径向净高。平地无球壳，末项为 `null`。飞行中脚位／暂存支撑不是静止地面，不能拿来判站高。 |
| `planetMovement.lastLanding` | 最近一次普通弹道落地的马达帧号、先碰部位 `part`、接触后视野残留倾角 `tiltDeg`、接触平移 `seatM`。配合 `snapTurns`、`orbitalJumps/Landings`、`wellChanges`、`alignments`、风道／足印计数定位事件。 |

若 `drawn` 为 `null`，该帧没有取得匹配的渲染眼矩阵；不要以马达目标值补齐。`drawn` 有值证明读到了本帧渲染器结果，不等于头显合成或镜片可见证明。没有真实设备的新导出前，仍不确定 11 月 25 日的偏低是否也涉及保存设置、追踪地面或佩戴姿态。
