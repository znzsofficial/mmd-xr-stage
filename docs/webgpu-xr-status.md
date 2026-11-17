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
