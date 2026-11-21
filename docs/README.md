# MMD XR Stage 文档

**恢复会话先读[交接页](./HANDOFF.md)。** 想直接体验可打开[线上舞台](https://mmd-xr-stage.pages.dev)：导入自己的模型和动作，再选屏幕观看或 VR。

| 我想做什么 | 从这里开始 |
|---|---|
| 从小行星起飞、参观礼案近景 | [罗盘风口、两颗可登陆卫星与返航](./scenery/opal-planet.md) · [双喜堂的喜幔、婚书与合卺礼器](./scenery/wedding-court.md) |
| 在布景间走一圈，沿路摆角色 | [校园、电玩厅和泳池环线](./scenery/campus-arcade-loop.md) · [双喜堂到秦淮的河街](./scenery/jiangnan-river-street.md) |
| 进新地图、在同一大厅的上下两层摆人 | [屏幕直达电玩厅](https://mmd-xr-stage.pages.dev/?set=arcadeHall&view=screen) · [洞口换层、外平台与贴图机位](./scenery/arcade-hall.md) |
| 下次戴 Quest 先测什么 | [小星球从进门就能否行走、转向](./scenery/opal-planet.md) · [教室：同一大动作回场、首次开物理](./performance/next-quest-export.md) |
| 查手持道具在哪里生效、怎样递给角色 | [玩法与道具](./gameplay/README.md)：四幕玩法、逐件用法、屏幕／VR 操作 |
| 放置角色、播放动作或恢复上次摆法 | [导入与续场](./gameplay/asset-workflow.md) · [屏幕观看](./gameplay/screen-viewing.md) · [VR 控制](./gameplay/vr-controls.md) |
| 选布景、找机位、改模型或重做贴图 | [建模与布景](./scenery/README.md) · [新增房间与连接](./scenery/adding-a-set.md) · [实景截图](../README.md#stage-gallery) |
| 逛喜院、步行去门诊、给两位角色取景 | [双喜堂双人机位](./scenery/wedding-court.md) · [教室、泳池、门诊的三处新入口](./scenery/campus-garden-routes.md) · [情侣套房与双人私汤](./scenery/private-retreats.md) |
| 进帐看角色、登楼、自己布光或取石厅远景 | [喜房与两层帐](./scenery/wedding-court.md) · [月蘅馆](./scenery/qinhuai.md) · [黑绒私摄棚](./scenery/velvet-studio.md) · [中世纪刑讯室](./scenery/medieval-chamber.md) |
| 查播放掉帧、切换物理或回场加载慢 | [下一轮优先级与验收](./performance/README.md) · [Quest 测量记录](./performance/viewing-and-diagnostics.md#已有测量) · [放置与回场字段](./performance/viewing-and-diagnostics.md#放置耗时从松开扳机开始算) · [桌面基准与回归](./performance/xr-runtime-performance.md) |

## 工程维护

[现成工具取舍](./three-tooling.md) · [琉璃小行星](./scenery/opal-planet.md) · [MMD 亮部修正与实图指标](./scenery/model-highlight-color.md)

[舞台代码架构：文件、观看会话、当前房间分别归谁管理](./architecture.md)。包含一次放置的走读，以及设置、布景、灯光、角色运行时的修改入口。

[维护审查与修复记录](./structure-review-2026-11-20.md)：五项已落实，含物理重建中退出时保存的开关值与真实背包移动回归。

[产品约束](../PRODUCT.md) · [视觉约定](../DESIGN.md) · [代理维护指南](../AGENTS.md) · [XR 会话生命周期](./xr-session-lifecycle.md) · [loader 补丁与升级](./three-mmd-loader-maintenance.md) · [WebGPU XR 调查](./webgpu-xr-status.md) · [部署](./deployment.md) · [第三方声明](./THIRD_PARTY_NOTICES.md)

追溯功能看[发布里程碑](./release-history.md)；[拆分前路线图](./mmd-vr-showcase-roadmap.md)是历史资料。新增资料按主题放入 `gameplay/`、`scenery/` 或 `performance/`；交接页只更新线上基线、下一步和验证入口。
