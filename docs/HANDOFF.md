# 会话交接｜2026-11-23

[正式舞台](https://mmd-xr-stage.pages.dev) · [固定版 `754ffb5`](https://eed3526f.mmd-xr-stage.pages.dev) · [发布证据](./release-history.md) · [文档索引](./README.md)

**当前发布。** `754ffb5` 已上线，845 项测试通过；主域名入口及 256 份资源与构建一致。「互动 → 插入」直接设置本演员的游戏受孕率（默认 60%）。只在一次实际体内释放且有正量留存时独立判定；左侧子宫镜显示游近、围拢、单枚融合或散开。已移除周期日历、生育菜单、着床和孕日推进；孕肚和胎体试样未发布。体型与泌乳仍为独立设置。见[当前玩法](./gameplay/actor-tools.md)和[实测](./performance/actor-tools-regression.md#按实际释放判定受精)。

**停点：**新互动方向止于受精，不再扩展生理周期或孕期管理。Quest 3S 下一趟可看插入页受精瞬间是否清晰，或回访[伞灯星与琥珀屿](./scenery/opal-planet.md)检验普通跳回落和站稳后的舒适度。若继续性能线，读[持续播放的证据与下一项测量](./performance/README.md#持续播放)。

**性能优先级：**11 月 22 日 14:41Z [Quest 3S 报告](./performance/viewing-and-diagnostics.md#已有测量)早于当前发布：教室关／开物理播放中位 61／48 FPS，原生求解约 5.04 ms；首开物理 118 ms、泳池回教室 2.34 秒已测到预热与动作缓存命中。本版 32 MiB 缓存解决的是**关物理重读 PMX**，本地两次关闭均零重读，真机切换耗时尚未复测。少写 22 个运动学变换的 A/B 没有可靠提帧，不上线；下一步区分 Bullet 的碰撞检测与约束求解。

**角色工具已交付：** [摆姿、胸型、泌乳](./gameplay/pose-and-body-states.md)与[骨盆附件](./gameplay/pelvic-attachment.md)共用屏幕／XR 舞台。「保存到角色」只存本页背包；受孕率直接生效，不提交身体草稿。乳房观察默认正面二次元外观，剖面和标注按需。已确认的美术方向看 [PRODUCT](../PRODUCT.md) 和 [DESIGN](../DESIGN.md)，实现入口看[舞台架构](./architecture.md)。

**演员 HUD 与舞台泌乳：** 控件用普通游戏的动作、状态、结果；成人同人风格靠角色反馈、画面与事件演出。互动用量即时记到演员；身体设置只编辑草稿参数。穿衣继续不绕过校准入口；[泌乳](./gameplay/stage-lactation-proposal.md)仍要求适配的皮肤出口和实测露出。美术试样、验收截图放本机 `local-review/`，图形验证串行运行。

**待真机：**下次只按要判断的问题[选一趟测](./performance/next-quest-export.md)：受精瞬间在镜片边缘是否看得清、边看边操作的帧率、跳蛋手感与抓点；普通跨星触地后不按 Y 能否走、视野转向是否舒适。地台／草坪各 15 分钟另验持续 72 FPS。模拟器不能代替上述佩戴反馈。

**其余项目：** 16 景（10 个主入口）、10 件道具、[四幕玩法](./gameplay/README.md#四幕玩法)、[母星采谱与跳岛](./scenery/opal-planet.md)均已上线。[双角色持具、撤出回流](./gameplay/pelvic-attachment.md#假阳具玩法候选尚未实现)、[灯影／霜岬回波](./gameplay/interactive-scene-studies.md)与[三个新景](./scenery/next-modeling-round.md#婚礼之后的新景候选未排期)未排期。恋活卡因不接受逐卡手动导出而搁置；[Blender 转换器](./gameplay/blender-characters.md)已交付；[暂停物理休眠](./performance/README.md#回场与后续验收)先取证。

**审图与历史：** `c481760` 从当前分支撤下 12 张成人／解剖截图，保留普通场景图；未重写旧提交。后续审图及对照留在 Git 忽略的 `local-review/`；多人可并行写代码，浏览器、模拟双眼、全量测试和构建由一人错峰运行。`b756c7f` 仍保留较早的完整指南，例如 `git show b756c7f:docs/performance/next-quest-export.md`。
