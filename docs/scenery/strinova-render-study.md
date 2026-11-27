# 卡拉彼丘仿渲染：脸影跟头，亮带留在发束，眼线保留原画

**一个演员就能判断方向：**固定相机，让主光从左颊移到右颊，再把灯停在正前，只转头。两次都应看到暗侧换边；发束亮带可以变强弱，但不能滑过发缝；刘海下露出的眼线应能读出，真正被挡住的眼睛仍被挡住。普通 PMX 即使没有控制图，也可以先验证脸影；想验证**新增**亮带，值得为该演员的两三束头发单画一张小遮罩。

这份研究补充[现有材质对照](./character-toon-references.md)。以下分别标明官方画面、社区作者实际接线和本项目的试法。资料核对日期：2026-11-26。

## 在舞台上切换

从 **WebGPU XR** 进入，放置并选中演员，在其工具页的「画风」行选择 **仿卡拉彼丘**。可以在动作中或关物理定格时直接切到「仿终末地」，或切回「原 MMD」。选择只属于当前上场实例；其他演员、房间主光和曝光不随它切换。屏幕观看及 WebGL XR 仍按原 MMD 显示。

**半身双眼实测。** 在桌面硬件 GPU 的模拟 XR 中，从面板把同一舞段定格在 0.45 秒。仿卡拉彼丘与原 MMD 相比，左／右眼分别有 103,892／106,567 个可见演员像素的通道变化超过 5/255。单独去掉自绘发束亮纹增量时，变化缩至 658／641 个像素。切回原 MMD、再现同一画风，以及另一名未切换的演员，三个对照的演员区域都为零像素残差。恢复播放后可继续用同一演员换画风。

[着色实现](../../scripts/webgpu-actor/strinovaToon.js)从官方 Michele 的浅颊、短发光带、蓝外套的色块和 Fuchsia 的眼线／发带遮挡取方向。普通 PMX 只改作者已标明的材质：用绑定姿势的眼距和实际头骨在当前姿势下拟合脸颊，主光越过头顶时平滑回到中间色。缺少头／眼标志时保留温和的固定脸色。独立眼线、眼白和眉睫使用原 draw，混在脸底图里的五官随整片脸轻分档；两种情况都保留原 UV 和遮挡。布料暗褶偏冷，亮面用哑光色块；本档不读终末地的布料参数图，也不启用该档的专用投影或描边。

**可选发束遮罩：**在模型文件夹内，把 `头发.png.strand-mask.png` 放到实际使用的 `头发.png` 旁边（文件名须含底图扩展名）。与底图宽高比相同，普通 RGBA 8-bit、非交错 PNG，单边不超过 4096；可用较小尺寸。按该材质的 UV 将两三束的短带画白，间隙、发饰及其他区域画黑。读取线性 `R × alpha`，只给明确的头发材质加亮，不产生额外发片、轮廓或透明度。无图、重名、尺寸不合或贴图替换后，保留原有发纹；不从浅发、眼白或底图亮度推测新亮带。使用文件夹导入以保留关联路径。

**真实演员复核：**运行 `node scripts/webgpu-actor/game-floor-smoke.cjs "模型.pmx" "动作.vmd" --strinova-style`。可先把 `STRINOVA_STRAND_MASK` 环境变量设为上述命名的自绘遮罩路径；脚本仅在临时导入副本中配图。它用真实工具页定格／关物理，对同一姿势、相机和灯保存原 MMD、仿卡拉彼丘、仿终末地、切回原 MMD，以及旁边另一份独立上场实例的原色。用单独略去演员 draw 的控制帧圈定双眼可见像素，核对切回零残差、另一个实例不变，再恢复 VMD 并在播放中切换。提供遮罩时另输出关闭**仅遮罩增量**的同帧对照。半身图写到 `local-review/screenshots/strinova-stage/portraits.png`，属于本机私阅；实际头显显示和耗时须另测。

## 官方画面：三处值得盯着看

| 公共出处（固定素材链接） | 观察与用途 |
| --- | --- |
| [Michele 角色页](https://www.strinova.com/en-US/character/michele) · [官方角色卡 PNG，202411](https://klbq-web-cms.strinova.com/prod/strinova_web/images/202411/ae4bb6b7-5cfd-4ffc-b315-67a0616aaf21.png) | 金色前发上有一排短而参差的浅色亮片，随每束弧度改变宽度和端点；不是横贯整顶头发的一道白线。往下看，睁眼的深色上睑和闭眼的一笔睫毛都清楚，脸颊保留淡色。适合看浅发上亮带的**形状**及眼线的**对比**。 |
| [Fuchsia 角色页](https://www.strinova.com/en-US/character/fuchsia) · [官方角色卡 PNG，202411](https://klbq-web-cms.strinova.com/prod/strinova_web/images/202411/109957b0-6dc8-493a-ae30-0380295b2557.png) | 粉发亮面在黑色发带和发束交界处分段；斜刘海贴近眼睑，外露部分仍能分清深色上眼线、红色虹膜和眼白。用作遮挡反例：不能为了「眼睛清楚」把眼睛整片画到前发或发饰上。 |
| Michele 角色页的 **Pawtector** [官方技能演示 MP4，202501](https://klbq-web-cms.strinova.com/prod/strinova_web/images/202501/28c09e05-944f-4461-8b9d-dd3e8ab534cf.mp4) | 对照 **0:00、0:02、0:04** 的实机背面：双马尾由垂下到向外摆开，长束的浅面与较暗的束内折线仍可区分。缩到实机人物大小看，能读出几大片就够了，不必把每根线提白。这段看不到正脸。 |

角色卡是定稿美术参照；技能片不是受控转灯。它们能回答「哪些形状值得保住」，不能反推出游戏用了哪个通道、怎样比较 SDF 或怎样排序刘海。本站只链接官方出处。

## 脸影：移动的是明暗边界，不是五官纹理

- **Lvoxx 的 Blender 节点。**LSPotato 的 Strinova [脸图接线](https://github.com/lvoxx/LSPotato/blob/6e5ac0e52c910525994bfc31f7784fea667f8950/src/nodes/shader/lscherry/starters/strinova/strinova__face_textures_resolver.py#L253-L279)让 `Face_D` 走原 UV；另一支用水平投影后的主光与 `fx`、`fy` 两轴做点积，一项选 SDF 的 U 方向，一项给出比较值。[横向缩放及前后值域](https://github.com/lvoxx/LSPotato/blob/6e5ac0e52c910525994bfc31f7784fea667f8950/src/nodes/shader/lscherry/starters/strinova/strinova__face_textures_resolver.py#L137-L179)是 ±1 和 `[-0.5, 0.5]` 重映射；[Build Face Ramp](https://github.com/lvoxx/LSPotato/blob/6e5ac0e52c910525994bfc31f7784fea667f8950/src/nodes/shader/lscherry/utils/procedural/build_face_ramp.py#L48-L63)比较图值与方向值。这里所谓 SDF 的实用含义是**每个脸部位置何时过明暗界**，不是在底色上画一条黑线。
- **Juanca-48 的另一套卡拉彼丘仿制。**[ST Face 接线](https://github.com/Juanca-48/Stinova_Importer/blob/3d707eda90f45366cf2c4f09b5ae5bea1f3d14a8/strinova_toon/shading.py#L682-L726)先去掉主光在头顶轴上的分量，再用头的前向算阈值：正前为 0、侧光 0.5、正后为 1；左右符号只选原 U 或 `1−U`。软比较控制边缘，底色另接。[材质入口](https://github.com/Juanca-48/Stinova_Importer/blob/3d707eda90f45366cf2c4f09b5ae5bea1f3d14a8/strinova_toon/shading.py#L1068-L1080)把 `FaceShadowMask` 当 **Non-Color** 数据。这两位作者使用的方向值域不同；一个样板应配套使用一张图的方向、镜像约定与阈值，不能只抄其中一个常数。

**用于 PMX：**演员变换和动作求值完成后，读取**头骨**在绑定姿势校准过的前、上、右轴，消去缩放，和「脸指向光源」的方向放在同一空间。灯接近头顶时，水平投影几乎为零，应平滑退回中性脸影，不能让微小噪声反复选边。

1. 有本模型作者指定的脸图：按其 UV 岛、通道和明暗极性读为线性数据；仅对作者按对称展开的脸岛镜像，不能把整张含嘴、舌、腮红的图集横翻。先用左右侧光校一次方向。非对称展开可用分别绘制的左右数据，没有就走无图路径。
2. 只有底色、但脸槽明确：以头局部的光滑脸颊体块近似明暗（例如按脸宽高拟合椭球，以其缓变法线取主光方向），用原底色在柔和的亮／暗两档间过渡。保留眼线和腮红，先不刻出鼻翼碎影。这是**无图近似**，不是从肤色反推 SDF。若脸和衣服共槽又无合法分区，保持原 MMD。

若无图近似把鼻翼切得太碎，可为这一张脸**自画阈值图**：固定正脸，在本模型的 UV 上分别画出希望侧光 60°、90°、120° 时落入暗面的范围，使它们逐级扩张。采用 Juanca-48 的角度约定时，对应边界值为 `(1−cos θ)/2`，即 0.25、0.50、0.75；在边界之间平滑填值，先验单侧，再验镜像。这样能直接修改「哪一束光开始压暗脸颊」，不必重画五官。这个数表只配上述阈值约定。

## 发束：先决定「哪里能亮」，再决定「这时有多亮」

同样叫 `Mask`，两份仿制的输入语义已经不同：

| 作者接线 | 能借的做法 |
| --- | --- |
| LSPotato：`Hair_Mask2` 的颜色进入 [resolver](https://github.com/lvoxx/LSPotato/blob/6e5ac0e52c910525994bfc31f7784fea667f8950/src/nodes/shader/lscherry/starters/strinova/strinova__hair_textures_resolver.py#L305-L332)。[分色](https://github.com/lvoxx/LSPotato/blob/6e5ac0e52c910525994bfc31f7784fea667f8950/src/nodes/shader/lscherry/utils/separator/separate_lightmap.py#L60-L63)是 `R=Metal, G=Diffuse, B=Highlight`，但 [两次相减的接线](https://github.com/lvoxx/LSPotato/blob/6e5ac0e52c910525994bfc31f7784fea667f8950/src/nodes/shader/lscherry/starters/strinova/strinova__hair_textures_resolver.py#L345-L356)与[运算定义](https://github.com/lvoxx/LSPotato/blob/6e5ac0e52c910525994bfc31f7784fea667f8950/src/nodes/shader/lscherry/starters/strinova/strinova__hair_textures_resolver.py#L215-L227)表明 `Highlight Mask` 的原始输出是 **G−B−R**，并非直接取 B。成品节点将其送入[高光 Fac](https://github.com/lvoxx/LSPotato/blob/6e5ac0e52c910525994bfc31f7784fea667f8950/src/nodes/shader/lscherry/starters/strinova/strinova__hair_starter.py#L1239-L1244)，另接[原着色与 N·L](https://github.com/lvoxx/LSPotato/blob/6e5ac0e52c910525994bfc31f7784fea667f8950/src/nodes/shader/lscherry/starters/strinova/strinova__hair_starter.py#L1278-L1282)。 | 区域来自发束纹理；该区域如何叠到当前受光的头发上，是另一件事。MatCap 的球面坐标不是发束遮罩的 UV。 |
| Juanca-48：在[旧材质分支](https://github.com/Juanca-48/Stinova_Importer/blob/3d707eda90f45366cf2c4f09b5ae5bea1f3d14a8/strinova_toon/shading.py#L1115-L1135)，`HightLightPow > 0`、有图且没开 `RampIDFromTex` 时，才用 `Mask1.R` 的高值取画好的发丝；开关打开时 R 是[渐变表索引](https://github.com/Juanca-48/Stinova_Importer/blob/3d707eda90f45366cf2c4f09b5ae5bea1f3d14a8/strinova_toon/shading.py#L1060-L1067)。作者也把某些新材质的画定亮纹归入受 B 限定的发光支。[叠加处](https://github.com/Juanca-48/Stinova_Importer/blob/3d707eda90f45366cf2c4f09b5ae5bea1f3d14a8/strinova_toon/shading.py#L630-L643)将旧式画定亮纹乘视向门限，与 GGX 镜面分开。 | 亮带可以固定在几撮头发上，视角只调节可见程度。某个模型上有效的红／蓝通道不是普通 PMX 的材质规范。 |

**用于 PMX：**首选保留原 toon、球面贴图混合和已画亮纹。若要单独增加亮带，用该演员自己的发 UV，在两三束上画白／灰短带，束缘收窄、发缝断开，额头和发饰为黑。让同一盏主光温和调制这张遮罩里的增量，保留发色；不移动遮罩去追相机，也不在已有白亮纹上再叠纯白。没有可信遮罩时不从底色亮度生成一张——金发整片、白发饰和眼白都是直接反例。

## 眼周：分开眼睑投色、刘海遮挡和脸颊明暗

Juanca-48 在[无底图的半透明材质分支](https://github.com/Juanca-48/Stinova_Importer/blob/3d707eda90f45366cf2c4f09b5ae5bea1f3d14a8/strinova_toon/shading.py#L1018-L1034)举出 `MI_Toon_EyeShadow`：上睑在眼球上的暗色可以是一层单独的透明颜色。与之独立，[脸上刘海短影](https://github.com/Juanca-48/Stinova_Importer/blob/3d707eda90f45366cf2c4f09b5ae5bea1f3d14a8/strinova_toon/shading.py#L648-L661)用有偏移的短射线，避免鼻尖、睑、睫毛自己把眼周染黑。作者[明确记录](https://github.com/Juanca-48/Stinova_Importer/blob/3d707eda90f45366cf2c4f09b5ae5bea1f3d14a8/INSTRUCTIONS.txt#L350-L360) EEVEE 下画外头发不投这种影，边缘也可能有噪声；不能把它当作 XR 双眼可靠的遮挡数据。

共用的一条星铁经验只取其**分区**：Stalo 的 [GetFaceOrEyeDiffuse](https://github.com/stalomeow/StarRailNPRShader/blob/bf44567f389834b8be5e3095e5ff507caa8764fb/Shaders/Character/CharFaceCore.hlsl#L102-L116)把脸颊阈值和眼周的柔和着色分开，限定眼区才部分回到原色，并非把所有眼白、眼睛高光都设为自发光。其[眼区模板和深度测试](https://github.com/stalomeow/StarRailNPRShader/blob/bf44567f389834b8be5e3095e5ff507caa8764fb/Shaders/Character/CharFaceCore.hlsl#L219-L240)另需 Eye Mask 和距离数据。样板只在同一条材质路径上保护原有眼区，不另设预设或引入这套多遍绘制。

**用于 PMX：**有独立眉睫、虹膜、眼白或眼影槽时，保留其原乘色、透明度、描边和深度关系，脸颊的新阴影不再整层乘到它们上面。有明确眼区遮罩才对同槽局部减弱新增脸影；只有一张合并脸底色时，宁可降低整个脸影的幅度，保住原有深浅关系。不要按黑色找眼线，也不要把整片刘海变透明。验清楚的是**露出的眼线**，不是被完全挡住的瞳孔。

## 样板的两个对照与停止条件（建议，未实测）

冻结同一演员已求值的 VMD 帧、物理、表情、视线与相机；固定环境光、光强、光色、曝光、色调映射和成像尺寸。每个条件留「原 MMD／仅脸／脸＋亮带」；如有眼区遮罩，只在最后一对切眼区保护。截正面半身和等比例面部裁切，不比整幅图的平均亮度。

| 只改变什么 | 如何判断，怎样排除假阳性 |
| --- | --- |
| **同姿转灯**：相机不动，头朝正前，主光固定仰角约 25°，水平从演员左前 60° 经正前到右前 60°，中途留 ±30°。 | 盯双颊固定小区里的暗面覆盖率，左右侧光时主暗区应互换，中间应有连续过渡；回程同角应可重现。鼻尖和画在脸上的睫毛不能被镜像搬走。对有发束遮罩的模型，比较「脸＋亮带」减「仅脸」：有变化的是同几束的带内；在同一灯位，邻近束缝、发饰、脸颊应没有新增亮带。 |
| **同灯转头**：灯回到正前并固定，肩、躯干、相机不动；只把头从 −30° 转到 +30° 再回零，保持其余骨骼的局部姿势一致。 | 按共同可见的同一脸颊三角形／UV 比，不取同一屏幕坐标。「头 −30°、灯 0°」与「头 0°、灯 +30°」的**头局部相对光向**相同，隔离遮挡后，脸影掩码在同一点应近似一致；无需两帧最终 RGB 相同。若转灯有效、转头无效，优先查拿的是房间／演员根轴还是**实际头骨轴**。亮带要随发束投影走；只读露出的眼线、虹膜边缘和紧邻亮部的对比，侧脸时不得从不透明发片另一侧透出。 |

再用一个便宜的反例：**灯和头都不动，只绕相机**，同一可见脸点的方向性脸影不应换边；允许发束亮度因视向不同而改变。回到起始姿势并切回原 MMD，眼白、乳白发片、刘海镂空、衣领和肤色应恢复原图；任何一项只能靠换曝光或改原透明度成立，就收掉那一项，不扩大到其他演员。

## 版本与使用边界

- **Lvoxx：**LSCherry [`f870dbe` 的 Chiyo 渲染示例](https://github.com/lvoxx/LSCherry/blob/f870dbe7d42b4ff008c2775ec508285bfd4f4ae0/README.md#L139-L150)是作者成图，不是游戏实机；[仓库许可证](https://github.com/lvoxx/LSCherry/blob/f870dbe7d42b4ff008c2775ec508285bfd4f4ae0/LICENSE)。对应研究的 LSPotato `6e5ac0e`，[清单](https://github.com/lvoxx/LSPotato/blob/6e5ac0e52c910525994bfc31f7784fea667f8950/src/blender_manifest.toml#L3-L24)记为 **2.0.1.hf1、GPL-3.0-or-later**，与根目录 [GPLv3 文本](https://github.com/lvoxx/LSPotato/blob/6e5ac0e52c910525994bfc31f7784fea667f8950/LICENSE)相符；README 徽章的 MIT 替代文字不能作为 MIT 授权依据。
- **Juanca-48：**Strinova Toon Setup [`3d707ed`、2.0.0、GPL-3.0-or-later](https://github.com/Juanca-48/Stinova_Importer/blob/3d707eda90f45366cf2c4f09b5ae5bea1f3d14a8/strinova_toon/__init__.py#L1-L11)。[作者说明](https://github.com/Juanca-48/Stinova_Importer/blob/3d707eda90f45366cf2c4f09b5ae5bea1f3d14a8/strinova_toon/shading.py#L1-L12)把从素材观察到的通道、由参数推断的镜面和环境近似明确分开；本文的通道结论只针对该版代码。
- **Stalo：**StarRailNPRShader [`bf44567`、2.10.3](https://github.com/stalomeow/StarRailNPRShader/blob/bf44567f389834b8be5e3095e5ff507caa8764fb/package.json#L2-L7)，[该着色器文件许可 GPL-3.0-or-later](https://github.com/stalomeow/StarRailNPRShader/blob/bf44567f389834b8be5e3095e5ff507caa8764fb/Shaders/Character/CharFaceCore.hlsl#L1-L19)。两款游戏的社区仿制均非原厂着色器源码。
- 上述软件授权不等于获得角色立绘、演示视频、解包贴图、参数库或模型的再分发权。本页只引用链接、观察和接线含义；样板使用有权使用的 PMX 和按其 UV 独立绘制的控制图。官方参照的本机私阅副本与技能片裁切在忽略目录 `local-review/art/strinova-render-study/`，不作为舞台素材或公开文档配图。
