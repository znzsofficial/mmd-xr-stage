# 会话交接｜2026-11-23

[正式舞台](https://mmd-xr-stage.pages.dev) · [固定版 `45c8d5e`](https://7b96e1fc.mmd-xr-stage.pages.dev) · [发布证据](./release-history.md) · [文档索引](./README.md)

**当前发布。** `45c8d5e` 已上线，799 项测试通过；主域名入口及 247 份资源与构建一致。原角色首页未添加入口：衣柜内查漏件／换图，佩戴即启动，面板泌乳支持材质分片。外阴重做成共边曲面和可选膜缘；子宫图有卵子数、游戏概率、受精到着床和孕日演出。小行星普通移动支持踏印外捕获和着陆回正。原有阴道接触剖面、支架录放、固定腕和分侧乳量保留。见[角色玩法](./gameplay/actor-tools.md)、[美术与 HUD 评审](./gameplay/actor-flow-review.md)。

**性能优先级：**11 月 22 日 14:41Z [真机报告](./performance/viewing-and-diagnostics.md#已有测量)确认预热与动作缓存命中。新版本以 32 MiB 总预算复用在场 PMX 首次读取；两次关闭在预算内均零重读。稳态跳过重复运动学写入的 A/B 未带来可靠收益，不上线该候选；下一步分测 Bullet 碰撞与关节，再看真机和点选体验。

**角色工具已交付：** [摆姿、胸型、周期、泌乳](./gameplay/pose-and-body-states.md)与[骨盆附件](./gameplay/pelvic-attachment.md)共用屏幕／XR 舞台。三主栏共用当前角色草稿，切栏不保存；「保存到角色」只存本页背包。乳房观察默认正面二次元外观，剖面和标注按需；图可在不支持胸型变形的 PMX 上使用。已确认的美术方向看 [PRODUCT](../PRODUCT.md) 和 [DESIGN](../DESIGN.md)，实现入口看[舞台架构](./architecture.md)。

**演员 HUD 与舞台泌乳：** 控件用普通游戏的动作、状态、结果；成人同人风格靠角色反馈、画面与事件演出。互动用量即时记到演员；身体设置只编辑草稿参数。穿衣继续不绕过校准入口；[泌乳](./gameplay/stage-lactation-proposal.md)仍要求适配的皮肤出口和实测露出。美术试样、验收截图放本机 `local-review/`，图形验证串行运行。

**待真机：** [Quest 3S 分趟导出](./performance/next-quest-export.md)。新面板的光学可读性、自动支架和图的同屏帧率、抓点与震感尚待硬件检查；地台／草坪各 15 分钟才验持续 72 FPS。[屏幕实模与模拟双眼](./performance/actor-tools-regression.md)有独立证据；用户已确认小行星正常行走。

**其余项目：** 16 景（10 个主入口）、10 件道具、[四幕玩法](./gameplay/README.md#四幕玩法)、[母星采谱与跳岛](./scenery/opal-planet.md)均已上线。[双角色持具、撤出回流](./gameplay/pelvic-attachment.md#假阳具玩法候选尚未实现)、[灯影／霜岬回波](./gameplay/interactive-scene-studies.md)与[三个新景](./scenery/next-modeling-round.md#婚礼之后的新景候选未排期)未排期。恋活卡因不接受逐卡手动导出而搁置；[Blender 转换器](./gameplay/blender-characters.md)已交付；[暂停物理休眠](./performance/README.md#回场与后续验收)先取证。

**审图与历史：** `c481760` 从当前分支撤下 12 张成人／解剖截图，保留普通场景图；未重写旧提交。后续审图及对照留在 Git 忽略的 `local-review/`；多人可并行写代码，浏览器、模拟双眼、全量测试和构建由一人错峰运行。`b756c7f` 仍保留较早的完整指南，例如 `git show b756c7f:docs/performance/next-quest-export.md`。
