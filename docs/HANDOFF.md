# 会话交接｜2026-11-24

[正式舞台](https://mmd-xr-stage.pages.dev) · [固定版 `3fced36`](https://4ace7a30.mmd-xr-stage.pages.dev) · [发布证据](./release-history.md) · [文档索引](./README.md)

**当前发布。** `3fced36` 已上线，964 项测试通过；主域名入口及 284 份资源与验证构建一致。外阴观察现在显示有深浅的入口内壁；默认子宫全貌显示实测杆身、软壁让位与撤回。角色身上的可选附件仍默认关闭。屏幕实模和模拟 XR 已实走进退及自动往复；新图仍待实戴。[六款基础、四款挑逗体位](./gameplay/pose-and-body-states.md#快速体位)、屏幕近看返回原机位与卵子结果只读回看继续适用。

**实戴反馈。** 已收 11 月 23 日 15:11Z 报告：姿势初看可以，未逐一验证；裙腿仍穿但有所减轻；外阴配色可以。玩家指出观察图的入口内部没有深度，子宫全貌里只有轴线在动。个别裙装后续优先按可见侧、衣层、刚到位还是停住来定位；不采用在 C 初跪时变差的小腿修正组合，见[分层证据与取舍](./performance/actor-tools-regression.md#手动体位的局部裙片修正)。

**架构接续。** [第一次局部整理](./architecture/maintenance.md#已拆出的三个入口)完成。新增演员显示效果从 `actorPoseDisplay.ts` 接入；移除／显隐／变换归 `roomModelCommands.ts`；XR 资产详情与加载恢复页已移出公共 HUD。运行时仍拥有物理时钟，只有当前房间可以消费命令。后续可回到实际玩法，不必继续按文件大小拆分。

**星系接续。** [地平线与长跳对照](./scenery/opal-planet.md#从罗盘起飞七条往返风道)：触地恢复地面速度，松杆停住，大角度到站用短淡切。06 号牌两端已分别检查降低眼高时的读面与射线；[07 潮汐洞星](./scenery/opal-planet.md#潮汐洞星)改成非对称白垩崖口，水位、低道、高路、干台和倒影均保留。星系统一存布局，角色可摆在母星北台、菌圃台和洞内干台。

**演员玩法边界。** 「互动 → 插入」默认看子宫全貌。只在「卵子」手动新增卵子（默认零枚、最多三枚）与设置游戏概率（默认 60%）。实际体内正量留存且有未受精卵子才判定一次；改变观察部位或概率不会补判。玩法止于[融合或散开](./gameplay/pelvic-attachment.md#一次释放的受精演出)。主面板直接调支架深度，外阴图下调膜缘。阴道图按实测杆身撑开和回拢，阴道与宫腔分别显示实际存量。旧版生育日历和孕周不是当前玩法。

**性能优先级。** 最新[真机互动短测](./performance/viewing-and-diagnostics.md#已有测量)在琉璃小行星，阴影开、动作暂停；单人无支架无图关／开物理窗口中位 67／30 FPS，开物理且支架运行并显示图的 28 窗中位 20.5 FPS，非锁机位对照。一次图 tick 峰值 120.7 ms，缺观察部位和 Worker/GPU 时间；无图时物理也慢。[原生 Bullet 桌面分段](./performance/bullet-step-profile.md)仅作调查方向，不换算为头显耗时。

**角色工具已交付：** [摆姿、胸型、泌乳](./gameplay/pose-and-body-states.md)与[骨盆附件](./gameplay/pelvic-attachment.md)共用屏幕／XR 舞台。「保存到角色」只存本页背包；受孕率直接生效，不提交身体草稿。乳房观察默认正面二次元外观，剖面和标注按需。已确认的美术方向看 [PRODUCT](../PRODUCT.md) 和 [DESIGN](../DESIGN.md)，实现入口看[舞台架构](./architecture.md)。

**演员 HUD 与舞台泌乳：** 控件用普通游戏的动作、状态、结果；成人同人风格靠角色反馈、画面与事件演出。互动用量即时记到演员；身体设置只编辑草稿参数。穿衣继续不绕过校准入口；[泌乳](./gameplay/stage-lactation-proposal.md)仍要求适配的皮肤出口和实测露出。美术试样、验收截图放本机 `local-review/`，图形验证串行运行。

**其他待真机项。** 有北台反馈时做[牌面斜看与点选](./performance/next-quest-export.md#北台仪表斜看与点选)。潮池月影、跨星着陆舒适度、受精瞬间可读性、抓点与震感仍待实戴。已有星球同屏互动短测，若做性能归因还需控制机位、支架和图窗。[按问题选一趟](./performance/next-quest-export.md)；地台／草坪各 15 分钟的持续 72 FPS 另验。

**其余项目：** 16 景（10 个主入口）、13 件道具、[四幕玩法](./gameplay/README.md#四幕玩法)、[母星采谱与跳岛](./scenery/opal-planet.md)均已上线。本机 `local-review/README.md` 索引三裙型同帧对照、C 材质小图和实际模型照片。恋活卡因不接受逐卡手动导出而搁置；[Blender 角色包](./gameplay/blender-characters.md)已交付。

[双角色持具、撤出回流](./gameplay/pelvic-attachment.md#假阳具玩法候选尚未实现)、[灯影／霜岬回波](./gameplay/interactive-scene-studies.md)与[三个新景](./scenery/next-modeling-round.md#婚礼之后的新景候选未排期)未排期；[暂停物理休眠](./performance/README.md#回场与后续验收)先取证。

**审图与历史：** `c481760` 从当前分支撤下 12 张成人／解剖截图，保留普通场景图；未重写旧提交。后续审图及对照留在 Git 忽略的 `local-review/`；多人可并行写代码，浏览器、模拟双眼、全量测试和构建由一人错峰运行。`b756c7f` 仍保留较早的完整指南，例如 `git show b756c7f:docs/performance/next-quest-export.md`。
