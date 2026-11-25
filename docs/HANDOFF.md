# 会话交接｜2026-11-25

[正式舞台](https://mmd-xr-stage.pages.dev) · [固定版 `1d450e3`](https://8bb257f7.mmd-xr-stage.pages.dev) · [WebGPU 裙摆实验](https://mmd-xr-stage.pages.dev/labs/cloth/) · [发布记录](./release-history.md) · [文档索引](./README.md)

**已确认主线：玩家从同一背包放下自己的角色，能在 Quest 舒服地走近，看动作、摆姿和用双手互动。** 已依次完成入口保护、快速发布、小行星模式收口、实验页真实 VMD 同段对照；WebGPU 未达到进游戏门槛。本轮在这里停。

依据：[全项目维护审计](./structure-review-2026-11-25.md)。选择已定：**成功入场才开新布局，拒权、取消、首帧超时保留原布局**。常规回归由开发者承担，不以玩家再测一次为结构整理的前提。

| 顺序 | 玩家结果／开发范围 | 到哪里就收工 |
|---|---|---|
| 第一阶段已交付：保护旧布局 | 当前代次的首个 XRFrame 确认前，不让新空房读取或替换已保存的布局；原背包文件跨入场保留。PR 与主线复用统一检查；发布同一个经检查、冒烟和指纹核对的目录。 | 两景布局／绑定覆盖拒权、取消、超时、迟到结果和成功首帧；构建后在模拟双眼实走拒权保留两景、成功空场仍留文件。主域已核对，无需玩家补测。 |
| ① 已收口：小行星 | [互斥活动模式、接地结果与 XR 原点出口](../src/mmdVrShowcase/movement/planetJourney.ts)，保留既有物理参数、普通与受保护落地。 | `4922d5e`：28 项针对性交接测试通过；生产构建 IWER 从风道到棱盐连跳两次，不按 Y，续走净高 1.810 m、基座倾角约 0.02°。移动冻结，不追加实戴请求。 |
| ② 已对照：GPU 裙摆 | 现有实验页可选本地身体 VMD，播放／暂停／续播；自动用同一段动作和掌球轨迹对比原 Bullet 与 GPU。 | [两件原衣的真实舞段](./performance/gpu-cloth-lab.md#真实-vmd-同段对照)：本机无可重复的播舞整帧收益，稀疏裙承托也未证实。保留实验，不进入③。与真机站姿数据分开。 |
| ③ 玩家入口暂缓；先规划底层 | [先做好 WebGPU 后端再切换：实施顺序与可复用组件](./webgpu-xr-status.md#11-25-后续计划先做好底层再切玩家入口)。一景一人仅作内部调试；正式舞台继续走 WebGL。 | 先比原衣同姿与舞段，再接裙摆和双眼；常用布景、操作、设备帧时和失败恢复过关后再决定切换。 |

**暂缓：**Bullet 直调负结果已结案；Babylon 迁移、新景／玩法、跨模型扫库、校园长测及内存专项保留原记录，有能阻塞上述操作的新证据再提级。同一行为第二次因模式交接回退，或一项新功能要求复制整套演员加载／时钟／生命周期时，先界定状态归谁，再增加功能。并行只用于当前里程碑的实现和验证。

演员播放两项已复现并修复：背包和详情移除演员时都按剩余动作更新播放时钟和快照；暂停并关闭物理时，隐藏期间拖过时间轴的演员会在首次重新显示时更新姿势。其余审计候选（场景透墙射线／退役的走路测试、根 Ecctrl 依赖、旧分块支持期限和归档）未排期。

**实验页盘点（按入口，不按候选算法、旧部署 URL 或截图数）：**Git 追踪 `experiments/` 下 **4** 份 HTML。暂停 Babylon 迁移留下 **2** 个仍能打开的独立预览入口（[引擎 A/B](https://babylon-classroom.mmd-xr-stage.pages.dev/)、[教室](https://babylon-classroom.mmd-xr-stage.pages.dev/classroom)）；[行走选型探针](../experiments/three-planet-wheel/README.md) **1** 个，已结项留档；活跃 WebGPU 裙摆实验 **1** 个。正式站当前构建只含主入口与 `/labs/cloth/`。另有 `scripts/` 的 **26** 份开发 HTML（回归、烘焙、选样等），不随站发布；本机 `local-review/` 的留样／构建副本不计作独立实验项目。

## 排期所依据的记录

- **实戴复验：**[11:49Z 的两份导出](./performance/quest-2026-11-25-1149.md)确认母星基本直立、风道正常、WebGPU 能出双眼；小卫星普通连跳仍压低视野，GPU 手球容易穿裙。新版棱盐同井两跳已在 IWER 对照至 1.81 m／约 0°；[原衣双手托举、单撤与回落](./performance/gpu-cloth-lab.md#实际解算的内容)在实际 GPU 已验，仍是独立实验。下一趟 Quest 先看这两项的实际手感。
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

最新正式舞台报告起于 **11 月 25 日 11:49Z**：无演员、120 Hz、母星→苇湾→母星→棱盐→玄釉；同期独立实验 27 个双眼窗，站姿 GPU 16 窗／Bullet 5 窗回调中位 100.6／75.8 FPS。不是正式游戏稳态性能结论。地台、草坪各 15 分钟的[持续 72 FPS 验收](./performance/next-quest-export.md#稳态固定条件独立导出)仍独立待测。

## 其他接续入口

- [手动裙摆与换姿方向](./performance/pose-cloth-contact.md)、[侧裙分层证据](./performance/supine-side-skirt.md)：左膝微调后前裙掉回已修；A 普通抬腿侧髋仍约 28 mm 穿入，B 抬腿转跪仍为 12.8 mm。横穿面数不是实际露腿面积。镜片里看刚到位、停两秒和返站。
- [角色首页、附件与衣物](./gameplay/actor-tools.md)、[受精结果规则](./gameplay/pelvic-attachment.md#一次释放的受精演出)、[只读孕态参考](./gameplay/observation-reference.md)。附件安装不代表已确认露出；换观察图不改释放目标或演员记录。玩法止于受精结果。[已上线四幕玩法](./gameplay/README.md#四幕玩法)不是待办。
- [源码目录](./architecture.md#源码目录) · [16 景与路线](./scenery/README.md) · [星球贴坡查询](./performance/planet-shell-sweep.md) · [历次实戴与短测](./performance/next-quest-export.md)。原衣实模截图、设备和逐帧原始证据从被 Git 忽略的 `local-review/README.md` 找；浏览器、模拟 XR 与全量验证串行。
- **未排期：**[双角色持具、撤出回流](./gameplay/pelvic-attachment.md#假阳具玩法候选尚未实现)、[灯影／霜岬回波](./gameplay/interactive-scene-studies.md)、[三个候选新景](./scenery/next-modeling-round.md#婚礼之后的新景候选未排期)。恋活逐卡导出方案搁置；[Blender 角色包](./gameplay/blender-characters.md)已交付。
