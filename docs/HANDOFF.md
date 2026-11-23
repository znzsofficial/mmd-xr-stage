# 会话交接｜2026-11-23

[正式舞台](https://mmd-xr-stage.pages.dev) · [固定版 `ef638f8`](https://cac3f0c1.mmd-xr-stage.pages.dev) · [发布证据](./release-history.md) · [文档索引](./README.md)

**当前发布。** `ef638f8` 已上线，947 项测试通过；主域名入口及 273 份资源与验证构建一致。开启角色物理后的[手动摆姿裙腿修正](./performance/actor-tools-regression.md#手动体位的局部裙片修正)已在三种裙装、15 条换姿路径对照，旧版直腿表现保留；A、B 的深跪仍可见残留。选定的[外阴 C 材质](./performance/actor-tools-regression.md#外阴-c-版观察材质)已用于观察图和露出时的实体附件。屏幕／模拟 XR 均实走操作，Quest 持续性能仍待实戴。[六款快速体位](./gameplay/pose-and-body-states.md#快速体位)、[三款随身玩具](./gameplay/README.md#随身舞台特效)和[重力分工](./architecture/gravity.md)继续适用。

**星系接续。** [地平线与长跳对照](./scenery/opal-planet.md#从罗盘起飞七条往返风道)：触地恢复地面速度，松杆停住，大角度到站用短淡切。06 号牌两端已分别检查降低眼高时的读面与射线；[07 潮汐洞星](./scenery/opal-planet.md#潮汐洞星)改成非对称白垩崖口，水位、低道、高路、干台和倒影均保留。星系统一存布局，角色可摆在母星北台、菌圃台和洞内干台。

**演员玩法边界。** 「互动 → 插入」默认看子宫全貌。只在「卵子」手动新增卵子（默认零枚、最多三枚）与设置游戏概率（默认 60%）。实际体内正量留存且有未受精卵子才判定一次；改变观察部位或概率不会补判。玩法止于[融合或散开](./gameplay/pelvic-attachment.md#一次释放的受精演出)。主面板直接调支架深度，外阴图下调膜缘。阴道图按实测杆身撑开和回拢，阴道与宫腔分别显示实际存量。旧版生育日历和孕周不是当前玩法。

**性能优先级。** 最近分析的 [Quest 3S 报告](./performance/viewing-and-diagnostics.md#已有测量)是 11 月 22 日 14:41Z 的旧版教室：关／开物理播放中位 61／48 FPS，原生步进约 5.04 ms；首开物理 118 ms、泳池回教室 2.34 秒已确认缓存命中。32 MiB 缓存解决的是关物理重读 PMX，不是稳态提帧。少写 22 个运动学变换的 A/B 无可靠收益，未上线。若继续性能线，先[分测 Bullet 碰撞与约束求解](./performance/README.md#持续播放)。

**角色工具已交付：** [摆姿、胸型、泌乳](./gameplay/pose-and-body-states.md)与[骨盆附件](./gameplay/pelvic-attachment.md)共用屏幕／XR 舞台。「保存到角色」只存本页背包；受孕率直接生效，不提交身体草稿。乳房观察默认正面二次元外观，剖面和标注按需。已确认的美术方向看 [PRODUCT](../PRODUCT.md) 和 [DESIGN](../DESIGN.md)，实现入口看[舞台架构](./architecture.md)。

**演员 HUD 与舞台泌乳：** 控件用普通游戏的动作、状态、结果；成人同人风格靠角色反馈、画面与事件演出。互动用量即时记到演员；身体设置只编辑草稿参数。穿衣继续不绕过校准入口；[泌乳](./gameplay/stage-lactation-proposal.md)仍要求适配的皮肤出口和实测露出。美术试样、验收截图放本机 `local-review/`，图形验证串行运行。

**待真机。** 有北台反馈时，优先做[牌面斜看与点选](./performance/next-quest-export.md#北台仪表斜看与点选)。潮池月影的双眼观感、普通跨星落地后不按 Y 行走的舒适度、受精瞬间可读性、同屏互动帧率、抓点与震感也仍缺当前版佩戴反馈。[按问题选一趟](./performance/next-quest-export.md)；地台／草坪各 15 分钟的持续 72 FPS 另验。

**其余项目：** 16 景（10 个主入口）、13 件道具、[四幕玩法](./gameplay/README.md#四幕玩法)、[母星采谱与跳岛](./scenery/opal-planet.md)均已上线。本机 `local-review/README.md` 索引三裙型同帧对照、C 材质小图和实际模型照片。恋活卡因不接受逐卡手动导出而搁置；[Blender 角色包](./gameplay/blender-characters.md)已交付。

[双角色持具、撤出回流](./gameplay/pelvic-attachment.md#假阳具玩法候选尚未实现)、[灯影／霜岬回波](./gameplay/interactive-scene-studies.md)与[三个新景](./scenery/next-modeling-round.md#婚礼之后的新景候选未排期)未排期；[暂停物理休眠](./performance/README.md#回场与后续验收)先取证。

**审图与历史：** `c481760` 从当前分支撤下 12 张成人／解剖截图，保留普通场景图；未重写旧提交。后续审图及对照留在 Git 忽略的 `local-review/`；多人可并行写代码，浏览器、模拟双眼、全量测试和构建由一人错峰运行。`b756c7f` 仍保留较早的完整指南，例如 `git show b756c7f:docs/performance/next-quest-export.md`。
