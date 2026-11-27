# 会话交接｜2026-11-27

[正式舞台](https://mmd-xr-stage.pages.dev) · [正式 WebGPU 海站](https://mmd-xr-stage.pages.dev/?set=seasideTerminus&xrBackend=webgpu) · [`d519c8d` 固定版](https://bf94c6d3.mmd-xr-stage.pages.dev/?set=seasideTerminus&xrBackend=webgpu) · [发布记录](./release-history.md)

**线上已更新至 `d519c8d`。** 主列表显示 11 个大布景，六个片场通过星环遗庭或旧链接进入。新建的海边终点站是第 17 景：沿站台上干堤，拨潮盘提前涨落；堤下潮阶能涉水，两端均可走回。小行星撤下 07 潮汐洞星，旧干台布局在恢复时迁回母星北台，01–06 编号不变。终点站的屏幕／模拟 XR 实走见 `scripts/verify-seaside-walk.cjs`。提丰两份 PMX 的脸色按同灯同姿比较，见[角色画风记录](./scenery/character-toon-references.md)。

**本机工具链：**Node 26.13.1、pnpm 11.29、Vite 8.4、Vitest 5.1.2；`@types/node` / `@types/react` 分别更新至 26.6.11 / 19.3.3。独立 Babylon 对照实验使用 9.38，不进入游戏。主项目 Rapier 与 `@react-three/rapier` 继续配套 0.19.2，Three r187、loader fork 和 XR 输入补丁保持锁定。

**本机混合布局版：**WebGL 的原背包先实测内嵌 GLB、外置 BIN／PNG 的 glTF，随后同一标签页实走 3 名演员＋3 件物件 WebGL → WebGPU → WebGL。单件收回、单人材质归属及原舞段恢复均有画面对照。玩家导入方法见[放一件 GLB 或 glTF](./gameplay/asset-workflow.md#放一件-glb-或-gltf)，证据见[混合布局实测](./webgpu-xr-status.md#混合布局候选材质与环境的画面对照)。

**Loader 版本阻塞已解除。** 上游 `v0.9.0@62ce047` 已合入自有 fork 的 `main@c762507`，舞台按官方 tarball 重新导出补丁。实装 347 文件及 Bullet 配对一致；穿衣实模在 WebGPU 验衣柜、停机复原、摆姿录放，3 人 3 物两端往返复验通过。旧标签页的 0.8.6 物理文件及解析 WASM 仍保留。发布收据绑定最终提交；上游贡献单列，见[投稿建议](./three-mmd-loader-maintenance.md#上游投稿建议2026-11-27)。

## 正式站单角色版：17 景、13/13 件道具

本轮已结项。入口、玩法与后端选择见[当前正式版](./webgpu-xr-status.md#当前正式版)。同一穿衣演员已串测衣柜、观察、身体设置、道具、摆姿、支架录放和跨后端续场。Quest 实机手感与持续帧率标为未测，不安排玩家补测。

1080 项舞台测试、31 项工具测试通过。已上传双眼冒烟通过的同一份构建；14 项主域页面与资源比对一致，线上海站 WebGPU 直达已实际进入、提交双眼并退出。默认及屏幕观看仍走 WebGL；多人、导入 GLB、WebGPU 皮肤贴图替换、全环境高级设置和 Quest 同舞段帧时配对单列。

## 本次发布：布景、角色与玩法

- **场内**：WebGPU 右 B → 更多 → 环境，可直接选择日光或暖光，继续看同一个演员。教室保持窗影、书页和木桌面的分层；海站在檐下保留冷色软影，干堤仍在日照中。`local-review/screenshots/room-light/scenery.png` 是两景新旧同机位；`stage-portraits.png` 是从游戏背包放人、用实际 XR 菜单换灯后读回的角色与布景。
- **角色**：洛茜的金发、披肩与白衣按[同一盏灯的对照](./scenery/character-toon-references.md#终末地参照同一束光照到白球和角色)核验。专图生效的脸和衣料保留其着色；无专图的 PMX 从作者底色保守重照。洛茜透明侧发的亮带仍比官图碎。三模九次同光切回原 MMD 均零像素差。
- **普通 PMX 覆盖**：8 份原 PMX 中识别的材质从 35/219 到 42/219，增加的都是明确标注的袖片；至少命中一槽从 7/8 到 8/8。祀标准版的双袖实际读取专图，另一份普通 PMX 的五块袖片走基础布料。两个角度实绘，前版／新版眉眼保持、切回无残差。这不是全库覆盖率。
- **WebGPU 角色操作与道具**：泌乳保留分侧操作和衣物遮挡，见[实录](./performance/actor-tools-regression.md#webgpu-单角色泌乳)。固定支架与绑定演员的手持插入走标定、真实跨越和中断，不从按钮推断交付。穿衣版选择保持穿衣后可以内部操作，但不因此生成裸露外观或外喷。月面盖印、泳池发船、Live House 染幕和草坪纸鸢已实际通过模拟 XR 的手柄输入与双眼绘制；四幕共用拿取、腕部交接和切景清理。
- **旧 WebGL 遥控跳蛋**：在穿衣实模、关角色物理、固定姿势下，旧版外壳和眼部在动，但隐藏外壳后腰前和胸前的衣面开／关差均为 0。现在绑定实际可见表面，让佩戴点附近随节律响应，停机恢复；两后端均有实模对照。选演员 → 佩戴跳蛋并启动 → 腰前衣面／胸前。私有图 `local-review/screenshots/remote-egg/webgl-comparison.png`。
- **海站写实样板**：屏幕游览可选「潮阶 · 向海望日」「干堤 · 海上渔舟」「候车棚 · 木长椅」。云色、太阳反光和檐影同向，高档有破碎的局部船影和堤灯倒影。实拍木材及岸岩的纹理、圆边与材料粗糙度落在实物上；范围是此站，不影响其余布景和演员。`local-review/screenshots/sunny-harbour/materials-comparison.png` 和 `harbour-sunpath.webp` 用于复看。
- **收束**：当前两景和侧光半身里能看见眼线、脸颊换边和衣褶，先不做手持柔光灯，也不把两景的日光调法套到其余房间。卡顿只查了[已录的同机地台段](./performance/quest-floor-dance.md)：Quest 未连接，缺同画风、机位、舞段等长配对，未改求解器；新报告附动作时刻，等待可比较的实机样本。

五条历史待办仍在项目面板：准星与面板可读性、校园／河街与握姿两条回访；角色慢帧、模型兼容与内存两条按需专项；恋活卡搁置。兼容的已知缺口是一个样本的两条形态英文别名经身体 VMD 未匹配，见[实测条件](./performance/model-feature-coverage.md)。多人、改默认后端和新一轮扫库均未排期。

## 已交付与证据边界

- **16 景单角色 WebGPU：**生产包在桌面硬件 GPU＋模拟 XR 逐景进出、读双眼颜色并查着色器；洛茜走过教室→泳池→地台→教室，原位恢复并续播。Quest 地台已实戴确认放人、切画风、二次入场及动作恢复；**未测 16 景各自的持续帧时**。操作与版本细节见[后端实录](./webgpu-xr-status.md)。
- **普通 PMX：**明确命名的脸、发、皮肤、布、皮革、金属可用基础档，合格的同包专图再增强。珠霜舒芙蕾命中 9 槽，切回两眼取样均零残差；游戏对照在 `local-review/screenshots/basic-style-stage/mmd-and-basic.png`。洛茜的专图样板、缺图回退和未采用的脸影候选保留在[画风实录](./scenery/character-toon-references.md)。
- **性能：**早期地台两趟播舞窗口的回调 FPS 中位约为 WebGPU 36、WebGL 61；机位、画风和舞段未按等长窗口配对，不能作为当前版本的后端排名。私有原始报告在 `local-review/verification/quest-floor-ab/`。全布景功能版通过 1078 项舞台测试和 31 项工具测试，线上核对 18 项资源。

[完整历史交接](./handoff-history-2026-11-26.md)保留旧阶段的选型、操作、反例与证据链接；[目录地图](./architecture.md)用于定位代码。仅按本轮目标复用相关样本，硬件浏览器／GPU 验证串行。
