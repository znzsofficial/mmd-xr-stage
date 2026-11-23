# 会话交接｜2026-11-23

[正式舞台](https://mmd-xr-stage.pages.dev) · [固定版 `63b88ad`](https://2cedc07b.mmd-xr-stage.pages.dev) · [发布证据](./release-history.md) · [文档索引](./README.md)

**当前发布与停点。** 线上功能版是 `63b88ad`，880 项测试通过；主域名入口及 263 份资源与验证构建一致。`03eb11b` 是发布记录提交。母星打磨已交付，无在途实现；恢复会话从玩家的新反馈接，不用重做已通过的屏幕和模拟双眼回归。

**星系接续。** 报“面板穿模”先区分三台采谱读头、01–07 航线牌和贴地喷嘴；底座遮字与风迹扫字是两种问题。[修复对照、测试入口和证据范围](./scenery/opal-planet.md#北台仪表验证与维护)。06 [伞灯星／琥珀屿](./scenery/opal-planet.md#伞灯星和琥珀屿)、07 [潮汐洞星](./scenery/opal-planet.md#潮汐洞星)都已上线；星系统一存布局，角色可摆在母星北台、菌圃台和洞内干台。

**演员玩法边界。** 「互动 → 插入」里直接设置每位演员的游戏受孕率（默认 60%，可调 0–100%）。一次实际体内释放且有正量留存才独立判定；改变概率或重开观察不会重抽。玩法止于[受精或散开](./gameplay/pelvic-attachment.md#一次释放的受精演出)。旧版生育日历、着床和孕周已撤下，孕肚与胎体试样未发布。近看原键返回和事件回看是[未排期建议](./gameplay/actor-flow-review.md#仍值得看)。

**性能优先级。** 最近分析的 [Quest 3S 报告](./performance/viewing-and-diagnostics.md#已有测量)是 11 月 22 日 14:41Z 的旧版教室：关／开物理播放中位 61／48 FPS，原生步进约 5.04 ms；首开物理 118 ms、泳池回教室 2.34 秒已确认缓存命中。32 MiB 缓存解决的是关物理重读 PMX，不是稳态提帧。少写 22 个运动学变换的 A/B 无可靠收益，未上线。若继续性能线，先[分测 Bullet 碰撞与约束求解](./performance/README.md#持续播放)。

**角色工具已交付：** [摆姿、胸型、泌乳](./gameplay/pose-and-body-states.md)与[骨盆附件](./gameplay/pelvic-attachment.md)共用屏幕／XR 舞台。「保存到角色」只存本页背包；受孕率直接生效，不提交身体草稿。乳房观察默认正面二次元外观，剖面和标注按需。已确认的美术方向看 [PRODUCT](../PRODUCT.md) 和 [DESIGN](../DESIGN.md)，实现入口看[舞台架构](./architecture.md)。

**演员 HUD 与舞台泌乳：** 控件用普通游戏的动作、状态、结果；成人同人风格靠角色反馈、画面与事件演出。互动用量即时记到演员；身体设置只编辑草稿参数。穿衣继续不绕过校准入口；[泌乳](./gameplay/stage-lactation-proposal.md)仍要求适配的皮肤出口和实测露出。美术试样、验收截图放本机 `local-review/`，图形验证串行运行。

**待真机。** 有北台反馈时，优先做[牌面斜看与点选](./performance/next-quest-export.md#北台仪表斜看与点选)。潮池月影的双眼观感、普通跨星落地后不按 Y 行走的舒适度、受精瞬间可读性、同屏互动帧率、抓点与震感也仍缺当前版佩戴反馈。[按问题选一趟](./performance/next-quest-export.md)；地台／草坪各 15 分钟的持续 72 FPS 另验。

**其余项目：** 16 景（10 个主入口）、10 件道具、[四幕玩法](./gameplay/README.md#四幕玩法)、[母星采谱与跳岛](./scenery/opal-planet.md)均已上线。[双角色持具、撤出回流](./gameplay/pelvic-attachment.md#假阳具玩法候选尚未实现)、[灯影／霜岬回波](./gameplay/interactive-scene-studies.md)与[三个新景](./scenery/next-modeling-round.md#婚礼之后的新景候选未排期)未排期。恋活卡因不接受逐卡手动导出而搁置；[Blender 转换器](./gameplay/blender-characters.md)已交付；[暂停物理休眠](./performance/README.md#回场与后续验收)先取证。

**审图与历史：** `c481760` 从当前分支撤下 12 张成人／解剖截图，保留普通场景图；未重写旧提交。后续审图及对照留在 Git 忽略的 `local-review/`；多人可并行写代码，浏览器、模拟双眼、全量测试和构建由一人错峰运行。`b756c7f` 仍保留较早的完整指南，例如 `git show b756c7f:docs/performance/next-quest-export.md`。
