# 会话交接｜2026-11-22

[正式舞台](https://mmd-xr-stage.pages.dev) · [固定版 `5c24a0d`](https://30572523.mmd-xr-stage.pages.dev) · [发布证据](./release-history.md) · [文档索引](./README.md)

**压缩会话后从这里接。** `master` 的线上功能基线是 `5c24a0d`；`b756c7f` 为发布记录，`6c0bb19` 起的本轮交接整理只改文档。没有等着发布的角色工具代码。该正式包 634 项测试通过，主域名入口与 185 份文件哈希一致。详细数值按[对应发布](./release-history.md)读，不当作真机成绩。

**角色工具已交付：** [摆姿、胸型、周期、泌乳](./gameplay/pose-and-body-states.md)与[骨盆附件](./gameplay/pelvic-attachment.md)共用屏幕／XR 舞台。三主栏共用当前角色草稿，切栏不保存；「保存到角色」只存本页背包。乳房观察默认正面二次元外观，剖面和标注按需；图可在不支持胸型变形的 PMX 上使用。已确认的美术方向看 [PRODUCT](../PRODUCT.md) 和 [DESIGN](../DESIGN.md)，实现入口看[舞台架构](./architecture.md)。

**演员 HUD 与舞台泌乳：** 点场上的角色直接进工具页；身体草稿可收起看舞台，再回原栏。泌乳页就地显示两侧读数及上次真实扣量，也可直达乳房观察。[按钮版液滴](./gameplay/stage-lactation-proposal.md)要求有适配形态的实际皮肤出口；普通身体材质需玩家分侧确认露出，遮挡或无法识别则只改存量。没有触碰触发或按存量分侧胀缩。私模路径只查项目记忆；模型、可识别照片、原始头显报告不入仓。

**待真机：** [Quest 3S 分趟导出](./performance/next-quest-export.md)。优先测教室首开物理、泳池回教室；另趟看抓点、双眼文字、持棒震感；地台／草坪各 15 分钟才验持续 72 FPS。最近已分析的头显报告是 11 月 20 日 14:43Z，早于修复。[屏幕实模与模拟双眼](./performance/actor-tools-regression.md)已验，不必当成尚未做过；用户已确认小行星正常行走。

**其余项目：** 16 景（10 个主入口）、10 件道具、[四幕玩法](./gameplay/README.md#四幕玩法)、[母星采谱与跳岛](./scenery/opal-planet.md)均已上线。[支架手法回放、双角色持具、撤出回流](./gameplay/pelvic-attachment.md#假阳具玩法候选尚未实现)、[灯影／霜岬回波](./gameplay/interactive-scene-studies.md)与[三个新景](./scenery/next-modeling-round.md#婚礼之后的新景候选未排期)未排期。恋活卡因不接受逐卡手动导出而搁置；[Blender 转换器](./gameplay/blender-characters.md)已交付；[暂停物理休眠](./performance/README.md#回场与后续验收)先取证。

**追溯整理前原文：** `b756c7f` 保留本次文档精简前的完整指南。例如 `git show b756c7f:docs/performance/next-quest-export.md` 可读当时的全部测试步骤，不必从聊天找回。
