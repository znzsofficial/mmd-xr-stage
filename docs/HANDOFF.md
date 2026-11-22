# 会话交接｜2026-11-22

[正式舞台](https://mmd-xr-stage.pages.dev) · [固定版 `5bc0d37`](https://24f5de9c.mmd-xr-stage.pages.dev) · [发布证据](./release-history.md) · [文档索引](./README.md)

**当前发布。** `5bc0d37` 已上线，679 项测试通过；主域名入口及 229 份资源 SHA-256 与验证构建一致。所有舞台 HUD 统一深梅紫、象牙字和金色边线。角色入口仍是[服装、互动、身体观察](./gameplay/actor-tools.md)。屏幕与模拟双眼的[实际验证范围](./performance/actor-tools-regression.md)不等于 Quest 3S 光学和手感验收。

**压缩后的第一步：**读[下一轮角色工具](./gameplay/next-actor-tools.md)。摆姿势增强、乳头与乳晕样式加强是用户明确要做的两项，具体姿势难点、样式款数和实施顺序待定。本轮停在整理文档；角色回应、手法回放是流程评审建议，并非已批准的下一版范围。

**角色工具已交付：** [摆姿、胸型、周期、泌乳](./gameplay/pose-and-body-states.md)与[骨盆附件](./gameplay/pelvic-attachment.md)共用屏幕／XR 舞台。三主栏共用当前角色草稿，切栏不保存；「保存到角色」只存本页背包。乳房观察默认正面二次元外观，剖面和标注按需；图可在不支持胸型变形的 PMX 上使用。已确认的美术方向看 [PRODUCT](../PRODUCT.md) 和 [DESIGN](../DESIGN.md)，实现入口看[舞台架构](./architecture.md)。

**演员 HUD 与舞台泌乳：** 互动用量即时记到演员，身体编辑器仍保留草稿和原有单次预演。穿衣继续不绕过校准入口；[泌乳](./gameplay/stage-lactation-proposal.md)则必须有适配的皮肤出口和实测露出，不支持时操作前即显示「仅数值」。水滴胸型 02 已批准并接入动态图；外阴有三种可切换外形，外侧软垫与内侧褶皱按偏压分别变形。美术试样、验收截图放本机 `local-review/`，图形验证只由一人串行运行。

**待真机：** [Quest 3S 分趟导出](./performance/next-quest-export.md)。优先测教室首开物理、泳池回教室；另趟看抓点、双眼文字、持棒震感；地台／草坪各 15 分钟才验持续 72 FPS。最近已分析的头显报告是 11 月 20 日 14:43Z，早于修复。[屏幕实模与模拟双眼](./performance/actor-tools-regression.md)已验，不必当成尚未做过；用户已确认小行星正常行走。

**其余项目：** 16 景（10 个主入口）、10 件道具、[四幕玩法](./gameplay/README.md#四幕玩法)、[母星采谱与跳岛](./scenery/opal-planet.md)均已上线。[支架手法回放、双角色持具、撤出回流](./gameplay/pelvic-attachment.md#假阳具玩法候选尚未实现)、[灯影／霜岬回波](./gameplay/interactive-scene-studies.md)与[三个新景](./scenery/next-modeling-round.md#婚礼之后的新景候选未排期)未排期。恋活卡因不接受逐卡手动导出而搁置；[Blender 转换器](./gameplay/blender-characters.md)已交付；[暂停物理休眠](./performance/README.md#回场与后续验收)先取证。

**审图与历史：** `c481760` 从当前分支撤下 12 张成人／解剖截图，保留普通场景图；未重写旧提交。后续审图及对照留在 Git 忽略的 `local-review/`；多人可并行写代码，浏览器、模拟双眼、全量测试和构建由一人错峰运行。`b756c7f` 仍保留较早的完整指南，例如 `git show b756c7f:docs/performance/next-quest-export.md`。
