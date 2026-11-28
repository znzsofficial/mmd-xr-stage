# WebGL2 / WebGPU XR 正式生产栈

**默认 XR 和屏幕观看用 WebGL2；WebGPU 是可选的 XR 渲染后端。** 两者进入同一个舞台、使用同一套 VMD 求值和身体物理；主要差别在演员与布景怎样绘制、谁解裙摆，以及左右眼怎样输出。[当前正式版与玩家入口](./webgpu-xr-status.md#当前正式版) · [各版本的验证范围](./release-history.md#发布记录)

## 两端共用什么

| 层 | 正式实现与维护入口 |
|---|---|
| 应用与输入 | React 19.3.1、React Three Fiber 9.8.2、Three.js r187、`@react-three/xr` 6.6.32；页面状态用 Zustand 5.1.0。[依赖锁定](../pnpm-lock.yaml)；两个 XR 入口各自绑定会话与输入，复用[本地手柄配置](../src/xr/createAppXrStore.ts)、手追、菜单射线与玩家移动。 |
| 房间与资产 | [MmdVrGameRoom](../src/mmdVrShowcase/xr/MmdVrGameRoom.tsx) 复用玩家、背包、放置、HUD 与道具。[StageRoom](../src/mmdVrShowcase/stage/StageRoom.tsx) 持有当前实例；同页切后端从布局恢复，16 景各可放 3 名演员＋3 件物件。GLB/glTF 由[物件加载器](../src/mmdVrShowcase/stage/loading/mmdVrGltf.ts)处理，不占用演员求值器。 |
| 模型、动作、物理 | `@yohawing/three-mmd-loader` 0.9.0 ＋ fork `303bb7c` 的生成补丁，mmd-anim 0.5.5。[版本与制品](../loader-source.json) · [特性归属](./three-mmd-loader-maintenance.md#特性归属)。[演员运行时](../src/mmdVrShowcase/mmdRuntime/mmdRuntime.ts)负责 PMX/PMD、VMD、骨骼／IK 和形态权重；[Bullet WASM](../src/mmdVrShowcase/mmdRuntime/mmdPhysics.ts) 在 CPU 上运行，每个开物理的演员独占一个世界。VMD 时刻与物理步长独立，舞段暂停仍可拨衣。 |

## 画面、材质与计算

| 维护项 | WebGL2 · 默认 | WebGPU XR · 可选 |
|---|---|---|
| 渲染器与帧循环 | [R3F Canvas](../src/mmdVrShowcase/xr/MmdVrScene.tsx) 创建 `WebGLRenderer`；Three 的 WebXRManager 绑定会话，R3F 驱动房间。 | [准备页入口](../src/main.tsx)按需加载[正式宿主 `startGameFloor`](../scripts/webgpu-actor/stage-host.jsx)。先启用 XR 再初始化原生 `WebGPURenderer`；Three 的 XRManager 持有唯一 XR 帧循环，只在有效跟踪帧用秒数推进本场 Fiber 根。首帧先画环境，不等演员。 |
| 布景与物件 | 标准材质、实例化批次、烘焙贴图；[自定义布景](../src/mmdVrShowcase/scenery/daylightMaterials.tsx)用 GLSL `ShaderMaterial` 或 `onBeforeCompile`。 | 同几何、贴图和[实例批次](../src/mmdVrShowcase/scenery/SceneryBatch.tsx)。教室日光等用[手写节点材质](../scripts/webgpu-actor/classroomMaterials.jsx)；水面、星空等已登记的 GLSL 程序[离线生成 TSL](../scripts/build-room-nodes.mjs)，运行时编译为 WGSL。普通材质的 WebGL 私有修饰不会自动移植。 |
| 演员表面与画风 | 原 MMD toon、球面贴图、作者描边；[材质增强](../src/mmdVrShowcase/mmdRuntime/mmdRuntimeMaterials.ts)处理亮部、AO、遮罩与发光等。 | 同一 loader 的 [`createMmdTslPipeline`](../scripts/webgpu-actor/materialAdapter.js) 替换表面并为启用的描边追加绘制组。支持衣柜显隐、换底图、透明度、发光和平衡／明亮色；可按演员切换原 MMD、仿终末地或[仿卡拉彼丘](./scenery/strinova-render-study.md#在舞台上切换)。不能将 WebGL 的全部高级材质参数视为已移植。 |
| 蒙皮与形态存储 | 骨矩阵用骨骼纹理，顶点形态用 Three 数组纹理；材质／描边代理[共享几何](./performance/model-memory.md)，避免按代理重复分配。SDEF/QDEF 在[骨架空间](../src/mmdVrShowcase/stage/loading/rigSpaceSkinning.ts)处理摆放缩放。 | TSL 蒙皮的骨矩阵放在 uniform buffer，loader 按设备 `maxUniformBufferBindingSize` 检查容量（每骨 64 字节）。适用的位置、UV 形态按稀疏索引由 compute 写回 storage attribute；最终姿势就绪后，房间[每个跟踪帧最多准备一次所有演员](../scripts/webgpu-actor/stageActorBackend.js)，供双眼复用。 |
| 裙摆与接触 | 作者裙刚体、关节、身体和手部／道具代理走 Bullet，固定步长 1/60 秒。手动摆姿另有[裙片显示修正](../src/mmdVrShowcase/mmdRuntime/poseSkirtClearance.ts)。 | 物理开启且该演员的[裙摆驱动就绪](../scripts/webgpu-actor/roomCloth.js)后，只从 Bullet 滤出匹配的作者裙链，再追加手柄、手追和道具槽；其余身体仍走 Bullet。未匹配或初始化失败保留完整作者物理。[WGSL 求解](../experiments/gpu-cloth/clothKernel.js)按 1/72 秒预测、五轮距离约束，并用身体碰撞许可与掌面采样处理接触。手动摆姿的[顶点修正](../scripts/webgpu-actor/poseSkirtDisplay.js)是另一路。 |
| 裙摆怎样显示 | Bullet 的骨变换进入角色蒙皮，继续绘制原衣和描边。没有 WebGPU compute 或 storage buffer。 | [驱动](../scripts/webgpu-actor/clothDriver.js)上传目标、碰撞体及手部采样所用骨矩阵；借用 [Three 分配的两份 `vec4` 缓冲](../scripts/webgpu-actor/clothSurface.js)传递节点位置与目标。原衣和对应描边按原权重读位移，两眼不重算，显示路径无逐帧 GPU→CPU 回读。原生句柄访问依赖 r187 的内部后端，升级时需复查。 |
| 阴影 | 开实时阴影时，演员[投影到环境](../src/mmdVrShowcase/mmdRuntime/mmdRuntimeEntry.ts)，保留作者启用的描边。 | 普通 PMX、GLB 和布景仍可投影。loader 的专用 PMX 自阴影代理用 layer 1，与 r187 左眼重叠，舞台[关闭并释放该代理](../scripts/webgpu-actor/materialAdapter.js)；仿终末地可选的局部脸影是另一条绘制路径。 |

## XR 输出与性能诊断

**编译在什么时候发生？** WebGL2 放置新 PMX 时先逐张预传贴图，有 `KHR_parallel_shader_compile` 才用当前房间和相机[异步预编译](../src/mmdVrShowcase/stage/loading/prepareModelGpu.ts)；导出的 `compileAsyncWallMs` 是等待墙钟。WebGPU 新 PMX 的底图、toon 与球图[分到既有的跟踪帧上传](../src/mmdVrShowcase/stage/loading/modelTextureUploads.ts)，随后才挂接演员；未完成的放置随房间失效。WebGPU 布景在构建时将登记的 GLSL 转为 TSL，浏览器仍需针对实际设备与目标格式生成渲染管线。[四条布料管线](../experiments/gpu-cloth/clothPrograms.js)按设备复用，但绑定与输出缓冲各演员独占。[演员画风](../scripts/webgpu-actor/actorStyle.js)按选择准备附图，已绘制的变体通过 [Three 的绘制 pass 标识](../scripts/webgpu-actor/actorStylePasses.js)复用。附图就绪、双眼提交和镜片呈现是不同的时点。[首次放人及复切对照、报告字段](./performance/README.md#webgpu-首次放置与切画风)

| 维护项 | WebGL2 XR | WebGPU XR |
|---|---|---|
| 会话与眼图 | [绑定当前会话](../src/mmdVrShowcase/xr/mmdVrSession.ts)，请求 `local-floor`、可选手追；按支持情况使用 `XRProjectionLayer` 或 `XRWebGLLayer`。 | 还要求 `webgpu` 和 `XRGPUBinding`；Three 管理单个投影层，取每眼 subimage 与视口。线性场景颜色逐眼转为输出颜色；[r187 切片适配](../scripts/webgpu-actor/r187ProjectionOutput.js)只修正最后转色时的目标层。正常与反序切片都要正确。 |
| 设备实际采用的画质 | [WebGL 采样](../src/mmdVrShowcase/diagnostics/renderDiagnostics.ts)区分上下文抗锯齿、投影目标采样数与基础层自报值。 | [建层与画质请求](../scripts/webgpu-actor/floorRenderer.js)补入 r187 遗漏的 `scaleFactor`；仅对实际支持的层写 foveation。[采样](../scripts/webgpu-actor/floorPerformance.js)读取已分配场景颜色附件的 MSAA，最终转色投影纹理是单采样。两端均分列请求值、实得 Hz、层尺寸、每眼视口与实得 foveation；缺报留空。 |
| 正式会话导出 | [WebGL 记录器](../src/mmdVrShowcase/diagnostics/MmdVrDiagnostics.tsx)记录可见回调间隔、模型更新 CPU 墙钟、绘制调用／三角形；另有 Bullet 步进、放置和回场等分项。 | [WebGPU 记录器](../scripts/webgpu-actor/floorPerformance.js)记录可见回调间隔、模型 CPU、绘制计数，并按可见演员附画风和布料模式（可为 `mixed`）。两端用[同一导出格式](../src/mmdVrShowcase/diagnostics/performanceReport.ts)；`slowIntervals` 是超过实得刷新周期 1.5 倍的可见回调数，不是合成器丢帧数。 |
| **GPU 分段计时** | 正式 XR 报告未导出 GPU pass 时间。开发用[海站 WebGL 探针](../scripts/verify-harbour-light.cjs)可用 `EXT_disjoint_timer_query_webgl2` 测指定绘制。 | 在 WebGPU 入口加 `gpuTiming=1`；设备支持 `timestamp-query` 时，[正式记录器](../scripts/webgpu-actor/floorGpuTiming.js)稀疏抽取一帧，分列原生布料 compute、Three compute、双眼主场景和最终双眼转色。不含其他离屏绘制和合成器，不是整帧 GPU 时间。无该项读数留 `null`，不可用／漏采按状态记录，关闭此选项不分配查询资源。[独立布料实验](./performance/gpu-cloth-lab.md#真实-vmd-同段对照)另按物理步分账。 |

### 静态布景 Render Bundles 和双眼单遍绘制

**静态 Render Bundles 已试验，未在正式舞台启用。** Three r187 的 WebGPU XR 已在每帧分别为两眼录制临时命令；这和 `BundleGroup` 跨帧复用静态命令不同。以[海站出口吊牌](../src/mmdVrShowcase/scenery/terminus/PlatformWayfinding.tsx)的 5 个不透明网格做命令层对照：普通组每眼各录 5 个 draw，各用自己的深度层，成功提交。换成 `BundleGroup` 后，两个眼层仍各录 5 个，而显式 bundle 里是 0 个 draw。r187 [执行显式 bundle](https://github.com/mrdoob/three.js/blob/r187/src/renderers/webgpu/WebGPUBackend.js#L1414-L1445) 时分层目标的 `currentPass` 仍是 `null`，在左右眼开始前抛错。这个试验用了真实的 Three 列表及编码路径、记录器代替原生 GPU；它验证兼容性，不是毫秒数或头显结果。升级 Three 后再用同一吊牌测双眼像素、转身剔除与跨帧录制次数。本机复现：`node local-review/verification/render-bundles-r187/probe.mjs`。

**双眼单遍绘制未启用。** 锁定的 [Three r187 XRManager](https://github.com/mrdoob/three.js/blob/r187/src/renderers/common/XRManager.js#L770-L794) 在原生 WebGPU XR 路径明确禁用 `multiview`。双眼已经共享演员和布料计算结果，场景仍分别绘制。一个有两个切片的投影纹理不代表一次 draw 已广播给两眼。正式布景仍可使用实例化、视锥剔除和远景简化；没有接入 GPU 剔除后生成间接绘制命令的管线。

## 实测边界

- **功能与画面：**桌面硬件 GPU＋模拟 XR 已验证[同页 3 人＋3 物往返、材质恢复、双眼投影](./webgpu-xr-status.md#混合布局材质与环境的画面对照)。这些结果对应指定机位和素材；不证明任意 PMX 的两端画面逐像素一致，也不验证头显镜片呈现。
- **传输与整帧：**同一演员、舞段、240×240 每眼的桌面对照，掌面采样每次矩阵上传 **32,320 → 13,504 B**，布料驱动平均 CPU **0.135 → 0.108 ms**，实际回调间隔 P95 **7.4 → 7.6 ms**。[该优化减少了上传和 CPU 工作](./performance/gpu-cloth-lab.md#实际解算的内容)，未测出整帧提速。
- **Quest：**[历史摄影地台记录](./performance/quest-floor-dance.md)的两趟虽都实得 120 Hz、每眼 1680×1760，但 WebGPU 播舞窗全是仿终末地＋GPU 裙摆，画风、foveation 和舞段端点未配对。没有当前版同机同工况的持续帧时对照，不能据此给后端排名。
