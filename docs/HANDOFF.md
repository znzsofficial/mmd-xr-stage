# 会话交接｜2026-11-27

[正式舞台](https://mmd-xr-stage.pages.dev) · [WebGPU 直达](https://mmd-xr-stage.pages.dev/?set=astralCourt&xrBackend=webgpu) · [本轮固定版](https://9d9f1ae6.mmd-xr-stage.pages.dev/?set=astralCourt&xrBackend=webgpu) · [发布记录](./release-history.md)

**线上仍是 `3aa231f`；本机候选按玩家要求暂不发布。** 本机主列表恢复只显示大布景，六个片场通过星环遗庭或旧链接进入。新建的海边终点站是第 17 景：沿站台上干堤，拨潮盘提前涨落；堤下潮阶能涉水，两端均可走回。小行星撤下 07 潮汐洞星，旧干台布局在恢复时迁回母星北台，01–06 编号不变。终点站的屏幕／模拟 XR 实走见 `scripts/verify-seaside-walk.cjs`。提丰两份 PMX 的脸色按同灯同姿比较，见[角色画风记录](./scenery/character-toon-references.md)。

**本机工具链：**Node 26.13.1、pnpm 11.29、Vite 8.4、Vitest 5.1.2；`@types/node` / `@types/react` 分别更新至 26.6.11 / 19.3.3。独立 Babylon 对照实验使用 9.38，不进入游戏。主项目 Rapier 与 `@react-three/rapier` 继续配套 0.19.2，Three r187、loader fork 和 XR 输入补丁保持锁定。

## 下一轮：让角色和房间像被同一盏灯照亮

玩家在窗边教室看半身时，白衣、脸颊和发束应该看得出窗光偏冷；换到暖光布景时，受光侧随房间变暖，眼线和衣褶仍然清楚。现在演员已跟随房间主光方向，但脸和头发主要用 RGB 最大通道作亮度，再套固定的冷暖配色。**先用现有灯验证色偏从哪里来，不新增操作按钮。**

- **从哪里改：**先对照[房间灯光配置](../src/mmdVrShowcase/stage/lighting.ts)、[演员主光同步](../scripts/webgpu-actor/stageActorBackend.js)和[仿风格着色](../scripts/webgpu-actor/endfieldToon.js)。先试主光颜色；只有背光面仍脱离场景，才补房间已有的环境填光。保留[材质分槽与散射边界](./scenery/character-toon-references.md#没有专用贴图时)。
- **做到哪里停：**用珠霜舒芙蕾的基础档，在同姿、同机位、同曝光、同光向下只换白光／暖光。正常半身看得出角色与旁边的白色物件同向变色，眉眼不糊，白衣仍分得出褶；用洛茜确认专图脸影仍随主光换边。暂停且关物理切回 MMD 应恢复原色。交一张可读的同光对照；只有放大或看差值才分得出来，就保留基线、停止加码。

## 后续顺序（候选，不并行开工）

| 什么时候值得做 | 做什么、到哪里停 |
|---|---|
| 播舞卡顿比光色更影响游玩时，优先于新道具 | **只查一个慢舞段。** Quest 同机、同角色、同 VMD、原 MMD、相同机位与物理设置，核对两眼尺寸和实得 Hz 后比较等长播舞窗的慢帧。只处理可复现的一项开销；没有匹配基线就不改默认后端。见[性能入口](./performance/README.md)。 |
| 场景光已协调，但近看背光脸仍不清楚 | **再考虑一盏手持柔光灯。** 拿起、从侧面补亮、收回；只影响附近演员，松手或换景后不残留。先比较同一半身机位的开／关和帧时，再决定是否保留。 |

五条历史待办仍在项目面板：准星与面板可读性、校园／河街与握姿两条回访；角色慢帧、模型兼容与内存两条按需专项；恋活卡搁置。兼容的已知缺口是一个样本的两条形态英文别名经身体 VMD 未匹配，见[实测条件](./performance/model-feature-coverage.md)。多人、改默认后端和新一轮扫库均未排期。

## 已交付与证据边界

- **16 景单角色 WebGPU：**生产包在桌面硬件 GPU＋模拟 XR 逐景进出、读双眼颜色并查着色器；洛茜走过教室→泳池→地台→教室，原位恢复并续播。Quest 地台已实戴确认放人、切画风、二次入场及动作恢复；**未测 16 景各自的持续帧时**。操作与版本细节见[后端实录](./webgpu-xr-status.md)。
- **普通 PMX：**明确命名的脸、发、皮肤、布、皮革、金属可用基础档，合格的同包专图再增强。珠霜舒芙蕾命中 9 槽，切回两眼取样均零残差；游戏对照在 `local-review/screenshots/basic-style-stage/mmd-and-basic.png`。洛茜的专图样板、缺图回退和未采用的脸影候选保留在[画风实录](./scenery/character-toon-references.md)。
- **性能：**早期地台两趟播舞窗口的回调 FPS 中位约为 WebGPU 36、WebGL 61；机位、画风和舞段未按等长窗口配对，不能作为当前版本的后端排名。私有原始报告在 `local-review/verification/quest-floor-ab/`。全布景功能版通过 1078 项舞台测试和 31 项工具测试，线上核对 18 项资源。

[完整历史交接](./handoff-history-2026-11-26.md)保留旧阶段的选型、操作、反例与证据链接；[目录地图](./architecture.md)用于定位代码。仅按本轮目标复用相关样本，硬件浏览器／GPU 验证串行。
