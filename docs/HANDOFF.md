# 会话交接｜2026-11-25

[正式舞台](https://mmd-xr-stage.pages.dev) · [固定版 `aa6a0f5`](https://875a8d5f.mmd-xr-stage.pages.dev) · [WebGPU 裙摆实验](https://mmd-xr-stage.pages.dev/labs/cloth/) · [发布记录](./release-history.md) · [文档索引](./README.md)

**恢复停点：先修普通行走与眼高，以重力捕捉以前的脚感为准。** 玩家已实戴反馈：普通模式太低、母星走着走着视线歪，布料实验窗口正常但进入 VR 全黑。先读[两份导出、决策和各线停点](./performance/quest-2026-11-25.md)。本轮仅整理文档；`aa6a0f5` 仍是产品版。WebGPU 后续目标是从同一游戏入口使用当前背包角色，不以修好独立实验页代替游戏内接入。

## 从这里继续

- **查演员兼容性：**四件 SDEF 演员的摆放缩放与晚 VMD 键已修；[材质形态／UV 形态](./performance/model-feature-coverage.md)的实模反例仍独立待修。排查角色内存时用[分配与释放探针](./performance/model-memory.md)，不要禁用表情或描边来获得小数字。

- **查场景帧率：**选泳池计时台或教室后门，按[单景真机对照](./performance/next-quest-export.md#泳池或教室同机位真机对照)跑 `6061e24` 与 `b91325b`。先空场，加入演员或开物理另算。若两版帧率都顶住刷新率，只记录几何提交和镜片观感；无需据此继续削水面或课桌材质。
- **角色物理两条线：**[11 月 25 日泳池](./performance/quest-2026-11-25.md)最后七窗，原生步进中位 12.60 ms；另有持续裙面显示每窗均值的中位 12.29 ms/次。前者查[真正执行的关节行](./performance/bullet-step-profile.md#主迭代行循环)，后者查[手动姿势的显示更新](./performance/pose-cloth-contact.md#保持一个姿势也会花时间吗)。不要把二者算成同一瓶颈。
- **加载器只有一份源码：**跟踪上游已发布的正式版，在自己的 fork 集成；舞台用生成补丁还原同一产物，打包前校验。当前 `0.8.6` / `fork/main@9a45a5c`，含形态纹理去重。[来源清单](../loader-source.json) · [同步办法](./three-mmd-loader-maintenance.md#怎么保持同步)。独立的 CPU 骨架去重候选仍未投稿，等维护者的 [#47](https://github.com/yohawing/three-mmd-loader/pull/47) 合入后再复查。[英文草稿与恢复说明](./three-mmd-loader-maintenance.md#共享骨架去重的上游候选)

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
