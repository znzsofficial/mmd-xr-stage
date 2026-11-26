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

以下编号保留 11-25 的方案。已有[单演员材质适配](../scripts/webgpu-actor/materialAdapter.js)、同姿对照及 [Three XR 开发小房间](../scripts/webgpu-actor/xr-room.html)；第 2 项的缓冲接口已由[后续实绘](#原衣裙链已接入-three-房间)验证。**同一背包、一景一人内部接入已验；下一项看[交接页](./HANDOFF.md)。** 正式舞台继续走 WebGL。

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

### 原衣裙链已接入 Three 房间

在内部 `xr-room.html` 选择 PMX 目录、可选身体 VMD、进入 XR。左 X 切换 GPU 裙摆和原姿，右 A 播放／暂停动作。普通动作骨架保留原求值；本房间没有接身体 Bullet。暂停的 VMD 和每秒 72 步的裙摆时钟独立。没有匹配裙链时仍可看演员。

- **同一份物理输出直接绘制。** [原生求解](../experiments/gpu-cloth/clothKernel.js)供实验页和开发房间共用，包括五轮约束、PMX 碰撞许可与三角面双手支撑。[房间驱动](../scripts/webgpu-actor/clothDriver.js)在 actor 局部坐标中更新，处理摆放位置、朝向、比例及掌心的物理半径。它直接写入 Three 所有的两份 `vec4` 存储缓冲；[衣面与描边](../scripts/webgpu-actor/clothSurface.js)在原蒙皮后按原权重读同一份位移，每帧一次解算、两眼复用，显示路径没有 GPU→CPU 回读。r187 取原生 buffer 句柄的版本依赖集中于该文件一处。
- **单节点实图。** [GPU 回归](../scripts/webgpu-actor/cloth-proof-smoke.cjs)以未安装衣面 hook 的原生骨平移作独立参考，补偿子骨保持其世界位置。真实原衣 VMD 第 4 秒，在 0.1 和含平移与旋转的 0.167 两种摆放下，衣面与作者描边均落在参考位置；未选身体不动，清零逐像素复原。
- **两手和回落。** 模拟 XR 手柄握把 + 桌面真实 GPU；复用历史原衣落点，比较空手、单左、单右、双托。288 节点原衣的最终两片布相对同帧空手的中位上移 **61 / 72 mm**；先撤左手，**1 / 72 mm**；双撤后绝对残差均 **<1 mm**。两眼最终贴图也作局部对照。另一件 24 节点稀疏原衣通过同一个房间的双眼绘制、真实 VMD 播放／暂停／续播，不能据此声称它的双手承托达标。`XR_ROOM_HAND_PLAN` 指向原始材质取样 plan 时启用四路线；可另传 `XR_ROOM_VMD` 验暂停时布料仍走。采样和原衣留在 `local-review/verification/three-cloth-output/` 和 `local-review/screenshots/three-cloth-hands/`。
- **避免单眼遮挡。** r187 启用左眼图层 1，与锁定 loader 的专用阴影代理重叠。这个房间未启用专用自阴影，附着后销毁对应的投影代理；两个相同眼姿的最终原衣图恢复为完全相同，普通与反序切片均已复验。此次结果仍待真实镜片验证。

下面记录从这个小房间到共享演员的下一步实测；正式默认继续使用 WebGL。

### 正式背包与摄影地台：如何走开发入口

**正式游戏路径**：从同一份准备页 `/?set=floor&xrBackend=webgpu` 进入（开发／资格构建）。点原来的 VR 进入按钮，右 B 召回菜单 → 背包 → 角色 → 放置，再指地松开扳机。动作从选中角色的详情绑定，播放和暂停仍用原 HUD。不必在桌面预选 PMX／VMD。原 WebGL 与资格后端挂同一个 `MmdVrGameRoom`；资格宿主加载自己的 renderer、投影层和演员后端。见[生命周期](./xr-session-lifecycle.md#摄影地台的-webgpu-验证入口)。

**同页双后端对照**：资格链接的「摄影地台 VR 渲染器」可选 WebGPU / WebGL，留在原标签页沿用背包与暂停快照。两次都用原 MMD、同一演员和舞段。退出后，单次 JSON 标明实际 `backend`；两种后端各有一次只在地台的会话时，导出按钮打包该页最近的两份记录。`eyeViewports` 是各眼实际绘图视口，不拿整层宽度除二；刷新率取设备报告值。看双方一人、播舞、同物理设置的窗口，再对齐实际刷新率和每眼尺寸。`slowIntervals` 是窗口内大于 1.5 个刷新周期的可见 XR 回调间隔；追踪暂停不计，持续可见的长帧计入。这不是 GPU 耗时或合成器掉帧。双报告保留各自结果，不自动认定性能可比或更快。

**全流程实测（桌面硬件 GPU＋模拟双眼）：**[正式首页回归](../scripts/webgpu-actor/game-floor-smoke.cjs)用真实 B 键／扳机选背包第二行 B；松手后落地，双眼均绘出 B。原衣双托 61.41／71.61 mm，单撤左 0.62／71.59 mm。33.7 s 舞段暂停在 0.5651 s，原 WebGL 屏幕观看还原相同时刻；续场后收回 B，遍历隐藏节点也无演员，换上 A 后只有 A。完整证据 `local-review/verification/game-floor-smoke.log`。不带 `set` 的资格链接也能在原准备页下拉中手选地台；进入资格之前拒权、取消与迟到授权均保留文件，可以在同页重试 WebGL。未测新入口的 Quest 镜片或性能。

**演员画风（v5）：**本地导入 PMX 所在的完整目录，包含原贴图和配套材质图。放到摄影地台 → 选中演员 → 旁边工具首页的「画风」选「仿终末地」。按原 PMX 材质标签与纹理用途配对，眼白／眉／嘴不按共用脸图误选；缺少合适的配套图保持 MMD。第一次选择才派专属 worker 解码，回到原 MMD 不重载演员、VMD 或物理。工作线程只回寄像素；房间在可见的 tracked draw、最终姿势确定后才切换。暂停 VMD 且关闭物理时也能切换，不必先续播。

**双报告验收：**[编译版同页下载回放](../scripts/webgpu-actor/floor-report-smoke.cjs)通过实际导出按钮读取 JSON，WebGPU 模拟显示给出每眼 232×230（图层 240×240）、72 Hz；WebGL 续场给出每眼 640×720、90 Hz。WebGPU 的可选刷新率请求始终不兑现时仍能进场、退出、导出实得值。这里故意用了不同显示条件，验证归属而非测速度。

**Quest 3S 真机（固定预览 7fd73aba，Browser 156.0.0.38.16）：**空场 WebGPU 有 90 个可见回调间隔、实际 120 Hz、每眼 1680×1760。放好洛茜，绑定 16.13 s《稳坦摇》、循环、开物理，从准备页续场，WebGPU 请求获准并启用 `webgpu`、`local-floor`，随后报 `device lost: A valid external Instance reference no longer exists.`，伴随 `Instance dropped in popErrorScope`。这次没有提交新的会话报告。随后同页 WebGL 从同一布局恢复：两眼实图可见演员、53 个采样窗均为一人播放且开物理，56.003 秒可见间隔，120 Hz、每眼 1680×1760；取中间 45 窗，回调 FPS 中位 61。合并 JSON 的 WebGPU 半份与先前空场报告完全相同，不能算播舞性能对照。测试为实机台架，未据此认定镜片舒适或触感。数据、截图和错误轨迹留在 `local-review/verification/quest-floor-ab/`。目前只定位到续场操作与设备丢失，尚未确认是着色器、内存还是设备／会话生命周期。

**早期回访（`8a4bd75`）：**玩家反馈预览页「挺正常的」。当时只有 WebGL XR 录制会话，不用补导出。另核过本地提弗洛斯的 `textures/face_t.bmp` 提示：睫毛和表情引用的自定义 toon 渐变确实缺失，脸部底色仍在，loader 会报告告警并使用默认渐变。无需阻断放置、忽略其他缺图或借用另一角色的文件。可在获得原 BMP 后从导入报告补绑。详情留 `local-review/verification/webgpu-floor-v5-player-feedback.md`。

**同机实戴补证与重入候选：**玩家在 `7fd73aba` 首进 WebGPU 后从原背包放下洛茜并切到仿终末地、切回 MMD；随后反馈正常退出再进 WebGPU 报 `device lost`，刷新后能加载 VMD。读到了本次独立 WebGPU 导出：38.975 秒、1517 个间隔、实际 120 Hz、每眼 1680×1760；19 个开物理且播舞的窗，GPU 裙摆、31–41 回调 FPS，MMD 和仿终末地都实际出现在角色窗口中。两次播舞没有同姿同画风的等长标记，不据此推算提速。重入候选只在准备页停放一份健康的渲染器与设备，停掉 RAF；XRSession、投影层、房间、输入、演员和物理依然逐场清理。设备已丢失、页面离开和异常退出均不复用。编译版已用两个不同的投影会话及交换的左右切片验证同一设备二次显示；需复核真机二次入场。

`game-floor-smoke.cjs <pmx> <vmd> --actor-style` 实际用射线在场内切换：同一 33.7 s 舞段暂停在 0.206 s，左右眼角色区域分别有 4,257／4,268 个像素变化（阈值 6／255），切回后两眼取样区域全部通道恢复。续播时切换仍保留同一 runtimeId 和动作，探针实取 1 套脸图、3 个衣料槽。证据 `local-review/verification/game-floor-v5.log`。这里的 MMD 是玩家切换前的舞台色彩档，不调整房间的曝光或灯光。

**历史回归夹具**：`/scripts/webgpu-actor/stage-room.html` 的 X/A 选样捷径只供旧双眼、布料与故障回放；正式游戏的操作不在这个页面上开发。已有多人或物件的摄影地台不会作为一人样板续场。

射线来自产品同款 XR store 的 `targetRaySpace`，落点、朝向、遮挡和确认由原 [`BackpackPlacement`](../src/mmdVrShowcase/backpack/BackpackPlacement.tsx) 处理。测试页只负责选样本和进出；脚印、放置规则和布局恢复无需再为正式游戏移植一遍。

`stage-smoke.cjs --placement-only` 用实际 PMX、桌面 GPU、模拟 XR 控制器和左右眼检查：X 只开草稿，地台外松手发出零条命令，有效点按住仍无演员，`selectend` 只提交一次；实得 (0.46, 0, −2.25)，双眼都有角色，退出并打开正式 WebGL 观看后原位恢复。

摄影地台已接正式 `usePlayerMovement` 和 `XROrigin`。同一帧先更新玩家原点，再做射线和接触取样；GPU 掌点和原生 Bullet 的掌指／握把都使用当前原点的世界矩阵。`--movement-only` 的桌面实绘：实际摇杆轴前行 0.80 m，再转 30°，检查提交的双眼，指向 (0,0,−1.85) 松手后角色落到该位置。原衣左掌＋右握把分侧托起 61.41／71.61 mm，撤左后 0.62／71.59 mm，双撤均回到空手基线 1 mm 以内。失追时 14 个输入槽停放，恢复时持续按住的转向杆没有额外转向。退出重进后演员仍在原落点，玩家回到入口。留样 `local-review/screenshots/webgpu-stage-walk/`。实际 Quest 的镜片、触觉和帧时仍未验。

开发宿主先用实际 `StageEnvironment` 提交双眼。拿到首帧才允许打开房间；`MmdVrStageContent` / `StageRoom` 消费原背包命令、持有演员和快照、推进原动作时钟。Three 的 XRManager 持有唯一的 XR 帧回调，手动推进此 Fiber 根时只传本次会话的帧和秒数。角色后端的创建、GPU 子步与读取眼图分开；显示路径不回读求解结果。首次空场默认开物理，恢复则沿用原快照；左 **Y** 切换房间原有的角色物理。

- **同一个暂停的演员。** [正式接线回归](../scripts/webgpu-actor/stage-smoke.cjs)以真实 PMX 和 33.7 s 身体 VMD 放置、播舞、暂停。`--paused-hands-only --plan …` 在 0.4 s 的原衣上重新定位原来两片三角面，分别对照空手、单左、单右、双手；逐阶段核对两眼最终颜色、完整蒙皮布面和 native 写回。双托左右 **63.45／70.69 mm**，撤左 **0.84／72.94 mm**，双撤 **−0.32／0.06 mm**（相对于同帧空手）。同一 runtimeId 续播、收回，活动物理计数归零。原图：`local-review/screenshots/webgpu-stage-held-dance/`。
- **真实分工和失败恢复。** 管线就绪后 343 个模型刚体中保留 55 个给 Bullet（29 个动态），288 个交给 GPU；计数不含后加的控制器／掌指／道具槽。模拟故障使 driver 初始化失败，343 个全留在 Bullet，GPU 子步为零，演员双眼仍可见。关闭再打开角色物理复用同一演员。拒权、首帧前取消及 15 秒无首帧超时均保住原布局；回到同页 WebGL 后原 PMX、VMD、摆位和暂停时刻均恢复。空摄影棚的正常与反序切片对照均匹配实眼位置，相同眼姿的颜色一致。这是桌面真实 GPU 与模拟 XR 的结果；可选玩家入口、Quest 镜片和实机帧率另验。
