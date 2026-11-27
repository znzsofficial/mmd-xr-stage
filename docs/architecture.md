# 舞台代码从哪里改

屏幕观看与 VR 共用一个舞台入口。读代码时，先区分三种寿命：**页面持有文件与布局，一次观看持有可复用的解码数据，当前房间持有可渲染实例和物理世界。** 切房间只替换最后一层；刷新页面才会清掉背包。

## 源码目录

从 [`src/mmdVrShowcase/`](../src/mmdVrShowcase/) 开始。根目录只放两端共用的入口外壳 `MmdVrOverlay.tsx`、页面状态 `mmdVrStore.ts` 及其测试。其他文件按它负责的功能放置，组件、纯逻辑和测试可以在同一目录。

| 要找的代码 | 从这里进 |
|---|---|
| 进入或退出观看 | [`prep/`](../src/mmdVrShowcase/prep/) 是准备页；[`screen/`](../src/mmdVrShowcase/screen/) 是普通屏幕；[`xr/`](../src/mmdVrShowcase/xr/) 是本产品的 VR 场景、会话和玩家，`xr/contact/` 管手柄、手追和触觉。外层 [`src/xr/`](../src/xr/) 才是通用设备检测与 WebXR 会话基础。 |
| 主 HUD 与背包 | [`hud/`](../src/mmdVrShowcase/hud/) 管 B 键菜单、召回、拖动、公共控件；[`backpack/`](../src/mmdVrShowcase/backpack/) 管本页文件、背包面板、选中项和放置。角色的实时图与转图操作从 [`observation/`](../src/mmdVrShowcase/observation/) 找。 |
| 放置后发生什么 | [`stage/`](../src/mmdVrShowcase/stage/) 负责挂载房间、上场实例、命令和布局快照；[`stage/loading/`](../src/mmdVrShowcase/stage/loading/) 负责加载队列、模型与物件准备；[`mmdRuntime/`](../src/mmdVrShowcase/mmdRuntime/) 负责已挂载 PMX 的动作、材质和物理求值。 |
| 玩法与布景 | 角色操作按 `pose/`、`wardrobe/`、`interaction/`、`bodyState/`、`pelvic/` 查；随身道具在 `play/`，玩家移动在 `movement/`，布景和连接在 `scenery/`。 |
| 改设置或查性能记录 | [`settings/`](../src/mmdVrShowcase/settings/) 负责偏好、画质与调整范围；[`diagnostics/`](../src/mmdVrShowcase/diagnostics/) 负责测量、计时、汇总与导出。 |

## 沿一次放置走读

1. [准备页](../src/mmdVrShowcase/prep/MmdVrPrepApp.tsx)把本地文件交给[背包](../src/mmdVrShowcase/backpack/store.ts)。此时只有目录条目，角色尚未加载，也不占上场名额。
2. [屏幕](../src/mmdVrShowcase/screen/ScreenStage.tsx)和 [XR 场景](../src/mmdVrShowcase/xr/MmdVrScene.tsx)共用 [MmdVrStageContent](../src/mmdVrShowcase/stage/MmdVrStage.tsx)。观看会话持有动作／透明度采样缓存；[StageRoom](../src/mmdVrShowcase/stage/StageRoom.tsx)的寿命由布景切换代次、Three 场景和渲染器身份决定。更换相机不会重建房间。过期房间的帧回调不能读取或清空新房间的待办命令。
3. [放置射线](../src/mmdVrShowcase/backpack/BackpackPlacement.tsx)检查真实地面和遮挡，背包确认后发出带 token 的命令。房间检查命令有效性，通过 [stageActors](../src/mmdVrShowcase/stage/stageActors.ts) 加载或移动实例，成功后才发布上场状态。

   电玩厅上下层共用 XZ；`supportY` 是射线命中面的世界高度，从预览、确认一直传到 `StageRoom`。提交时房间调用 [`resolvePlacementHeight`](../src/mmdVrShowcase/scenery/placementAreas.ts)：`null` 表示拒放，否则将返回的世界高度交给角色或物件。回访从快照的三维位置恢复。
4. 离场时由房间判断快照是否完整。[从背包收回或在详情页移除](./architecture/maintenance.md#移除演员后恢复哪份布局)也会提交当前完整布局，不必等到离场。背包的 `saveBackpackLayout` 一次写入本景布局、按文件身份匹配的摆放记录及动作绑定；切景后重建实例。布局不是一组隐藏的 Three.js 网格，也不保存 Bullet 世界。

## 按改动找入口

想新增会飞、会落或会浮起的道具，先看[重力系统与扩展边界](./architecture/gravity.md)：普通房间和 10 个可步行天体如何取样，及哪些运动仍由玩家马达、演员 Bullet 或屏幕相机负责。

扩展演员显示层、房间编辑命令或 XR 资产／恢复页，先看[已拆出的三个入口](./architecture/maintenance.md#已拆出的三个入口)，其中列出各自的调用时机与实际验收路径。

| 要改什么 | 负责的模块 |
|---|---|
| 角色工具里的动态解剖图 | [`pelvic/atlas/`](../src/mmdVrShowcase/pelvic/atlas/) 的子宫动态按需使用本地 Worker；入口对位和测量剖面在 Canvas 上画[标定投影](../src/mmdVrShowcase/pelvic/sectionProjection.ts)。入口图的文字表独立异步准备，实杆不等字体。运转实测和静止实杆分开发布；待命杆位不能触发开合、计量、外喷或触觉。 |
| 乳房观察与动态图提交 | [乳房观察](../src/mmdVrShowcase/bodyState/breast/)读取当前演员的草稿或保存值。乳房和子宫视角独立，复用[画布与 XR 纹理寿命](../src/mmdVrShowcase/observation/ActorDiagram.tsx)和[位图提交规则](../src/mmdVrShowcase/observation/diagramOutput.ts)。乳房下缘的[短暂回落](../src/mmdVrShowcase/bodyState/breast/settling.ts)仅由主动编辑触发，不写入身体状态；自动回充不应让慢 Worker 永远等不到第一张可显示的图。 |
| 改乳房立绘的轮廓、光影或剖面 | [水滴曲面](../src/mmdVrShowcase/bodyState/breast/art/teardrop.ts)按侧计算基础胸型、充盈与回落；[着色](../src/mmdVrShowcase/bodyState/breast/art/teardropPaint.ts)与[剖切及标注定位](../src/mmdVrShowcase/bodyState/breast/art/teardropCut.ts)读取同一曲面。躯干与配饰在 [`figure.ts`](../src/mmdVrShowcase/bodyState/breast/art/figure.ts)；[合成入口](../src/mmdVrShowcase/bodyState/breast/art/exterior.ts)持有本实例的深度缓冲与组织缓存。离线评审图不参与渲染。 |
| 改外阴外形及受压反应 | [`vulvaForm.ts`](../src/mmdVrShowcase/pelvic/vulvaForm.ts) 定义外侧覆盖、内缘突出、自然不对称三款及偏压拟合；[`vulvaMesh.ts`](../src/mmdVrShowcase/pelvic/vulvaMesh.ts) 给舞台网格和观察画笔提供同一套共边曲面。可选膜缘只改变阴道口旁的组织；有效跨越来自逐帧求解器，图面不写事件、不启用道具。 |
| 骨盆附件的手持／支架、剖面与计量 | [`pelvic/rig.ts`](../src/mmdVrShowcase/pelvic/rig.ts) 在角色求值后检查当帧真实喷口：有效在内计量、确认在外只外喷、其余情况消费触发但不释放。支架与剖面共用校准轨道，不从滑块推断接触。[玩家操作](./gameplay/pelvic-attachment.md) |
| 衣下开启外置附件 | 拟合到裸肤上的选择独立于外部喷口确认。只在开启时给当前演员计算[衣物覆盖图](../src/mmdVrShowcase/pelvic/garmentPrint.ts)，从当帧可见的衣物三角面取样，扫描齐全才供附件材质使用。遮挡边缘不全局关闭网格；更换衣着不取消安装，安装与摘除不重启支架。 |
| 支架手法与摆姿固定点 | [手法轨迹](../src/mmdVrShowcase/pelvic/railTechnique.ts)只存相对本次标定的归一化实杆位置和时间，回放要重新经过现场求解器。固定腕的目标位置和朝向存于[演员坐标系](../src/mmdVrShowcase/pose/poseSolver.ts)，与命名姿势一同按演员保留，不存房间里的绝对坐标。 |
| 可复用的单演员体位 | [内置姿势](../src/mmdVrShowcase/pose/presetShapes.ts)描述躯干朝向、四肢骨段方向和支撑部位。[拟合器](../src/mmdVrShowcase/pose/presetFit.ts)作用于独立的姿势求值器，按演员骨长与脚底拟合；[编辑会话](../src/mmdVrShowcase/pose/poseSession.ts)把整次套用当成一次撤销。没有第二位演员、场景或表演账本的状态依赖。 |
| 定格时裙片穿过大腿 | [裙摆显示层](../src/mmdVrShowcase/mmdRuntime/poseSkirtClearance.ts)在当前演员重置到手动姿势时拟合腿面，服从作者的裙腿碰撞许可；实际交线才激活修正。[应变限幅](../src/mmdVrShowcase/mmdRuntime/clothStrain.ts)保护 UV 接缝、边界和面朝向。它不是 Bullet 碰撞体，不移动腿骨；退出编辑、关物理或换实例时恢复原顶点。[跨裙型检验](./performance/actor-tools-regression.md#手动体位的局部裙片修正) |
| 改姿势后持续贴合衣料 | [摆姿会话](../src/mmdVrShowcase/pose/poseSession.ts)在松手或离散微调后发出定向请求，[显示层](../src/mmdVrShowcase/mmdRuntime/actorPoseDisplay.ts)在新姿态提交后一次消费。仰卧用[裙骨侧滑](../src/mmdVrShowcase/mmdRuntime/hipPanelSlide.ts)，深跪用[有邻面约束的小腿接触](../src/mmdVrShowcase/mmdRuntime/kneelContact.ts)；不向原物理步反馈显示形变。[实操与测量范围](./performance/pose-cloth-contact.md) |
| 道具引起的临时模型形变 | [`roomPropDisplay.ts`](../src/mmdVrShowcase/stage/roomPropDisplay.ts) 管开合形态、[角色表情回应](../src/mmdVrShowcase/play/actorResponse.ts)、软头接触与持棒触觉。帧末依次叠开合形态、实测接触表情、道具接触；下次 VMD／Bullet 求值、姿势编辑或房间退出前逆序还原。同名顶点形态也不能把显示权重留进原动作。 |
| 摆姿势、身体状态及局部剖面 | [`pose/`](../src/mmdVrShowcase/pose/) 管编辑手势、单帧动作和命名姿势；[`bodyState/`](../src/mmdVrShowcase/bodyState/) 管每个资产的身体设置、分侧乳量、预览及显示适配。只有当房间挂载演员时，才关联其骨架／形态。屏幕和 VR 使用同一套命令。[操作与验证](./gameplay/pose-and-body-states.md) |
| 改身体设置编辑页 | [`useBodyEditor.ts`](../src/mmdVrShowcase/bodyState/useBodyEditor.ts) 负责演员归属、翻页和草稿的保存／取消／撤销。[`editor/`](../src/mmdVrShowcase/bodyState/editor/) 生成胸型与模型适配、泌乳与起始存量控件。屏幕与 XR 读取同一份控件数据。 |
| 插入时的受精判定与演出 | [演员账本](../src/mmdVrShowcase/bodyState/reproduction/store.ts)按资产分别保存游戏概率、零至三枚卵子及各自的记录。有未受精卵子且当帧真实内部交付有留存才判一次。[卵子画笔](../src/mmdVrShowcase/pelvic/atlas/conceptionStudy.ts)只读取所选卵子；人体全貌与显微视图独立。重绘、切人、切景和更改概率都不写事件。[玩家规则](./gameplay/pelvic-attachment.md#一次释放的受精演出) |
| 并排操作面板 | [`LivePelvicView.tsx`](../src/mmdVrShowcase/observation/LivePelvicView.tsx) 只保存观察部位，复用完整观察页的画笔，每次只绘制一张。[`Controls.tsx`](../src/mmdVrShowcase/pelvic/Controls.tsx) 布置左右栏，右边的目标不受换图影响。自动往复独立刷新短状态行，已预约的一剂只有当帧有效进入才实际交付。 |
| 阴道剖面 | [前后壁、宫颈及穹隆](../src/mmdVrShowcase/pelvic/atlas/canalGeometry.ts)为同一可旋转剖面。用[实际杆身截面](../src/mmdVrShowcase/pelvic/atlas/canalContact.ts)拟合接触行；滑杆不能撑开内壁。[留存画笔](../src/mmdVrShowcase/pelvic/atlas/retainedFluid.ts)读取当前部位的存量和形变后的壁面，不依据观察页推断释放目标。剖面以硅胶实形示意位置，校准线留在测量页。固定机位、固定样本不重复上传。 |
| 插入面板的外阴与子宫全貌 | [短段入口内壁](../src/mmdVrShowcase/pelvic/atlas/entranceWall.ts)在真实开口后方使用同一深度缓冲，受口缘遮挡；不在 PMX 上新增通道。[总览中的下段剖面](../src/mmdVrShowcase/pelvic/atlas/overviewTract.ts)读取同一实测杆身，独立于缓存的宫体与两侧附件。冻结示意时新测量仍能绘制。 |
| 收起身体工具，看舞台／继续编辑 | [屏幕面板导航](../src/mmdVrShowcase/screen/useScreenPanels.ts)和 [XR 演员工具](../src/mmdVrShowcase/backpack/BackpackWorldTools.tsx)暂时保留同一运行实例的编辑器。收起时卸下控件和图，不复制、保存或丢弃草稿。换演员、实例、房间不是收起。 |
| 演员首页的服装、互动和身体观察 | [ActorActivities](../src/mmdVrShowcase/interaction/ActorActivities.tsx)只保存当前演员的短导航路径。打开[衣柜](../src/mmdVrShowcase/wardrobe/WardrobeControls.tsx)或[身体观察](../src/mmdVrShowcase/observation/ActorObservation.tsx)不会让 UI 接管舞台求值。上半身近景由[屏幕镜头](../src/mmdVrShowcase/screen/upperBodyView.ts)按当前角色姿势取景，不作接触标定，也不控制 XR 视点。 |
| 单角色 XR 支架何时收起 | [ActorActivities](../src/mmdVrShowcase/interaction/ActorActivities.tsx) 的插入操作持有支架的界面寿命。打开衣柜详情只替换当前控件；返回时保留同一演员、支架和标定。离开整条插入操作时清理，已明确交给手柄的道具由房间接管。 |
| 舞台泌乳 | [`outlets.ts`](../src/mmdVrShowcase/bodyState/lactation/outlets.ts) 把作者的局部顶点形态绑定到实际皮肤表面；[房间](../src/mmdVrShowcase/bodyState/lactation/roomMilk.ts)只接收当次分侧扣量，在角色求值后更新遮挡和可见液滴。HUD 显示这笔操作是否获房间接收，不从回充、滑杆或读图倒推。 |
| 默认设置、合法值、v1/v2 偏好兼容 | [`settings/preferences.ts`](../src/mmdVrShowcase/settings/preferences.ts)。首次进入、读取旧记录和场内更新共用同一套规则；[`mmdVrStore.ts`](../src/mmdVrShowcase/mmdVrStore.ts) 发布状态和操作。文件、布局和运行时句柄不属于偏好。 |
| 某一间房的模型、入口、机位、遮挡 | [`scenery/`](../src/mmdVrShowcase/scenery/)；按[布景接入指南](./scenery/adding-a-set.md)改注册表和本景布局。菜单切景是否重置视角由 `catalog.ts` 决定；步行跨门由 `connections.ts` 的平移数据决定。 |
| 让两景共用一段可走的街 | [`routes/types.ts`](../src/mmdVrShowcase/scenery/routes/types.ts) 定义扩建区域的地面、摆位和遮挡接口。两景各用本地坐标引用同一份道路布局；[`connections.ts`](../src/mmdVrShowcase/scenery/connections.ts) 判断是否真正穿过门口。XR 与[屏幕步行](../src/mmdVrShowcase/screen/streetTravel.ts)共用门线；屏幕跨门时平移相机和环绕目标，XR 跨门时平移追踪原点。 |
| 哪些楼面可指、哪些点能摆角色 | [`placementAreas.ts`](../src/mmdVrShowcase/scenery/placementAreas.ts) 为每个 `SceneryId` 登记落点解析、拾取平面和视线遮挡。模型和烘焙脚本直接读所属布景的布局数据；例如草坪的树丘在 [`meadowPlanting.ts`](../src/mmdVrShowcase/scenery/meadowPlanting.ts)，不会因为要画一棵树而导入所有布景的摆位规则。 |
| 多景共用的天空、灯、网格和地台 | [`stage/StageEnvironment.tsx`](../src/mmdVrShowcase/stage/StageEnvironment.tsx) 只按当前房间的配置和画质绘制布景。新放置与移动已有资产都由 [`BackpackPlacement.tsx`](../src/mmdVrShowcase/backpack/BackpackPlacement.tsx) 拾取和校验：按下预览，松开有效落点才提交。 |
| 共用灯光预设或布景的灯光覆盖值 | 六套预设在 [`stage/lighting.ts`](../src/mmdVrShowcase/stage/lighting.ts)，单景覆盖值在 [`scenery/roomSets.tsx`](../src/mmdVrShowcase/scenery/roomSets.tsx)。房间求值一次，让布景与 MMD 角色共用同一个主光源。 |
| 摄影棚实景灯控 | [`velvetLight.ts`](../src/mmdVrShowcase/scenery/velvet/velvetLight.ts) 保存本页灯轨和强度。只有私摄棚订阅调节，`StageRoom` 将同一组灯光参数同时交给布景和 PMX；换档不重建房间。 |
| 增加能用射线点击的场内机关 | [`useSceneAction`](../src/mmdVrShowcase/scenery/input/useSceneAction.ts) 管鼠标点选、XR 按下归属、松开复验及输入中断。喜房帘绳和灯台共用它；遮挡、动画、改变哪盏灯及是否跨房保留仍归各自布景。[两种拟议的接入例子](./gameplay/interactive-scene-studies.md) |
| 星球的测站、风口、到站镜头 | [`windAtlas.ts`](../src/mmdVrShowcase/scenery/planet/windAtlas.ts) 每个目的地持有自己的测站、设备类型与机位键，屏幕到站、阴影和碰撞均引用同一测站；[`moonSurface.ts`](../src/mmdVrShowcase/scenery/planet/moonSurface.ts) 提供径向地形和对应网格，无需挂载 React 组件即可检查脚底与壳面。 |
| 母星航向盘与仪表底座 | [航向刻度](../src/mmdVrShowcase/scenery/planet/departureDial.ts)按每条风道的真实出发点生成。航线牌用[固定安装坐标与分段实体盒](../src/mmdVrShowcase/scenery/planet/windTerminalLayout.ts)，喷嘴经[实际壳面三角形](../src/mmdVrShowcase/scenery/planet/windCollarBed.ts)贴地；采谱读头的[背板和支架](../src/mmdVrShowcase/scenery/planet/surveyHardware.ts)也供碰撞与视线复用。 |
| 恢复旧星系摆位 | 屏幕和 XR 共用的房间入口在加载演员前调用 [`restoreNorthDeck.ts`](../src/mmdVrShowcase/scenery/planet/restoreNorthDeck.ts)。旧 07 干台上的角色和物件避开北台已有落点，继续使用原布局的动作绑定和播放进度。 |
| 创建角色运行时、连接手追／手柄碰撞或 GPU 预热 | [`stage/createRoomRuntime.ts`](../src/mmdVrShowcase/stage/createRoomRuntime.ts) 组装依赖；MMD/Bullet 实现在 [`mmdRuntime/`](../src/mmdVrShowcase/mmdRuntime/)。句柄在房间的 layout effect 提交，加载、换物理与逐帧更新归房间。 |
| XR 会话创建、绑定和首帧 | [`src/xr/`](../src/xr/) 与[会话生命周期](./xr-session-lifecycle.md)。普通屏幕不申请 XR 会话。 |
| 玩家行走、跳跃、碰头或穿模飞行 | [`movement/`](../src/mmdVrShowcase/movement/)：`roomGround.ts` 管玩家通行范围和入口，`solidColumns.ts` 查附近实际几何，`groundMotor.ts` 管普通模式运动，`usePlayerMovement.ts` 接 XR 姿态、输入和切景。它们不借用角色 Bullet 世界，也不改变背包放置规则。[操作](./gameplay/vr-controls.md#普通与自由移动) |

**改完怎样验：** 偏好迁移看 `settings/preferences.test.ts`；放置、迟到加载、StrictMode、物理切换与回场看 `stage/MmdVrStage.test.tsx`。改公共渲染时，另用生产构建进屏幕和模拟 XR，固定灯光、机位比较实际画面。关物理时的 VMD 时间与暂停时仍可推进的 XR 物理时间，见[性能文档](./performance/README.md)。
