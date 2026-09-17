# MMD XR Stage — 文档索引

| 文档 | 内容 |
|------|------|
| [mmd-vr-showcase-roadmap.md](./mmd-vr-showcase-roadmap.md) | VR 展示器路线图（优先） |
| [asset-workflow.md](./asset-workflow.md) | ZIP/文件夹导入检查、同页继续舞台与重新开始 |
| [viewing-and-diagnostics.md](./viewing-and-diagnostics.md) | 精简观看 HUD 与画质诊断数据的来源、限制 |
| [three-mmd-loader-maintenance.md](./three-mmd-loader-maintenance.md) | three-mmd-loader 本地补丁、根因与升级收尾步骤 |
| [deployment.md](./deployment.md) | Pages 部署路径与 wrangler ≥4.130 代理委托坑 |
| [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) | Bullet 运行时第三方声明 |

## 快速约定

| 域 | 成片 / 默认 |
|----|-------------|
| 准备页 | DOM + CSS tokens（prep 页即根路径） |
| **src/xr** | 进入 / pending attach / 探测 / quality 轴 / session 工厂（单产品面独占） |
| MMD VR 展示器 | **WebGL + WebXR**（Quest 优先）；物理/震动实验默认关 |
| MSAA | three 0.186 XRProjectionLayer + renderer `antialias: true`（走 `antialiasPref` 轴） |
