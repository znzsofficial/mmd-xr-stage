# WebGPU / WebXR 核查（2026-11-17）

## 已确认

- [Meta Browser 146.0](https://developers.meta.com/horizon/downloads/package/browser/146.0)（2026-04-21）宣布实验性 WebGPU in WebXR。
- [Browser 150.1](https://developers.meta.com/horizon/downloads/package/browser/150.1) 增加实验性 WebGPU XR foveation；[152.1](https://developers.meta.com/vr/downloads/package/browser/152.1)（2026-10-02）增加实验性 composition layers，说明要求 `chrome://flags` 开启 webxr experiments。
- [Meta 发布索引](https://developers.meta.com/vr/release-notes/)列出的 156.0（2026-11-13）摘要写有 WebGPU in WebXR；本次未能获取其完整发布页，不能凭摘要判断所有设备是否默认开启、全部功能是否已取消实验标记。
- [W3C Binding 编辑草案](https://immersive-web.github.io/webxr-webgpu-binding/)需要 XR-compatible GPUAdapter、带 `webgpu` feature 的 session、XRGPUBinding 与投影层。`navigator.gpu` 存在不等于沉浸式 WebGPU 可用。
- 本仓安装的 Three r187 `src/renderers/common/XRManager.js` 已实现 `_initWebGPUSession` / `getWebGPUBinding`，并明确在 WebGPU XR 会话中禁用 multiview。

## 对本项目的意义

当前生产仍为 WebGLRenderer + WebXR。切换需要同时处理 renderer/session 创建、R3F/XR 兼容、MMD 材质增强 onBeforeCompile 到 TSL 的迁移、已有 self-shadow 降级补丁和 WebGL 回退。不是更换构造函数即可完成。

WebGPU 支持不代表这个项目自动更快；没有真实 Quest 3S 帧耗时、图层尺寸与左右眼材质对照，不承诺收益。未来实验分支必须检测 API 与实际 session 创建结果，并保留 WebGL 路径。当前 GUI 视觉更新不依赖 WebGPU，也不修改现有渲染后端。

## 11-25 后续计划：先做好底层，再切玩家入口

状态：方案与选型，尚未实施。正式舞台继续走 WebGL。可用一块地面、一个角色的本地开发入口调试；复用房间的演员、动作时钟与页面背包，调试夹具不随正式菜单发布。先交付一个结果：**在实际舞台比例下，自己的原衣角色由新后端画出来，能播同一支舞，画面可与现版直接比较。**

1. **先画演员，用原 Bullet 作对照。** 从房间现有加载路径注入模型加载选项、材质挂载和 GPU 预热。复用锁定 loader 的 `createMmdTslPipeline`，现有 Studio 的 `src/appModules/mmdStudio/mmdTslPipeline.ts` 是可参考的按需加载封装。由房间统一调度求值和绘制，别让 pipeline 再开一个渲染循环。固定镜头、姿势和灯光比较脸、发片透明排序、轮廓、表情与 UV；SDEF/QDEF 用同一肘膝在原始和摆放比例下比较。独立自阴影在当前 fork 降级，记作切换前的画面差异。
2. **验证计算结果进正式材质，再接裙摆。** Three r187 的 WebGPU 后端可接收现成的 XR-compatible `GPUDevice`；先用一个已知位移的裙节点证明计算输出能被角色正面和描边同帧读取，随后接 [PMX 裙链、碰撞许可](../experiments/gpu-cloth/rig.js)和[实际织面承托](../experiments/gpu-cloth/handPass.js)。优先用 Three 管理的 storage buffer；原生 WGSL 输出如何交给 TSL 材质是待验接口。若现有写法只能靠私有缓存互操作，先评估把最小写入 pass 改为 Three compute 节点。物理结果留在 GPU，形态和服装显隐仍由原演员管理。密裙、稀疏裙各跑同舞段暂停、双托、先后撤手和续播，看最终衣片及描边。
3. **先测 XR 接线，再决定切换。** 第一阶段已有演员后即可用内部入口冒烟双眼，尽早排除 `@react-three/xr`、Three XRManager 和现有会话绑定的冲突。每个会话只有一个帧循环和投影层所有者。集成后验证同背包放置、菜单射线、双手操作、退出和失败恢复，再查代表性布景的自定义着色器（如教室地面、小行星天幕）。按同机、同动作、相同实得刷新率和眼图尺寸与正式 WebGL 比慢帧；默认切换看常用场景画面及操作、真机帧时和回退均过关。一景一人的调试成果不自行触发切换。

**可复用的轮子：**[现用 loader 的 WebGPU 实现（固定提交）](https://github.com/znzsofficial/three-mmd-loader/tree/3ac1d8ef93fe85a9bb4463933aef4a5198bd259a/src/webgpu)提供 toon、轮廓和稀疏位置/UV 形态；[R3F 9.8.2 的 Canvas 工厂](https://github.com/pmndrs/react-three-fiber/blob/v9.8.2/docs/API/canvas.mdx)可异步初始化 renderer；[Three 的 GPU 布料示例](https://threejs.org/examples/webgpu_compute_cloth.html)示范计算和绘制共用缓冲；[WebXR 最小示例](https://immersive-web.github.io/webxr-samples/webgpu/vr-barebones.html)可隔离绑定问题。[three-simplecloth](https://github.com/bandinopla/three-simplecloth)适合有顶点色蒙版的 SkinnedMesh，抓取与球碰撞可参考；用户导入的 PMX 有自己的裙骨、关节和碰撞许可，主路径继续使用既有求解器。现阶段无需增加运行依赖或迁移引擎。外部示例的能力与本机集成验收分开记录。
