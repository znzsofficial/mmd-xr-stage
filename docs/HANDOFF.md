# 会话交接｜2026-11-24

[正式舞台](https://mmd-xr-stage.pages.dev) · [固定版 `b80ade1`](https://ed9e72bb.mmd-xr-stage.pages.dev) · [发布证据](./release-history.md) · [文档索引](./README.md)

**当前发布与停点。** `b80ade1` 已上线，996 项测试通过；主域名入口及 305 份资源与验收构建的 SHA-256 一致。发布、推送和本机验收均已完成，无在途实现。下一步等这版的 Quest 反馈。上版 `a6b6edd` 是本轮裙摆对照的基线，也是[子宫参考图蜷睡肖像](./gameplay/observation-reference.md)的发布版。

**裙摆接续。** 先区分两个现象：① 仰卧抬腿后微调左膝，前裙曾重新掉回腿间；现版已在屏幕和模拟双眼验证松手后仍堆在小腹。② 未微调的普通抬腿，侧髋最深约 28 mm 的几何穿入仍在；强推会让衣边飘宽、穿得更深，未采用。分膝捧腿停 2 秒时外裙横穿面 53→18，里衬 39→0；这是[同帧蒙皮测量](./performance/supine-side-skirt.md)，不是露腿面积。稀疏裙从站立进四点跪撑最深 28.2→17.3 mm，从抬腿进跪则仍为 12.8 mm，见[换姿方向与黑斑反例](./performance/pose-cloth-contact.md)。这些结果只覆盖开物理的手动摆姿。

**下一次实戴。** 优先走[裙摆短测](./performance/next-quest-export.md#裙摆与外阴近景)：左膝 +10° 后看前幅；若切入屈膝或捧腿时有明显停顿，记姿势和顺序。实模桌面首次拟合约 55 ms，不能当成头显耗时。退出 VR 先导出 JSON 再重进。行星轻推、低顶与孕态参考的镜片观感可另趟反馈。

**上一次实戴（改图前）。** 11 月 23 日 15:11Z 的报告与玩家反馈均已记录：姿势初看可以，未逐一验证；外阴配色可以；入口显平、总览只有轴线是本次改图的原因。裙腿仍穿但有所减轻；再现时记录可见侧、衣层和是否停住后还穿。不采用在 C 初跪时变差的小腿修正组合，见[分层证据与取舍](./performance/actor-tools-regression.md#手动体位的局部裙片修正)。

**架构接续。** [第一次局部整理](./architecture/maintenance.md#已拆出的三个入口)完成。新增演员显示效果从 `actorPoseDisplay.ts` 接入；移除／显隐／变换归 `roomModelCommands.ts`；XR 资产详情与加载恢复页已移出公共 HUD。运行时仍拥有物理时钟，只有当前房间可以消费命令。后续可回到实际玩法，不必继续按文件大小拆分。

**星系接续。** [母星的轻推与满推](./performance/home-walk.md)、[贴坡和偏置低顶](./performance/orbital-skims.md)、[手动 Y、眼高与失追](./performance/planet-stance-input.md)已按原反例复核。风道／足印仍沿途带动视野，印外捕获不自动回正。整身粗筛与端点复用已落地，近切线的单次递归尖峰仍在；下一步读导出的 `planetMovement.shellWork`，先看真机实际游玩是否触发。[完整 CPU 对照](./performance/planet-shell-sweep.md)。

**演员玩法边界。** 「互动 → 插入」默认看子宫全貌。只在「卵子」手动新增卵子（默认零枚、最多三枚）与设置游戏概率（默认 60%）。实际体内正量留存且有未受精卵子才判定一次；改变观察部位或概率不会补判。玩法止于[融合或散开](./gameplay/pelvic-attachment.md#一次释放的受精演出)。主面板直接调支架深度，外阴图下调膜缘。阴道图按实测杆身撑开和回拢，阴道与宫腔分别显示实际存量。旧版生育日历和孕周不是当前玩法。

**性能优先级。** 最新[真机互动短测](./performance/viewing-and-diagnostics.md#已有测量)在琉璃小行星，阴影开、动作暂停；单人无支架无图关／开物理窗口中位 67／30 FPS，开物理且支架运行并显示图的 28 窗中位 20.5 FPS，非锁机位对照。一次图 tick 峰值 120.7 ms，缺观察部位和 Worker/GPU 时间；无图时物理也慢。[原生 Bullet 桌面分段](./performance/bullet-step-profile.md)仅作调查方向，不换算为头显耗时。

**角色工具已交付：** [摆姿、胸型、泌乳](./gameplay/pose-and-body-states.md)与[骨盆附件](./gameplay/pelvic-attachment.md)共用屏幕／XR 舞台。「保存到角色」只存本页背包；受孕率直接生效，不提交身体草稿。乳房观察默认正面二次元外观，剖面和标注按需。已确认的美术方向看 [PRODUCT](../PRODUCT.md) 和 [DESIGN](../DESIGN.md)，实现入口看[舞台架构](./architecture.md)。

**演员 HUD 与舞台泌乳：** 控件用普通游戏的动作、状态、结果；成人同人风格靠角色反馈、画面与事件演出。互动用量即时记到演员；身体设置只编辑草稿参数。穿衣继续不绕过校准入口；[泌乳](./gameplay/stage-lactation-proposal.md)仍要求适配的皮肤出口和实测露出。美术试样、验收截图放本机 `local-review/`，图形验证串行运行。

**其他待真机项。** 有北台反馈时做[牌面斜看与点选](./performance/next-quest-export.md#北台仪表斜看与点选)。潮池月影、跨星着陆舒适度、受精瞬间可读性、抓点与震感仍待实戴。已有星球同屏互动短测，若做性能归因还需控制机位、支架和图窗。[按问题选一趟](./performance/next-quest-export.md)；地台／草坪各 15 分钟的持续 72 FPS 另验。

**其余项目：** 16 景（10 个主入口）、13 件道具、[四幕玩法](./gameplay/README.md#四幕玩法)、[母星采谱与跳岛](./scenery/opal-planet.md)均已上线。本机 `local-review/README.md` 索引三裙型同帧对照、C 材质小图和实际模型照片。恋活卡因不接受逐卡手动导出而搁置；[Blender 角色包](./gameplay/blender-characters.md)已交付。

[双角色持具、撤出回流](./gameplay/pelvic-attachment.md#假阳具玩法候选尚未实现)、[灯影／霜岬回波](./gameplay/interactive-scene-studies.md)与[三个新景](./scenery/next-modeling-round.md#婚礼之后的新景候选未排期)未排期；[暂停物理休眠](./performance/README.md#回场与后续验收)先取证。

**审图与历史。** [旧生育进程与孕期试样](./release-history.md#旧生育进程与孕期试样)只作历史查档，不是待续做的功能。实际对照图从本机 `local-review/README.md` 进入。`c481760` 从当前分支撤下 12 张成人／解剖截图，保留普通场景图，未重写旧提交。浏览器、模拟双眼、全量测试和构建仍由一人错峰运行。较早的完整指南可用 `git show b756c7f:docs/performance/next-quest-export.md` 查阅。
