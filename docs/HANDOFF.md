# 会话交接｜2026-11-25

[正式舞台](https://mmd-xr-stage.pages.dev) · [固定版 `d65e37c`](https://ccc0f8cf.mmd-xr-stage.pages.dev) · [WebGPU 裙摆实验](https://mmd-xr-stage.pages.dev/labs/cloth/) · [发布记录](./release-history.md) · [文档索引](./README.md)

**恢复停点：同一演员的形态纹理已去重，glTF 物件收回时的资源遗漏已修。** [新旧内存与画面对照](./performance/model-memory.md)：原衣 A 单人形态分配 910→26 MiB，教室与空泳池回访两轮无累增。下一次实戴分别看首次放置峰值、站稳后和收回后的内存；这些桌面分配量不是 Quest FPS。独立[原衣裙摆实验](./performance/gpu-cloth-lab.md)及校园同机位帧率另测。

## 从这里继续

- **查演员兼容性：**四件 SDEF 演员的摆放缩放与晚 VMD 键已修；[材质形态／UV 形态](./performance/model-feature-coverage.md)的实模反例仍独立待修。排查角色内存时用[分配与释放探针](./performance/model-memory.md)，不要禁用表情或描边来获得小数字。

- **查场景帧率：**选泳池计时台或教室后门，按[单景真机对照](./performance/next-quest-export.md#泳池或教室同机位真机对照)跑 `6061e24` 与 `b91325b`。先空场，加入演员或开物理另算。若两版帧率都顶住刷新率，只记录几何提交和镜片观感；无需据此继续削水面或课桌材质。
- **查单人开物理仍慢：**先分普通站立、保持手动体位、持续播舞。[站姿减抖](./performance/xr-runtime-performance.md#默认站立开物理后的反复轻抖)不休眠 Bullet；[手动姿势报告](./performance/pose-cloth-contact.md#保持一个姿势也会花时间吗)有 `skirtWork`。持续播舞已做[关节行与接触／摩擦行的独立计时](./performance/bullet-step-profile.md#主迭代行循环)：48/48 窗以关节行为重，占非 split 迭代约七成。若继续查原后端，先量哪些约束行每遍实际执行，不直接调低求解精度。
- **继续 loader 上游贡献：**舞台仍用官方 `0.8.6` 加 pnpm 补丁，完整扩展在自己的 `fork/main@82147af`。独立候选 `perf/dedupe-render-palettes` 只含 `4629aab`、`1d444f0`，工作树干净、未推送、未投稿。11 月 25 日复核维护者的 [#47](https://github.com/yohawing/three-mmd-loader/pull/47) 仍 open（`347bf20`）。等合并后在新 `upstream/main` 检查 JS 和 WASM 两条路径：若已去重则不提；否则只移植这两个提交，复跑基准。[英文草稿与恢复说明的位置](./three-mmd-loader-maintenance.md#共享骨架去重的上游候选)

## 已交付和证据边界

| 版本 | 玩家能看到什么 | 验证到哪里 |
|---|---|---|
| `b91325b` | 泳池和教室裁去每眼视野外的静件，保留水面折射、桌椅木纹与脚边投影。 | [关阴影的屏幕机位](./performance/pool-classroom.md)：计时台 37,334→20,334 面，教室后门 17,382→8,486 面；这两张画面逐像素相同。桌面 GPU 时间变化很小。 |
| `6061e24` | 星门静件合批，减少喜堂和柏树投影、远月和菌圃的绘制量。 | [大厅入口 62→47 次绘制；菌圃合影少 45,596 面](./performance/scenery-render-work.md)。已验六门与风道往返。北台远月未测出稳定桌面 GPU 收益。 |
| `eea2217` | 开物理切到仰卧、或衣物随物理晃动时，少做重复计算。 | [同一原衣演员桌面 CPU](./performance/pose-fit-and-clothing.md)：首次捧腿约 68→50 ms；开启附件时遮挡检查 0.46→0.29 ms/帧。首次换姿仍可能顿一下。 |
| `dfc1c35`、`f20d268` | [站立裙摆减抖](./performance/xr-runtime-performance.md#默认站立开物理后的反复轻抖)；[改入口时附件跟随](./gameplay/actor-tools.md)；[小行星侧移后按左手 Y 站直](./performance/planet-stance-input.md)。 | 站姿原衣按 72 Hz 采样，外裙顶点单步位移 P95 为 0.210→0.033 mm，拨裙仍约 12 cm。模拟双眼越过南极走 44 m；普通跳着陆保持原视野。手感待真机。 |

最新已分析的[头显报告](./performance/viewing-and-diagnostics.md#已有测量)仍是 **11 月 23 日 15:11Z**，早于以上版本。琉璃小行星、阴影开、VMD 暂停：单人无支架无图关／开物理窗口中位 67／30 FPS；开支架且有图的 28 窗为 20.5 FPS。不是锁机位 A/B，不能用来判断此次校园优化。地台、草坪各 15 分钟的[持续 72 FPS 验收](./performance/next-quest-export.md#稳态固定条件独立导出)仍独立待测。

## 其他接续入口

- [手动裙摆与换姿方向](./performance/pose-cloth-contact.md)、[侧裙分层证据](./performance/supine-side-skirt.md)：左膝微调后前裙掉回已修；A 普通抬腿侧髋仍约 28 mm 穿入，B 抬腿转跪仍为 12.8 mm。横穿面数不是实际露腿面积。镜片里看刚到位、停两秒和返站。
- [角色首页、附件与衣物](./gameplay/actor-tools.md)、[受精结果规则](./gameplay/pelvic-attachment.md#一次释放的受精演出)、[只读孕态参考](./gameplay/observation-reference.md)。附件安装不代表已确认露出；换观察图不改释放目标或演员记录。玩法止于受精结果。[已上线四幕玩法](./gameplay/README.md#四幕玩法)不是待办。
- [源码目录](./architecture.md#源码目录) · [16 景与路线](./scenery/README.md) · [星球贴坡查询](./performance/planet-shell-sweep.md) · [历次实戴与短测](./performance/next-quest-export.md)。原衣实模截图、设备和逐帧原始证据从被 Git 忽略的 `local-review/README.md` 找；浏览器、模拟 XR 与全量验证串行。
- **未排期：**[双角色持具、撤出回流](./gameplay/pelvic-attachment.md#假阳具玩法候选尚未实现)、[灯影／霜岬回波](./gameplay/interactive-scene-studies.md)、[三个候选新景](./scenery/next-modeling-round.md#婚礼之后的新景候选未排期)。恋活逐卡导出方案搁置；[Blender 角色包](./gameplay/blender-characters.md)已交付。
