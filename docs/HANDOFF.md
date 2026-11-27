# 会话交接｜2026-11-27

[正式舞台](https://mmd-xr-stage.pages.dev) · [WebGPU 直达](https://mmd-xr-stage.pages.dev/?set=astralCourt&xrBackend=webgpu) · [本轮固定版](https://9d9f1ae6.mmd-xr-stage.pages.dev/?set=astralCourt&xrBackend=webgpu) · [发布记录](./release-history.md)

**线上仍是 `3aa231f`；本机候选按玩家要求暂不发布。** 本机主列表恢复只显示大布景，六个片场通过星环遗庭或旧链接进入。新建的海边终点站是第 17 景：沿站台上干堤，拨潮盘提前涨落；堤下潮阶能涉水，两端均可走回。小行星撤下 07 潮汐洞星，旧干台布局在恢复时迁回母星北台，01–06 编号不变。终点站的屏幕／模拟 XR 实走见 `scripts/verify-seaside-walk.cjs`。提丰两份 PMX 的脸色按同灯同姿比较，见[角色画风记录](./scenery/character-toon-references.md)。

**本机工具链：**Node 26.13.1、pnpm 11.29、Vite 8.4、Vitest 5.1.2；`@types/node` / `@types/react` 分别更新至 26.6.11 / 19.3.3。独立 Babylon 对照实验使用 9.38，不进入游戏。主项目 Rapier 与 `@react-three/rapier` 继续配套 0.19.2，Three r187、loader fork 和 XR 输入补丁保持锁定。

## 本机候选：人物与房间共用光色

- **场内**：WebGPU 右 B → 更多 → 环境，可直接选择日光或暖光，继续看同一个演员。教室保持窗影、书页和木桌面的分层；海站在檐下保留冷色软影，干堤仍在日照中。`local-review/screenshots/room-light/scenery.png` 是两景新旧同机位；`stage-portraits.png` 是从游戏背包放人、用实际 XR 菜单换灯后读回的角色与布景。
- **角色**：洛茜的金发、披肩与白衣按[同一盏灯的对照](./scenery/character-toon-references.md#终末地参照同一束光照到白球和角色)核验。专图生效的脸和衣料保留其着色；无专图的 PMX 从作者底色保守重照。洛茜透明侧发的亮带仍比官图碎。三模九次同光切回原 MMD 均零像素差。
- **普通 PMX 覆盖**：8 份原 PMX 中识别的材质从 35/219 到 42/219，增加的都是明确标注的袖片；至少命中一槽从 7/8 到 8/8。祀标准版的双袖实际读取专图，另一份普通 PMX 的五块袖片走基础布料。两个角度实绘，前版／新版眉眼保持、切回无残差。这不是全库覆盖率。
- **WebGPU 泌乳**：选中演员后可按左／右／双侧操作，沿用身体存量与衣物遮挡判断。桌面 GPU＋模拟 XR 在两份原 PMX 上实点：关角色物理的露出版分侧产生双眼可见液滴，穿衣版确认裸露后仍然只扣数值。活动 GPU 布料或无法核实的 UV 变化也只扣数值。插入、衣柜和手持道具仍未在此后端开放。验证边界见[角色工具实录](./performance/actor-tools-regression.md#webgpu-单角色泌乳)。
- **收束**：当前两景和侧光半身里能看见眼线、脸颊换边和衣褶，先不做手持柔光灯，也不把两景的日光调法套到其余房间。卡顿只查了[已录的同机地台段](./performance/quest-floor-dance.md)：Quest 未连接，缺同画风、机位、舞段等长配对，未改求解器；新报告附动作时刻，等待可比较的实机样本。

五条历史待办仍在项目面板：准星与面板可读性、校园／河街与握姿两条回访；角色慢帧、模型兼容与内存两条按需专项；恋活卡搁置。兼容的已知缺口是一个样本的两条形态英文别名经身体 VMD 未匹配，见[实测条件](./performance/model-feature-coverage.md)。多人、改默认后端和新一轮扫库均未排期。

## 已交付与证据边界

- **16 景单角色 WebGPU：**生产包在桌面硬件 GPU＋模拟 XR 逐景进出、读双眼颜色并查着色器；洛茜走过教室→泳池→地台→教室，原位恢复并续播。Quest 地台已实戴确认放人、切画风、二次入场及动作恢复；**未测 16 景各自的持续帧时**。操作与版本细节见[后端实录](./webgpu-xr-status.md)。
- **普通 PMX：**明确命名的脸、发、皮肤、布、皮革、金属可用基础档，合格的同包专图再增强。珠霜舒芙蕾命中 9 槽，切回两眼取样均零残差；游戏对照在 `local-review/screenshots/basic-style-stage/mmd-and-basic.png`。洛茜的专图样板、缺图回退和未采用的脸影候选保留在[画风实录](./scenery/character-toon-references.md)。
- **性能：**早期地台两趟播舞窗口的回调 FPS 中位约为 WebGPU 36、WebGL 61；机位、画风和舞段未按等长窗口配对，不能作为当前版本的后端排名。私有原始报告在 `local-review/verification/quest-floor-ab/`。全布景功能版通过 1078 项舞台测试和 31 项工具测试，线上核对 18 项资源。

[完整历史交接](./handoff-history-2026-11-26.md)保留旧阶段的选型、操作、反例与证据链接；[目录地图](./architecture.md)用于定位代码。仅按本轮目标复用相关样本，硬件浏览器／GPU 验证串行。
