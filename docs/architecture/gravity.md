# 舞台重力：在这个点，物体往哪儿落？

舞台有两类重力场：**普通房间沿世界 −Y 恒定下落；琉璃小行星选取附近一颗可步行星体，朝它的中心下落**。离开所有引力井后，加速度为零，已有速度仍能带着物体漂行。风道、助跳、玩家着地和演员衣摆各有自己的运动规则。

## 当前数值

下表是名义表面的加速度大小，单位 m/s²。母星、七颗风道卫星和三座跳岛同属 `glassPlanet`；远景里的行星和星环没有引力井。

| 场地 | 表面重力 |
|---|---|
| 普通房间 | 9.81，世界向下 |
| 母星 `home` | 2.50，朝星心 |
| 01–04 号卫星 | 赭砾 2.80、霜岬 2.15、棱盐 1.25、玄釉 3.65 |
| 05–07 号卫星 | 苇湾 2.55、伞灯 2.35、潮汐洞 2.45 |
| 三座跳岛 | 云母屿 1.55、硫珠屿 1.85、琥珀屿 1.75 |

数值来源：[普通房间重力及母星记录](../../src/mmdVrShowcase/movement/gravityReference.ts)、[母星半径与强度](../../src/mmdVrShowcase/scenery/planet/planetLayout.ts)、[卫星图册](../../src/mmdVrShowcase/scenery/planet/windAtlas.ts)。以普通卫星小跳为例，相同的起跳速度在棱盐星能跳得比在玄釉星更高。

## 道具怎么取样

[`sampleStageGravity(room, point, previous, out)`](../../src/mmdVrShowcase/movement/gravityField.ts) 接收物体的**世界坐标（米）**，覆盖写入世界加速度向量，返回本次选中的 `World`。每个物体保存自己的返回值；新生、换场或从池中复用时从 `null` 开始。`out` 使用调用方独立的向量，可在物体间依次复用。星体记录是共享布局，应只读。

```ts
// 每个纸片有自己的 position、velocity 和 well: World | null；a 是复用的 Vector3。
chip.well = sampleStageGravity(room, chip.position, chip.well, a);
chip.position.addScaledVector(chip.velocity, dt).addScaledVector(a, 0.5 * dt * dt);
chip.velocity.addScaledVector(a, dt);
```

普通房间返回 `null`，但 `out` 是 `(0, -9.81, 0)`；星系深空也返回 `null`，`out` 才是零。是否有重力应读 `out`，不能只看返回值。比如彩纸随局部引力落，天灯的浮升可取局部引力的反向；零场中的漂移由玩具自己决定。效果无须加入碰撞世界，也不读玩家的 `gravityOwner`。

普通跨星弹道和查询共用 `localWell` / `pull`。选井看距**名义球面**的距离，不把所有星的力量相加；两个仍有引力的井重叠时，另一颗要近过 0.55 米才抢走原归属。因此，两件从不同方向来的道具即使瞬间同点，也可能各自受到相反的引力。母星近场按参考半径封顶；卫星为保留小跳手感，恒定区到名义半径外 1.25 米。再远按距离平方反比减弱，在井的最后两米平滑衰减至零；刚出界时若附近没有其他井，可短暂保留旧身份。若另一颗星在该处仍有引力，零强度旧井立即让位，避免物体悬停在两个引力井之间。场查询不推进时间，不生成网格，也不判断表面接触。

## 玩家脚位、演员和相机分别由谁负责

| 路径 | 实际职责 |
|---|---|
| 普通房间行走／跳 | [`groundMotor`](../../src/mmdVrShowcase/movement/groundMotor.ts) 用同一 9.81 常量推进竖直速度。地板、台阶、侧墙和顶棚由柱形空间查询决定；加速度本身不能判断落脚。 |
| XR 母星、卫星地面 | [`PlanetMotor`](../../src/mmdVrShowcase/movement/PlanetMotor.tsx) 持有脚位和 XR 原点。母星的[按需物理适配器](../../src/mmdVrShowcase/movement/PlanetPhysics.tsx)直接驱动 [Rapier 胶囊](../../src/mmdVrShowcase/movement/homeCapsule.ts)：在每个子步按实际杆量施加切向冲量与径向重力，按支撑校正脚位。[五档走速对照](../performance/home-walk.md)。WASM 未就绪或失败走 [JS 后备](../../src/mmdVrShowcase/movement/planetTravel.ts)；卫星用 [`moonWalk`](../../src/mmdVrShowcase/movement/moonWalk.ts) 沿实际壳面走，母星驱动停放。 |
| XR 离地、普通跨井 | [`orbitalFlight`](../../src/mmdVrShowcase/movement/orbitalFlight.ts) 做子步积分，换井保留动量。[壳面扫掠](../../src/mmdVrShowcase/movement/orbitalSurfaces.ts)检查脚、身体和头。同井普通跳在空中跟随当地径向；跨井或头／侧先着地保留扫掠视野。接地结果明确为普通或保护姿态，[模式交接](../../src/mmdVrShowcase/movement/planetJourney.ts)统一写 XR 原点。实头偏转独立。 |
| 足印助跳、风道、自由飞行 | [足印助跳](../../src/mmdVrShowcase/movement/twinLeap.ts)校准发射冲量，在指定两星间积分，含专用横向辅助加速度。风道由图册的 `rideStep` 沿预制曲线运送；自由飞行由摇杆直接平移，不受重力或实体约束。这些是玩家的不同走法，风道和自由飞行没有另开物理引擎。 |
| PMX 头发、裙摆、手部接触 | [演员运行时](../../src/mmdVrShowcase/mmdRuntime/mmdRuntime.ts)给每个开启物理的模型创建独立 [MMD Bullet 世界](../../src/mmdVrShowcase/mmdRuntime/mmdPhysics.ts)，按模型刚体、关节与接触代理求解。舞台不会把角色位置处的行星引力灌进 Bullet。 |
| 视觉粒子 | [盐晶与火星](../../src/mmdVrShowcase/scenery/planet/StationFallout.tsx)在着色器里按发射点的固定局部轴与本星重力画抛物线；既有[液滴](../../src/mmdVrShowcase/bodyState/lactation/droplets.ts)离开出口后沿世界 −Y 下落。它们不扫壳面，也不是 Bullet 刚体。是否需要沿途重新选井，取决于效果能否飞离发射点附近。 |
| 屏幕观看 | 检视相机有自己的轨道、缩放和平移。[街道与电玩厅](../../src/mmdVrShowcase/screen/streetTravel.ts)的贴地步行复用普通地面马达；[星系游览](../../src/mmdVrShowcase/screen/screenWindTravel.ts)复用风道、月面步行和足印助跳，普通空格小跳用 `moonWalk` 在本星起落。它没有挂 XR 母星 Rapier，也不等同于 XR 的任意地点跨井弹道。 |

## 何时值得再拆

[现版重力采样与壳面扫掠对照](../performance/orbital-review.md)：记录桌面计时、候选原型逐值误差及仍缺的真机证据。

- **加一颗可步行星或一个视觉玩具**：已有 `allMoons` 记录自动参与选井；地形、可落脚面和抵达路线仍需单独创作。玩具只需采样位置并管理自己的速度、寿命和绘制，不需要改玩家状态机。
- **加一种场**（例如某个房间内有侧向吸附区）：先在查询层定义生效范围、重叠优先级与出界行为，用两个独立物体穿越边界验证。若还要让玩家走上侧墙，必须另做支撑、碰撞、头部余量和视平线接管；改一个向量并不足够。
- **加一种会接管脚位的移动方式**：扩展 `PlanetMode`，而不是在已有活动方式旁再加开关。最近一次支撑记录可在自由→普通时取回，记录本身不驱动另一个马达。用既有进入、打断、恢复、落地后松杆停步的路线验证。
