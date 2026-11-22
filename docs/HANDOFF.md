# 会话交接｜2026-11-22

[正式舞台](https://mmd-xr-stage.pages.dev) · [固定版 `fb03527`](https://5392cab4.mmd-xr-stage.pages.dev) · [发布证据](./release-history.md) · [文档索引](./README.md)

**当前发布。** `fb03527` 已上线；主域名入口及 236 份资源 SHA-256 与验证构建一致。手动支架可[录一段手法并回放](./gameplay/pelvic-attachment.md#用手动支架录下自己的节奏)；摆姿可固定双腕、转动上身。首次放支架、可往返衣柜的泌乳、角色接触表情及轻柔／圆隆观察图沿用上版流程。角色入口为[服装、互动、身体观察](./gameplay/actor-tools.md)。[实模与模拟双眼对照](./performance/actor-tools-regression.md)不等于 Quest 3S 光学和手感验收。

**接下来：**等玩家导出一份[新版 Quest JSON](./performance/next-quest-export.md)再判断优化优先级。摆姿和录放已实做；手腕射线选点的舒适度、头显里的实际帧率仍待硬件反馈。[角色工具续接页](./gameplay/next-actor-tools.md)

**角色工具已交付：** [摆姿、胸型、周期、泌乳](./gameplay/pose-and-body-states.md)与[骨盆附件](./gameplay/pelvic-attachment.md)共用屏幕／XR 舞台。三主栏共用当前角色草稿，切栏不保存；「保存到角色」只存本页背包。乳房观察默认正面二次元外观，剖面和标注按需；图可在不支持胸型变形的 PMX 上使用。已确认的美术方向看 [PRODUCT](../PRODUCT.md) 和 [DESIGN](../DESIGN.md)，实现入口看[舞台架构](./architecture.md)。

**演员 HUD 与舞台泌乳：** 互动用量即时记到演员，身体编辑器仍保留草稿和原有单次预演。穿衣继续不绕过校准入口；[泌乳](./gameplay/stage-lactation-proposal.md)则必须有适配的皮肤出口和实测露出，不支持时操作前即显示「仅数值」。水滴胸型 02 已批准并接入动态图；外阴有三种可切换外形，外侧软垫与内侧褶皱按偏压分别变形。美术试样、验收截图放本机 `local-review/`，图形验证只由一人串行运行。

**待真机：** [Quest 3S 分趟导出](./performance/next-quest-export.md)。优先测教室首开物理、泳池回教室；另趟看抓点、双眼文字、持棒震感；地台／草坪各 15 分钟才验持续 72 FPS。最近已分析的头显报告是 11 月 20 日 14:43Z，早于修复。[屏幕实模与模拟双眼](./performance/actor-tools-regression.md)已验，不必当成尚未做过；用户已确认小行星正常行走。

**其余项目：** 16 景（10 个主入口）、10 件道具、[四幕玩法](./gameplay/README.md#四幕玩法)、[母星采谱与跳岛](./scenery/opal-planet.md)均已上线。[双角色持具、撤出回流](./gameplay/pelvic-attachment.md#假阳具玩法候选尚未实现)、[灯影／霜岬回波](./gameplay/interactive-scene-studies.md)与[三个新景](./scenery/next-modeling-round.md#婚礼之后的新景候选未排期)未排期。恋活卡因不接受逐卡手动导出而搁置；[Blender 转换器](./gameplay/blender-characters.md)已交付；[暂停物理休眠](./performance/README.md#回场与后续验收)先取证。

**审图与历史：** `c481760` 从当前分支撤下 12 张成人／解剖截图，保留普通场景图；未重写旧提交。后续审图及对照留在 Git 忽略的 `local-review/`；多人可并行写代码，浏览器、模拟双眼、全量测试和构建由一人错峰运行。`b756c7f` 仍保留较早的完整指南，例如 `git show b756c7f:docs/performance/next-quest-export.md`。
