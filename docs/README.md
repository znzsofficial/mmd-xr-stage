# MMD XR Stage 文档

**会话压缩后接续：先读[交接页](./HANDOFF.md)，再读[下一轮角色工具：摆姿势与局部样式](./gameplay/next-actor-tools.md)。** 查某项是否已经上线，看[发布记录](./release-history.md)；查实际测过什么，看[角色工具回归](./performance/actor-tools-regression.md)；拿到头显报告后按[分趟验收说明](./performance/next-quest-export.md)分析。[舞台可见泌乳](./gameplay/stage-lactation-proposal.md)说明哪些模型能显示，以及为什么有时只更新充盈度。

| 要做什么 | 入口 |
|---|---|
| 导入、摆角色、观看、续场 | [文件与背包](./gameplay/asset-workflow.md) · [Blender 角色包](./gameplay/blender-characters.md) · [屏幕键鼠](./gameplay/screen-viewing.md) · [VR 控制](./gameplay/vr-controls.md) |
| 编辑已上场的角色 | [服装、互动与身体观察](./gameplay/actor-tools.md) · [摆姿](./gameplay/pose-and-body-states.md#从站姿调成坐姿) · [胸型与观察](./gameplay/pose-and-body-states.md#先看模型上的胸型变化) · [周期](./gameplay/pose-and-body-states.md#对照两个周期日) · [泌乳效果](./gameplay/pose-and-body-states.md#泌乳目前能看到什么) · [支架与附件](./gameplay/pelvic-attachment.md) |
| 找道具、手柄震动或互动玩法 | [道具接触与手柄震动](./gameplay/README.md#道具接触与手柄震动) · [已上线的四幕](./gameplay/README.md#四幕玩法) · [互动提案](./gameplay/interactive-scene-studies.md) |
| 选地图、机位或步行路线 | [布景索引](./scenery/README.md) · [深空与风道](./scenery/opal-planet.md) · [校园环线](./scenery/campus-arcade-loop.md) · [喜院到秦淮](./scenery/jiangnan-river-street.md) |
| 验收与查卡顿 | [下次 Quest 导出](./performance/next-quest-export.md) · [角色工具本机回归](./performance/actor-tools-regression.md) · [性能优先级](./performance/README.md) · [历次真机报告](./performance/viewing-and-diagnostics.md#已有测量) |
| 改代码或加布景 | [舞台架构](./architecture.md) · [新布景与连接](./scenery/adding-a-set.md) · [美术样板](./scenery/art-direction.md) · [引擎取舍](./three-tooling.md) |

## 工程维护

[产品约束](../PRODUCT.md) · [视觉约定](../DESIGN.md) · [代理指南](../AGENTS.md) · [XR 会话](./xr-session-lifecycle.md) · [loader 补丁](./three-mmd-loader-maintenance.md) · [部署](./deployment.md) · [第三方声明](./THIRD_PARTY_NOTICES.md)

[角色工具收尾审查](./structure-review-2026-11-22.md) · [前一轮五项结构审查](./structure-review-2026-11-20.md)。[拆分前路线图](./mmd-vr-showcase-roadmap.md)与 [WebGPU XR 调查](./webgpu-xr-status.md)供追溯，不作当前排期。
