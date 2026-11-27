# MMD XR Stage 文档

**会话压缩后先读[交接页](./HANDOFF.md)。** 查线上功能看[发布记录](./release-history.md)；想接着改善体验看[流程与 HUD 评审](./gameplay/actor-flow-review.md)，想查帧率看[性能优先级](./performance/README.md)。[角色工具回归](./performance/actor-tools-regression.md)记录实模和模拟双眼测到了什么，[下次 Quest 导出](./performance/next-quest-export.md)列出仍缺的真机证据。

| 要做什么 | 入口 |
|---|---|
| 从哪里进 WebGPU，哪些功能要用 WebGL | [当前正式版：入口、玩法和后端选择](./webgpu-xr-status.md#当前正式版) |
| 导入、摆角色、观看、续场 | [文件与背包](./gameplay/asset-workflow.md) · [Blender 角色包](./gameplay/blender-characters.md) · [屏幕键鼠](./gameplay/screen-viewing.md) · [VR 控制](./gameplay/vr-controls.md) |
| 编辑已上场的角色 | [服装、互动与身体观察](./gameplay/actor-tools.md) · [快速体位](./gameplay/pose-and-body-states.md#快速体位) · [手动调关节](./gameplay/pose-and-body-states.md#从站姿调成坐姿) · [胸型与观察](./gameplay/pose-and-body-states.md#先看模型上的胸型变化) · [泌乳效果](./gameplay/pose-and-body-states.md#泌乳目前能看到什么) · [支架与附件](./gameplay/pelvic-attachment.md) |
| 查裙摆掉回腿间、侧髋或深跪穿模 | [微调后的前幅、深跪小腿与黑斑反例](./performance/pose-cloth-contact.md) · [仰卧侧边与腰饰](./performance/supine-side-skirt.md) · [三种裙型的早期对照](./performance/actor-tools-regression.md#手动体位的局部裙片修正) · [Quest 短测](./performance/next-quest-export.md#裙摆与外阴近景) |
| 查外阴观察与舞台附件 | [衣下开启附件及原模开合](./gameplay/actor-tools.md) · [自然款外形、肉色与粉红配色](./performance/actor-tools-regression.md#自然款外形与原模开合) |
| 看互动结果或找回审图 | [日常观察／手动孕态参考](./gameplay/observation-reference.md) · [插入：游戏受孕率与一次释放的受精演出](./gameplay/pelvic-attachment.md#一次释放的受精演出) · [分侧泌乳与遮挡](./gameplay/stage-lactation-proposal.md) · [角色工具与本机审图索引](./gameplay/next-actor-tools.md) |
| 查旧版孕期做到哪里 | [旧生育进程与孕期试样](./release-history.md#旧生育进程与孕期试样)：旧源码、孕日 35 的实测，以及未发布样张的查找入口 |
| 找道具、手柄震动或互动玩法 | [星图、彩带、水母花火](./gameplay/README.md#随身舞台特效) · [道具接触与手柄震动](./gameplay/README.md#道具接触与手柄震动) · [已上线的四幕](./gameplay/README.md#四幕玩法) · [互动提案](./gameplay/interactive-scene-studies.md) |
| 选地图、机位或步行路线 | [布景索引](./scenery/README.md) · [深空与风道](./scenery/opal-planet.md) · [校园环线](./scenery/campus-arcade-loop.md) · [喜院到秦淮](./scenery/jiangnan-river-street.md) |
| 复查北台面板穿模 | [罗盘修复前后实景](./screenshots/north-instruments.webp) · [六条风道与操作](./scenery/opal-planet.md#从罗盘起飞六条往返风道) · [几何与实点证据](./scenery/opal-planet.md#北台仪表验证与维护) · [Quest 3S 短测](./performance/next-quest-export.md#北台仪表斜看与点选) |
| 验收与查卡顿 | [下次 Quest 导出](./performance/next-quest-export.md) · [角色工具本机回归](./performance/actor-tools-regression.md) · [性能优先级](./performance/README.md) · [历次真机报告](./performance/viewing-and-diagnostics.md#已有测量) |
| 接续 11 月 25 日真机反馈 | [眼高与母星侧倾、布料黑屏、Bullet 与手动裙面的分工](./performance/quest-2026-11-25.md) · [loader 历史排障](./three-mmd-loader-history.md) |
| 查场景本身的开销 | [泳池计时台、教室窗边与后门](./performance/pool-classroom.md) · [星门、庭院阴影、远月与菌圃](./performance/scenery-render-work.md) · [用固定版本做 Quest 对照](./performance/next-quest-export.md#泳池或教室同机位真机对照) |
| 改代码或加布景 | [源码目录](./architecture.md#源码目录) · [舞台架构](./architecture.md) · [要不要重构](./architecture/maintenance.md) · [重力场、马达与新道具](./architecture/gravity.md) · [新布景与连接](./scenery/adding-a-set.md) · [美术样板](./scenery/art-direction.md) · [引擎取舍](./three-tooling.md) |
| 查 loader 版本、特性归属与上游 PR | [舞台、fork 和官方使用的版本](./three-mmd-loader-maintenance.md#仓库与依赖) · [上游贡献与分支](./three-mmd-loader-upstream.md) |

## 工程维护

[产品约束](../PRODUCT.md) · [视觉约定](../DESIGN.md) · [代理指南](../AGENTS.md) · [XR 会话](./xr-session-lifecycle.md) · [loader 补丁](./three-mmd-loader-maintenance.md) · [部署](./deployment.md) · [第三方声明](./THIRD_PARTY_NOTICES.md)

[角色工具收尾审查](./structure-review-2026-11-22.md) · [前一轮五项结构审查](./structure-review-2026-11-20.md)。[拆分前路线图](./mmd-vr-showcase-roadmap.md)与 [WebGPU XR 调查](./webgpu-xr-status.md)供追溯，不作当前排期。
