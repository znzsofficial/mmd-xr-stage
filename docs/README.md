# MMD XR Stage — 文档索引

## 从这里继续

- [恢复会话：交接与待办](./HANDOFF.md)：生产版本、已完成项、下一轮加载排查和 Quest 验收步骤。
- [拿头显测试：操作与导出](./viewing-and-diagnostics.md)：五分钟放置对照、持续观看及退出后保存 JSON。
- [产品约束](../PRODUCT.md)：Quest 3S、观看为主、手柄为主的确认需求。
- [VR GUI 设计系统](../DESIGN.md)：用户选定的浅瓷与墨蓝，仅适用于 VR HUD；是否已上线见交接文档。

专题文档描述实现与约束；旧路线图中的拆分前背景不代表当前已实现功能。版本和未发布状态以交接文档及 Git 为准。

| 文档 | 内容 |
|------|------|
| [mmd-vr-showcase-roadmap.md](./mmd-vr-showcase-roadmap.md) | 长期路线图与拆分前历史；近期执行顺序见 HANDOFF |
| [asset-workflow.md](./asset-workflow.md) | 导入预检、同页背包、空场进入与恢复布局 |
| [viewing-and-diagnostics.md](./viewing-and-diagnostics.md) | `modelWork` 放置分段、`heldToy` 窗口、回调间隔与桌面测量边界 |
| [three-mmd-loader-maintenance.md](./three-mmd-loader-maintenance.md) | three-mmd-loader 本地补丁、根因与升级收尾步骤 |
| [xr-runtime-performance.md](./xr-runtime-performance.md) | CCD IK 补丁与等价对照、裙摆抖动测量、手部碰撞及 Bullet 回归 |
| [xr-session-lifecycle.md](./xr-session-lifecycle.md) | XR 进入状态、取消、首帧、StrictMode 与资源所有权 |
| [vr-controls.md](./vr-controls.md) | 泡泡枪和盖印器的操作、五种布景的角色站位、菜单召回与手追 |
| [webgpu-xr-status.md](./webgpu-xr-status.md) | WebGPU XR 支持现状、来源与本项目迁移边界 |
| [deployment.md](./deployment.md) | Pages 部署路径与 wrangler ≥4.130 代理委托坑 |
| [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) | Bullet 运行时第三方声明 |

## 快速约定

| 域 | 成片 / 默认 |
|----|-------------|
| 准备页 | DOM + CSS tokens（prep 页即根路径） |
| **src/xr** | 进入 / pending attach / 探测 / quality 轴 / session 工厂（单产品面独占） |
| MMD VR 展示器 | **WebGL + WebXR**（Quest 优先）；物理/震动实验默认关 |
| MSAA | three r187 XRProjectionLayer + renderer `antialias: true`（走 `antialiasPref` 轴，r186 起支持） |
