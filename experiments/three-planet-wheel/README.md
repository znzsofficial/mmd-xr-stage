# Three 轮子选型：小行星的普通行走

**接入状态：** 此探针已用于[正式舞台的琉璃小行星](../../docs/scenery/opal-planet.md)。下方保留选型时的固定步长与实验边界；实际 XR 使用有上限的帧步长，进入其它布景时卸载。

**选择**：继续用正式版的 Three r187、React Three Fiber 9、`@react-three/xr` 和 MMD/Bullet。Babylon 教室保留作对照，暂停迁移。这里考察的是玩家移动，不把角色、衣服或手柄接触塞进第二个物理世界。

| 解决什么 | 候选与核对 | 建议 |
|---|---|---|
| 绕球行走、跳起再贴地 | [Ecctrl 2.0.2](https://github.com/pmndrs/ecctrl)，依赖 [React Three Rapier 2.2.0](https://github.com/pmndrs/react-three-rapier) 及 Rapier WASM 0.19.2。发布包提供随空间位置变化的重力、形状扫掠测地、`upAxis`、`setForwardDir` 和 `setMovement`；当前 React、R3F、Three 版本满足 peer 范围。`drei` 和 `leva` 是可选 peer，本次没有安装。 | 首选。普通玩家身体交给它，XR 原点、实走偏移、转头和菜单仍由现有输入层掌管。不要把第三人称跟随相机挂到头显。 |
| 如果悬浮式角色控制器不适合第一人称 | [Rapier 自带 KinematicCharacterController](https://rapier.rs/docs/user_guides/javascript/character_controller/) 能更新 `setUp`，做避障和滑墙；它只修正请求的平移，重力位移和胶囊旋转要自己提供。 | 备选，不和 Ecctrl 同时驱动玩家。r187 自带的 `RapierPhysics.js` 示例会从 CDN 拿另一版 Rapier 并启动自己的定时循环，不宜直接搬到产品。 |
| 摆门、地标和摄影机 | [Three Editor](https://threejs.org/editor/) 适合在浏览器粗摆场景。已有 Three 依赖也带 `TransformControls`，可做仅开发用的定位工具。 | 用编辑器导出的变换辅助写布局，回舞台核对实际机位、门线和射线；导出网格不等于自动有可走、可放人的地面。 |
| 星空与静态地形 | [Drei Stars](https://drei.docs.pmnd.rs/staging/stars) 是可闪动的点星场；项目已有 `CourtSky` 全景星空。[three-mesh-bvh](https://github.com/gkjohnson/three-mesh-bvh) 适合复杂静态网格拾取／空间查询。 | 小球用解析球体碰撞已足够。先用已有星空；为复杂地表或大量道具做 BVH 前先测，BVH 不提供重力或行走。 |

## 真正在本地跑了什么

[`probe.jsx`](./probe.jsx) 挂载 Ecctrl 的实际组件、真实 Rapier WASM 与球形碰撞体；只通过方向和跳跃输入驱动胶囊，不手写沿球面轨道的目标位置。世界匀强重力为零，玩家使用指向球心的 2.5 m/s² 重力场；半径 12 m、常速目标 2.4 m/s。接近正下方先停下，按跳跃、落地，再走回起点附近。

桌面 Edge / WebGL，R3F 人工推进时间、分别固定 72 和 90 步/秒，两次都是 **PASS**。累计行走约 6.285 弧度；两次都走到球底，球底起跳较静止支撑高度分别高 **0.276 / 0.252 m**，随后重新检测为落地。这是该包的悬浮支撑和本次参数实测，不是理想抛物线高度，也不是头显帧率。只验证了控制器上的输入，没有在探针中挂载舞台、XR 相机或 MMD 角色。

从本目录运行 `npm ci --legacy-peer-deps`，主项目已装开发依赖时运行 `npm run dev`。页面自动报告 72 步结果，带 `?hz=90` 复测。正式入口和包管理器的依赖树均未改变。

**下一项值得验的是 XR，不是再选一套物理引擎。** 用原 XR 手柄的左摇杆与 A 键替换探针输入，沿球面旋转 XR 原点、保留真实头部偏移。检查过极点和复位时方向连续、手柄射线还能点到菜单、渲染掉帧时移动不飘。半径 12 m 上，2.4 m/s 的局部上方向约转 11.5°/秒，8 m/s 约转 38°/秒；常速先试。角色全表面摆放与裙摆朝向是另一项，现有背包落点只存 `x/z/yaw`，不能直接复用到球背。只有小星球才应按需加载额外 WASM，需另测其下载和初始化成本。
