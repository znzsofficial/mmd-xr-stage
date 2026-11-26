# WebGPU / WebXR 核查（更新至 2026-11-26）

## 已确认

- [Meta Browser 146.0](https://developers.meta.com/horizon/downloads/package/browser/146.0)（2026-04-21）宣布实验性 WebGPU in WebXR。
- [Browser 150.1](https://developers.meta.com/horizon/downloads/package/browser/150.1) 增加实验性 WebGPU XR foveation；[152.1](https://developers.meta.com/vr/downloads/package/browser/152.1)（2026-10-02）增加实验性 composition layers，说明要求 `chrome://flags` 开启 webxr experiments。
- [Meta Browser 156.0 发布说明](https://developers.meta.com/vr/downloads/package/browser/156.0/)（11-13，11-26 复查官方搜索索引）在 New Features 明列 “Support for WebGPU in WebXR”。同页标为实验性的 WebView 独立更新是另一条目。基本投影不依赖 foveation、额外合成层或特定刷新率；按当前设备实际会话选择后端。
- [WebXR/WebGPU 绑定草案](https://immersive-web.github.io/webxr-webgpu-binding/)及[最小示例](https://immersive-web.github.io/webxr-samples/webgpu/vr-barebones.html)：从用户点击请求 `immersive-vr` 和 `webgpu`，用 XR 兼容设备创建投影层，按 XRFrame 的视图描述准备眼图。
- 锁定的 Three r187：`WebGPUBackend.init` 读取 `renderer.xr.enabled` 来申请 XR-compatible adapter，因此要在 `renderer.init()` **之前**启用 XR；绑定时由 `renderer.xr.setSession(session)` 创建投影层、读取每眼纹理视图并管理 XR 帧循环。不要同时装实验页的原生手写 binding，也不要按默认左右序号猜切片。r187 的这条路径禁用 multiview。已戴机出画的记录属于[原生 WGSL 实验页](./performance/quest-2026-11-25-1149.md#布料实验实际跑了什么)，Three 房间另验。

## 对本项目的意义

当前生产仍为 WebGLRenderer + WebXR。切换需要同时处理 renderer/session 创建、R3F/XR 兼容、MMD 材质增强 onBeforeCompile 到 TSL 的迁移、已有 self-shadow 降级补丁和 WebGL 回退。不是更换构造函数即可完成。

WebGPU 支持不代表这个项目自动更快；没有真实 Quest 3S 帧耗时、图层尺寸与左右眼材质对照，不承诺收益。未来实验分支必须检测 API 与实际 session 创建结果，并保留 WebGL 路径。当前 GUI 视觉更新不依赖 WebGPU，也不修改现有渲染后端。

## 11-25 后续计划：先做好底层，再切玩家入口

状态：已有[单演员材质适配](../scripts/webgpu-actor/materialAdapter.js)、本地同姿对照及 [Three XR 开发小房间](../scripts/webgpu-actor/xr-room.html)。正式舞台继续走 WebGL；同背包、正式房间及其输入仍待接入。

1. **先画演员，用原 Bullet 作对照。** 从房间现有加载路径注入模型加载选项、材质挂载和 GPU 预热。复用锁定 loader 的 `createMmdTslPipeline`，现有 Studio 的 `src/appModules/mmdStudio/mmdTslPipeline.ts` 是可参考的按需加载封装。由房间统一调度求值和绘制，别让 pipeline 再开一个渲染循环。固定镜头、姿势和灯光比较脸、发片透明排序、轮廓、表情与 UV；SDEF/QDEF 用同一肘膝在原始和摆放比例下比较。独立自阴影在当前 fork 降级，记作切换前的画面差异。
2. **验证计算结果进正式材质，再接裙摆。** Three r187 的 WebGPU 后端可接收现成的 XR-compatible `GPUDevice`；先用一个已知位移的裙节点证明计算输出能被角色正面和描边同帧读取，随后接 [PMX 裙链、碰撞许可](../experiments/gpu-cloth/rig.js)和[实际织面承托](../experiments/gpu-cloth/handPass.js)。优先用 Three 管理的 storage buffer；原生 WGSL 输出如何交给 TSL 材质是待验接口。若现有写法只能靠私有缓存互操作，先评估把最小写入 pass 改为 Three compute 节点。物理结果留在 GPU，形态和服装显隐仍由原演员管理。密裙、稀疏裙各跑同舞段暂停、双托、先后撤手和续播，看最终衣片及描边。
3. **先测 XR 接线，再决定切换。** 第一阶段已有演员后即可用内部入口冒烟双眼，尽早排除 `@react-three/xr`、Three XRManager 和现有会话绑定的冲突。每个会话只有一个帧循环和投影层所有者。集成后验证同背包放置、菜单射线、双手操作、退出和失败恢复，再查代表性布景的自定义着色器（如教室地面、小行星天幕）。按同机、同动作、相同实得刷新率和眼图尺寸与正式 WebGL 比慢帧；默认切换看常用场景画面及操作、真机帧时和回退均过关。一景一人的调试成果不自行触发切换。

**可复用的轮子：**[现用 loader 的 WebGPU 实现（固定提交）](https://github.com/znzsofficial/three-mmd-loader/tree/3ac1d8ef93fe85a9bb4463933aef4a5198bd259a/src/webgpu)提供 toon、轮廓和稀疏位置/UV 形态；[R3F 9.8.2 的 Canvas 工厂](https://github.com/pmndrs/react-three-fiber/blob/v9.8.2/docs/API/canvas.mdx)可异步初始化 renderer；[Three 的 GPU 布料示例](https://threejs.org/examples/webgpu_compute_cloth.html)示范计算和绘制共用缓冲；[WebXR 最小示例](https://immersive-web.github.io/webxr-samples/webgpu/vr-barebones.html)可隔离绑定问题。[three-simplecloth](https://github.com/bandinopla/three-simplecloth)适合有顶点色蒙版的 SkinnedMesh，抓取与球碰撞可参考；用户导入的 PMX 有自己的裙骨、关节和碰撞许可，主路径继续使用既有求解器。现阶段无需增加运行依赖或迁移引擎。外部示例的能力与本机集成验收分开记录。

**第一件原衣怎么验：**沿用[实模画面对照](../scripts/model-render-coverage.js)的相机、动作时间和实际摆放比例，分别取正面、描边和隐藏一个衣柜材质后的画面。锁定 loader 的 `attach` 会替换材质并追加描边绘制组，`prepareRender` 会同步形态、光照与材质状态；房间已有绘制者时，每帧准备一次即可。不要把新增描边组当成独立衣柜条目，也不要在两眼分别跑形态求解。`detach` 负责卸下 TSL 附属资源；回退从原文件与布局重建 WebGL 实例，不把已替换的材质当作原件复用。

**后续候选：局部撕裂。** 先选一件独立袜面、有底层腿部几何的测试衣物，做一条可复位的预制裂缝；保留 UV 与原骨权重，拉开时同时看两条裂边、腿面和描边，松手、复位后再播舞。若袜子直接画在腿部贴图上，归为另一种素材，不在这条几何试验中。此候选不阻塞渲染后端，也未排入当前实现。

**参考代码怎么用：**旧 NekoVirtOS Studio 只参考调用顺序，行为以当前锁定的 loader 源码和实际画面为准。StrinCube 桌面对照可借同姿取样和原生后端判定方法；它的简化着色只验证不透明线性蒙皮，不能用来验游戏原衣材质。卡拉彼丘风格的贴图、缺图降级与同姿转灯对照见[角色卡渲资料](./scenery/character-toon-references.md)。

**今晚的实图基线。** 在项目根目录用 `pnpm dev`，打开 `/scripts/webgpu-actor/probe.html`，选原衣 PMX 目录与 VMD。两边各用自己的模型实例，同一组本地文件、相机、比例与动作时间，关物理和阴影；WebGL 加舞台平衡色和特殊蒙皮准备，原生 WebGPU 加锁定 loader 的 TSL 材质。可固定姿势只换主光。此页不进入产品构建。

桌面 Edge，600×600，一件真实 PMX、21 个有贴图的材质、比例 0.1。同一 VMD 在 0 秒与 4 秒两边骨骼/形态的取样差均为 0；第 4 秒两边前景同为 50,555 像素，关闭原生描边分别改变 2,469 / 2,484 像素。主光左前转右前，衣面两边都有可见变化；单独隐藏原外裙槽后两边前景同降到 48,667。当前 WebGPU 略亮：第 4 秒共同前景亮度中位（屏幕 RGB 码值，0–255）WebGL 127.8、WebGPU 132.5。先以脸和浅色衣料为局部区域复查，再决定是否调材质。当前样本最终没有半透明前景像素，发片叠色、其他特殊蒙皮和 Quest 双眼需另外选样。对照图仅在本机 `local-review/screenshots/webgpu-actor-material/comparison.png`。

## 11-26：近景和 Three 双眼

**同姿亮部。** 开发对照页可选脸部、半身、相机方位，以及只作用于角色的舞台平衡色。保留原色档；在 TSL 正面材质合成后、与背景混合前，沿用 WebGL 的环境增益和亮部曲线，不改全局曝光或描边。锁定的 loader 已在其输出前截断 RGB，因此这层不能恢复更早丢失的纹理层次。固定 VMD 第 4 秒、左前 60° 入光；通过逐材质显隐取两边共同可见的像素，比较 RGB 三通道平均绝对差（0–255）：脸部近景 **20.6 → 1.0**、半身白衣 **13.0 → 3.0**。露脸与衣纹的对照图存于 `local-review/screenshots/webgpu-closeup/grade.png`。这是一个样本的画面结果，不是提帧证据。

**发片与眼睛叠色。** 单画发片，分别隐藏眼睛、发片或两者，对比最终 RGB；脸后方的不透明像素不会掩盖这项测量。CPU 补查 20 件原 PMX、38 个发槽；这批样本中未找到原样就在正、侧两向透出虹膜的前发。选一件前发原贴图含 232–255 alpha、原样被判作不透明的模型，固定刘海覆盖眼睛的姿势；另存**正控**只把该材质的常量透明度从 1 改为其前一个 float32，原贴图、UV 和 8 位 alpha 不变。两后端均在正控走混合，未改原件均走不透明。这件原衣另有两处同样的缺图告警，均非被测发/眼槽。

正控正面和侧前 50° 中，两后端均看到发片与眼部共同贡献。原绘制路径的眼周并集 RGB 平均差为 **4.14 / 5.40**；发片单画时该区域 alpha 平均差 **5.12 / 4.59**（0–255）。只把 WebGL 对照中的双面透明发片改为单遍，后两数均降至 **0**，正面重叠区域也吻合。最终叠色仍有差异（并集 RGB 差 **2.92 / 4.29**）；这是定位用的开关，正式 WebGL 不变。

**剩余差异的交叉对照。** 保持这个正控、单遍发片、两种机位和 WebGPU 的 FP16 中间目标不变；分别切换透明材质绘序（原序／按 WebGL 实际绘制的槽排序）和合成空间（原线性合成／先编码 RGB 再合成）。用同一份 WebGL 眼周遮罩取样，正面 1,216 像素、侧前 770 像素。在两种绘序下，编码合成都使 RGB 平均差从 **2.92 / 4.30 → 0.62 / 0.84**（0–255）；单独对齐绘序没有改善。双面遍数解释发片自身 alpha 差，本例剩余眼周色差主要来自混合空间。只作诊断：不为这个正控改变整场色彩空间或所有 PMX 的绘序。本机复现与结果：`local-review/fringe-cross.cjs`（`FP16=1`）、`local-review/verification/fringe-cross/fixed-target/report.json`。

**Three.r187 投影层。** 开发小房间用一个 Three 渲染器同时画地面、远近色柱和原衣，首帧不等 PMX 读取或刷新率协商；选的是本地文件，尚未接游戏背包。用 `node scripts/webgpu-actor/xr-room-smoke.cjs <本地原衣.pmx>` 启动一个桌面 GPU 和模拟会话做对照（无参数仅生成测试裙）。默认 sRGB 输出先画线性中间目标，再用单相机全屏 quad 逐眼转色。r187 在这个最后的 pass 按眼序号选择目标层；交换绑定返回的两眼切片时，未修版的近、远柱左右视差分别由 +7、+3 像素反成 −7、−3。仅在这个固定版本的开发渲染器实例，[映射最终输出到绑定报告的切片](../scripts/webgpu-actor/r187ProjectionOutput.js)，保留中间源眼序号和其余渲染行为。普通、反序两次重入的视差都为 +7、+3；演员加入后两眼各有约 3,300 个像素相对地标帧变化。拒权、建层失败后重试、应用和系统两种退出均覆盖。该适配只处理已复现的输出路径，升级 Three 时先去掉适配、跑两个切片顺序再决定是否保留。新房间还没有 Quest 镜片结果。
