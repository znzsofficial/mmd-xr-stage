# 会话交接｜2026-11-25

[正式舞台](https://mmd-xr-stage.pages.dev) · [固定版 `6db0bb7`](https://fc4d3e1e.mmd-xr-stage.pages.dev) · [WebGPU 裙摆实验](https://mmd-xr-stage.pages.dev/labs/cloth/) · [发布记录](./release-history.md) · [文档索引](./README.md)

**本轮范围：并行推进所有已确认问题，优先以重力捕捉以前的脚感验普通行走与眼高。** 角色 Bullet、手动裙面、模型兼容／内存、校园及稳态取证分别推进。WebGPU 继续在实验入口改善，真机双眼和原衣效果有依据后再考虑接入同一游戏背包。新玩法与新景仍属候选。实戴原始反馈及测量边界见[两份导出](./performance/quest-2026-11-25.md)。

## 从这里继续

- **实戴先走一趟：**[普通跑跳与眼高](./performance/normal-walk.md)已在模拟双眼对照：捕捉旧逻辑的 18.58° 残倾回到约 0°、续走眼高 1.29→1.63 m。平地实际点 −10 cm 和自由→普通已验。下一份 Quest 报告看 `stance.drawn` 与镜片观感。实验另看[两眼地标与按眼失败收据](./performance/gpu-cloth-lab.md)。
- **演员兼容与内存：**[材质透明度与 UV](./performance/model-feature-coverage.md)已经用两件原衣实绘验证，剩两条身体 VMD 英文别名失败。[资源盘点、位图释放](./performance/model-memory.md)与[可选 ADB 进程采样](./performance/quest-browser-pss.md)分别回答资源寿命与采到的驻留值；Quest 系统峰值未测。

- **查场景帧率：**选泳池计时台或教室后门，按[单景真机对照](./performance/next-quest-export.md#泳池或教室同机位真机对照)跑 `6061e24` 与 `b91325b`。先空场，加入演员或开物理另算。若两版帧率都顶住刷新率，只记录几何提交和镜片观感；无需据此继续削水面或课桌材质。
- **角色物理两条线：**[原生关节工作](./performance/bullet-step-profile.md#实际关节行)已分解；直调在两轮整模对照中均未获益，正式 Bullet 不变。[手动裙面](./performance/pose-cloth-contact.md)减少重复的防翻面检查，三件原衣 645 帧等价，部分姿势桌面持续显示更快；首次拟合与实戴帧时仍待改善／复测。
- **加载器只有一份源码：**游戏与 `fork/main@3ac1d8e` 同一套已验 0.8.6 产物。[来源清单](../loader-source.json) · [同步办法](./three-mmd-loader-maintenance.md#怎么保持同步)。独立的上游 CPU 骨架去重候选仍未投稿，等维护者的 [#47](https://github.com/yohawing/three-mmd-loader/pull/47) 合入后复查。

## 已交付和证据边界

| 版本 | 玩家能看到什么 | 验证到哪里 |
|---|---|---|
| `b91325b` | 泳池和教室裁去每眼视野外的静件，保留水面折射、桌椅木纹与脚边投影。 | [关阴影的屏幕机位](./performance/pool-classroom.md)：计时台 37,334→20,334 面，教室后门 17,382→8,486 面；这两张画面逐像素相同。桌面 GPU 时间变化很小。 |
| `6061e24` | 星门静件合批，减少喜堂和柏树投影、远月和菌圃的绘制量。 | [大厅入口 62→47 次绘制；菌圃合影少 45,596 面](./performance/scenery-render-work.md)。已验六门与风道往返。北台远月未测出稳定桌面 GPU 收益。 |
| `eea2217` | 开物理切到仰卧、或衣物随物理晃动时，少做重复计算。 | [同一原衣演员桌面 CPU](./performance/pose-fit-and-clothing.md)：首次捧腿约 68→50 ms；开启附件时遮挡检查 0.46→0.29 ms/帧。首次换姿仍可能顿一下。 |
| `dfc1c35`、`f20d268` | [站立裙摆减抖](./performance/xr-runtime-performance.md#默认站立开物理后的反复轻抖)；[改入口时附件跟随](./gameplay/actor-tools.md)；[小行星侧移后按左手 Y 站直](./performance/planet-stance-input.md)。 | 站姿原衣按 72 Hz 采样，外裙顶点单步位移 P95 为 0.210→0.033 mm，拨裙仍约 12 cm。模拟双眼越过南极走 44 m；普通跳着陆保持原视野。手感待真机。 |

最新正式舞台报告起于 **11 月 25 日 10:17Z**：空母星后转泳池、120 Hz、阴影关，112 个窗口；同期布料实验只有 14 个单眼窗口。此前 [11 月 23 日数据](./performance/viewing-and-diagnostics.md#已有测量)是阴影开的小行星互动，不能直接比较版本。地台、草坪各 15 分钟的[持续 72 FPS 验收](./performance/next-quest-export.md#稳态固定条件独立导出)仍独立待测。

## 其他接续入口

- [手动裙摆与换姿方向](./performance/pose-cloth-contact.md)、[侧裙分层证据](./performance/supine-side-skirt.md)：左膝微调后前裙掉回已修；A 普通抬腿侧髋仍约 28 mm 穿入，B 抬腿转跪仍为 12.8 mm。横穿面数不是实际露腿面积。镜片里看刚到位、停两秒和返站。
- [角色首页、附件与衣物](./gameplay/actor-tools.md)、[受精结果规则](./gameplay/pelvic-attachment.md#一次释放的受精演出)、[只读孕态参考](./gameplay/observation-reference.md)。附件安装不代表已确认露出；换观察图不改释放目标或演员记录。玩法止于受精结果。[已上线四幕玩法](./gameplay/README.md#四幕玩法)不是待办。
- [源码目录](./architecture.md#源码目录) · [16 景与路线](./scenery/README.md) · [星球贴坡查询](./performance/planet-shell-sweep.md) · [历次实戴与短测](./performance/next-quest-export.md)。原衣实模截图、设备和逐帧原始证据从被 Git 忽略的 `local-review/README.md` 找；浏览器、模拟 XR 与全量验证串行。
- **未排期：**[双角色持具、撤出回流](./gameplay/pelvic-attachment.md#假阳具玩法候选尚未实现)、[灯影／霜岬回波](./gameplay/interactive-scene-studies.md)、[三个候选新景](./scenery/next-modeling-round.md#婚礼之后的新景候选未排期)。恋活逐卡导出方案搁置；[Blender 角色包](./gameplay/blender-characters.md)已交付。
