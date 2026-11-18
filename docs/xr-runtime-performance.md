# XR runtime 性能维护

## 静置衣摆的显示稳定性

在本机加载用户提供的复杂 PMX（无 VMD，317 个动态刚体），关闭接触干扰，开启交互物理连续运行 10 秒。最后 4 秒逐帧测量世界坐标下位移：按裙骨权重 ≥0.8 筛选并抽样 461 个蒙皮顶点，每帧先取这些点的 RMS，再取各帧 P95。桌面 Chromium 以固定渲染时间增量驱动，不是头显 FPS 或屏幕像素测量。

| 渲染采样 / 模型缩放 | 原始姿态 | 显示稳定后 |
|---|---:|---:|
| 72 Hz / 0.1× | 0.283 mm | 0.118 mm |
| 90 Hz / 1× | 2.386 mm | 1.097 mm |

仅增加 Bullet 子步频率未稳定改善此夹具。保留 60 Hz 物理步长、原 PMX 约束与阻尼；显示时按世界空间衰减微小变化，较大位移/旋转更快跟随，下次求解前恢复原始姿态。72 Hz / 0.1× 从模型外缓慢抬起碰撞体的对照中，裙骨最大移动 10.85 cm → 10.86 cm。另跑 `scripts/paused-cloth-smoke.html` 检查拖动、恢复、seek、缩放。此修复降低残余抖动，不保证物理模型在所有姿势达到静止。

## 手部接触形状

默认档每手 6 个刚体：掌心盒宽 66、厚 22、长 76 mm，从手腕沿局部 −Z 延伸；五指用半径 7–11 mm 的短胶囊覆盖指腹。胶囊按 WebXR 指尖的 +Z 向末节近端延伸，闭合端中心在 tip。尺寸为固定近似，碰撞范围档位在有限范围内调节，不逐帧更换形状。调试显示与刚体共用 `handContactProfile.ts`；手背与指根之间不是完整皮肤网格。

`handContactProfile.test.ts` 使用随应用分发的 Bullet WASM，在两个手的槽位、旋转姿态和三种模型尺度下验证指腹／掌心命中、近距离未碰及手柄无误接触。真实衣物的响应还取决于 PMX 刚体覆盖和动作／物理时间。

## 2026-11-17：物理包装层与材质同步

基线为 `7f0b505`（loader 0.8.6 / Three r187）。本轮保持 Bullet 固定步长、maxSubSteps、solverIterations、碰撞组选择、模型单位尺度和碰撞体半径换算不变。

### 修改

- `mmdPhysics.ts`：非 direct-buffer 路径的六个 Float32Array、toggle buffer 和更新骨骼列表按 wrapper 实例复用；长度改变才重新分配。每步复制当前输入/输出前缀并清空扩展区域，避免沿用上一帧碰撞体数据。调用方数据不被扩容或替换，输出骨骼索引仍在每层裁去各自追加的槽位。
- 动态刚体数量、空闲 collision group、底层诊断统计按 `rigidBodies` 数组身份缓存。这个约定与 loader `ensureModel()` 相同：刚体定义改变必须替换数组，不能原地修改定义。半径、摩擦和恢复系数改变仍重建 augmented definitions。
- contact buffer 每个物理步最多查询一次，计数写入复用的逐碰撞体数组；左右手及汇总读取不再 `filter()` 分配。fallback 查询采用完整的半开索引范围，防止把内层手部接触算入外层手柄范围。
- 外层手柄计数排除辅助碰撞体之间的接触：真实 Bullet 会报告隐藏在 `Y=-1000` 的球之间的重叠。手柄/手部球彼此接触不代表碰到了模型。reset 后直到下一步返回零，dispose / 无碰撞体 / 隐藏模型也不再返回旧接触。
- `mmdRuntime.ts`：每个 provider 采样一次 enabled 状态，并把公共坐标变换的矩阵乘法移出各碰撞体循环；矩阵归一化和左右索引约定不变。
- 材质增强同步复用状态对象，发光色仅在输入或 shader uniform 实例改变时解析，保留现有颜色转换行为。WebGPU fallback 的 roughness/metalness 数值更新不再每帧触发 `needsUpdate`；移除 envMap 时仍正确标记材质更新。

### 可复现基准

```bash
pnpm exec vitest bench --run mmdPhysics.bench.ts
```

Vitest 5 的 JSON reporter 可输出每个 benchmark 的 latency：

```bash
pnpm exec vitest bench --run mmdPhysics.bench.ts --reporter=json --outputFile=sample/physics-bench.json
```

场景：500 根骨骼、300 个刚体、外层 2 个手柄 + 内层 12 个手部槽位 + diagnostics，固定定义，假 backend，不执行 Bullet 求解。预热 300ms、采样 1000ms；本机 Windows / Node 26.12.1。

| 每模型每步 | 修改前 mean / p99 | 修改后 mean / p99 |
|---|---|---|
| copied buffers | 80.75 / 272.49 μs | 13.69 / 16.50 μs |
| direct buffers | 4.65 / 8.50 μs | 1.33 / 1.60 μs |

这是 JS 包装层微基准，**不含 Bullet 求解、动画求值、GPU 绘制或头显调度**。不能解释成整场景快了相同比例，也不能承诺 Quest FPS；真实收益需要设备上的帧耗时测量。

### 正确性验证

- 150 项自动测试通过；新增覆盖跨帧缓冲复用、嵌套输出索引、拓扑变更、fallback 范围、重置/移除/隐藏后接触清除、材质版本不重复增长和 shader uniform 替换。
- 原生 Bullet parity：运行 `pnpm dev`，访问 `/scripts/physics-smoke.html`。两条缓冲路径各模拟 240 步，动态球下落接触左控制器；轨迹最大差为 0，左右接触归属正确，reset/dispose 清除接触。该页面是开发诊断入口，不会进入生产构建。
- 临时浏览器集成验证：生成 PMX 经过真实 `createMmdRuntimeHandle`、Bullet、材质增强、WebGL 渲染；模型 scale 0.2 → 1 → 0.4，每档 60 帧、共 180 帧，186 次物理步（含 reseed），无 WebGL/shader 错误，隐藏碰撞体接触计数为 0。
- synthetic 测试不替代 Quest 上的真实衣物、双手交互、动作跳转、连续缩放与震动回归。
