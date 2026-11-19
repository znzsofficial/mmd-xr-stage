# MMD XR Stage 文档

**恢复会话先读[交接页](./HANDOFF.md)。** 想直接体验可打开[线上舞台](https://mmd-xr-stage.pages.dev)：导入自己的模型和动作，再选屏幕观看或 VR。

| 我想做什么 | 从这里开始 |
|---|---|
| 确认昨天的道具有没有做，或找玩法入口 | [玩法与道具](./gameplay/README.md)：四幕发布状态、屏幕／VR 区别、真机验收项 |
| 放置角色、播放动作或恢复上次摆法 | [导入与续场](./gameplay/asset-workflow.md) · [屏幕观看](./gameplay/screen-viewing.md) · [VR 控制](./gameplay/vr-controls.md) |
| 选布景、找机位、改模型或重做贴图 | [建模与布景](./scenery/README.md) · [实景截图](../README.md#stage-gallery) |
| 查卡顿、看数据或决定下一项优化 | [性能优先级](./performance/README.md) · [Quest 报告](./performance/viewing-and-diagnostics.md) · [桌面基准与回归](./performance/xr-runtime-performance.md) |

## 工程维护

[产品约束](../PRODUCT.md) · [视觉约定](../DESIGN.md) · [代理维护指南](../AGENTS.md) · [XR 会话生命周期](./xr-session-lifecycle.md) · [loader 补丁与升级](./three-mmd-loader-maintenance.md) · [WebGPU XR 调查](./webgpu-xr-status.md) · [部署](./deployment.md) · [第三方声明](./THIRD_PARTY_NOTICES.md)

追溯功能看[发布里程碑](./release-history.md)；[拆分前路线图](./mmd-vr-showcase-roadmap.md)是历史资料。新增资料按主题放入 `gameplay/`、`scenery/` 或 `performance/`；交接页只更新线上基线、下一步和验证入口。
