# MMD VR 展示器 — 路线图

最后更新：2026-08-04（参数渐进披露 + 物理恢复错误分级）

> **当前产品重心**（VR 桌面已基线收尾并搁置，见 [vr-desktop-roadmap.md](./vr-desktop-roadmap.md)）

相关：[mmd-studio.md](./mmd-studio.md) · [vr-desktop-roadmap.md](./vr-desktop-roadmap.md) · [README.md](./README.md)

---

## 1. 产品定位

**MMD VR Showcase** 是浏览器内的 **独立 WebGL + WebXR 展示会话**：在头盔里导入有限数量的模型与动作，**行走查看**，播放预览；**不是** MMD Studio 进 VR，也 **不是** VR 桌面里的嵌套应用。

| | MMD Studio（2D） | VR 桌面 | MMD VR 展示器 |
|--|------------------|---------|----------------|
| 会话 | 桌面 Canvas | 独立 immersive-vr 工作台 | **另一套** immersive-vr 舞台会话 |
| 渲染 | WebGL 成片；WebGPU TSL 实验 | WebGL + WebXR | **仅 WebGL + WebXR** |
| UI | 完整 DOM 侧栏 / 时间轴 / 工程 | canvas 面板 + 射线 | **极简 canvas HUD** + 射线 |
| 目标 | 制作 / 导出 | 工作台 | **观看 / 简单摆放** |

### 1.1 成片原则

1. **独立会话** — 与 VR 桌面、与 Studio WebGPU **不同时**共用同一 XR / 渲染后端；进展示器 = 新 `requestSession`（或明确结束当前会话后再进）。  
2. **WebGL only** — 禁止 WebGPU TSL、禁止 Studio 全量 `postprocessing` 栈。  
3. **有限场景** — 模型 / 动作数量有硬上限；默认关物理。  
4. **可走可看** — 支持在舞台空间内 **平滑移动（行走）+ 转向** 观察模型；注意晕动预算。  
5. **复用 runtime，不复用 Studio UI** — 加载 / 动画步进走 `mmdRuntime`（或抽出的 shared 子集）；控件全部 XR 原生重做。  
6. **后续可加轻量视觉** — 仅廉价、可关、进画质档的效果；不为「像 Studio」堆特效。

### 1.2 非目标（刻意不做）

| 非目标 | 原因 |
|--------|------|
| 完整 Studio 迁入 VR / VR 桌面嵌 Studio | DOM UI、后处理、Gizmo、工程库与 XR 模型冲突 |
| WebGPU / TSL 作展示后端 | 与 WebXR 成片路径冲突；文档已禁 |
| 全量后处理（bloom/SSR/DoF/…） | 立体 + Quest 预算；后续仅允许 **白名单轻量** 项 |
| 项目 DB / WebCodecs 导出 / 实时录制 | 展示器范围外 |
| 桌面 Gizmo / Orbit 直接复用 | 指针模型不同；改用行走 + 可选简单 TRS |
| 无限模型 / 文件夹批导入 UX | 头盔输入与内存；见上限表 |
| 把展示器做成 VR 桌面启动台「假窗」 | 产品分会话；可从 2D/设置 **入口跳转**，不嵌入面板 |

---

## 1.3 实现状态（代码）

| 项 | 状态 | 路径 |
|----|------|------|
| 独立会话 / overlay | ✅ | `src/mmdVrShowcase/*` + `src/xr` |
| 设置入口 + 画质细项 / FPS | ✅ | `SettingsApp` 开发者区 |
| 独立准备页导入模型 | ✅ | `mmd-vr.html` → pending assets |
| 舞台 + WebGL runtime | ✅ | `MmdVrStage` + `createMmdRuntimeHandle` |
| 播放 / 循环 / 重置视角 / 退出 | ✅ | `MmdVrHud` |
| 进度条 seek | ✅ | `mmdVrClock` + HUD（热路径不写 React） |
| 灯光预设 6 套 | ✅ | stage / soft / daylight / warm / rim / contrast；预设提供配色和强度基线，天空 / 雾 / 轮廓光 / 地面光池可独立开关 |
| 模型显隐（≤3） | ✅ | visibility 队列 |
| 平滑行走 + snap 转向 | ✅ | `useXRControllerLocomotion` |
| 与 VR 桌面互斥 | ✅ | `requestImmersiveEnter` |
| 点地放置模型 (M13) | ✅ | placeMode + 地面射线 |
| 模型连续缩放 / 旋转 / 复位 | ✅ | 每模型 HUD；复位恢复初始队列位置 |
| 用户身高补偿 | ✅ | -5m–+50m HUD 滑条 + 右摇杆纵轴连续调节 |
| VR 内快速设置 | ✅ | 行走速度 / FPS / 主题色 |
| HUD 空间拖动 | ✅ | 沿控制器射线调整三维位置 |
| 空态 / 错误态文案 (M14) | ✅ | emptyNoAssets / loadFailed |
| 渐变天空穹顶 (V3) | ✅ | StageSky 随灯光预设配色，可在视觉面板独立开关 |
| face 动作单轨 (M11) | ✅ | 准备页选择，加载后与 body 合并 |
| Quest 预设三档 + 明确刷新率 72/80/90/120 | ✅ | `MmdVrPrepApp` 预设 + `mmdVrQuality` |
| 准备页参数渐进披露 | ✅ | 默认保留 Quest 预设与主题；渲染细项、移动、FPS、诊断收进“高级画面与诊断”，存储 schema 不变 |
| 实验渲染覆盖（framebuffer scale / foveation） | ✅ 默认关；高级区显式开启后生效 | `mmdVrSession` / 准备页 |
| 旧偏好迁移（v1 key / 旧刷新率枚举 high-mid-low） | ✅ | `settingsBackup` + `mmdVrStore` |
| Bullet 物理开关 + 控制器碰撞（X1） | ✅ 实验，默认关 | `MmdVrControllerColliders` |
| 物理质量档 / 时间步钳制 / 震动三档 | ✅ | low/medium/high；50ms 钳制；off/low/normal |
| 物理参数设置（跟随度 / 碰撞摩擦 / 碰撞弹性） | ✅ 会话级三档循环 | `mmdPhysics` boneFeedbackScale / collider friction / restitution |
| 动态衣物同组互撞 | ✅ 实验，默认关；切换时重建物理 | 为非静态刚体补上自身 collision group bit；相连刚体仍由 Bullet 排除碰撞 |
| 物理重建恢复错误分级 | ✅ | 普通失败提示已恢复旧状态；重建与恢复双重失败使用稳定错误码，卸载失效模型并提示退出重进 |
| 详细物理诊断 | ✅ | `physicsDebugEnabled` + HUD 叠加 |
| 环境物件 glTF/GLB（A6） | ✅ | 轻量旁路，不进 mmdRuntime |
| HUD 面板 billboard 跟随用户 | ✅ 默认开；`panelFollowUser` 持久化开关 | yaw-only，`MmdVrHud` useFrame |
| 光照预设场景联动 | ✅ | 天空 / 雾 / 轮廓光 / 地面光池沿用预设色温，但显示状态独立 |
| 多文件夹导入累加 + 手动删除 | ✅ | `MmdVrPrepApp` merge / remove |
| XR 内导入 / 多动作列表 | ❌ | v0.1 余下 |
| 角色 / 场景资产类型 | ❌ | v0.3；当前 PMX 使用同一模型槽位 |
| 轻量视觉白名单其余 | 部分 | V1 exposure、V2 逐材质自发光增强已实现；其余 v1.1 |
| 音频播放（BGM） | ❌ | 完全缺失；无 audio 元素、无加载、无同步 |
| VR 内换动作 | ❌ | `loadMotion` 仅初始加载调用一次 |
| VR 内恢复加载失败 | ❌ | 失败仅显示文案，须退出重进 |
| 表情 / morph 手动控制 | ❌ | Runtime 支持但 HUD 无 morph UI |
| 物理参数持久化 | ✅ | boneFeedback / friction / restitution / quality / radius / hapticLevel 进 MmdVrPrefs |
| 热路径 GC 优化 | ✅ | 冻结哨兵 + WeakMap 缓存单材质数组 |
| 进度条拖拽 scrub | ✅ | 支持指针拖动，沿进度条连续 seek |
| 材质面板（显隐 + opacity/roughness/metallic） | ✅ | 独立浮动面板，两级导航（列表 + 详情），分页，从模型面板"材质"按钮打开 |
| 震动开关持久化 | ✅ | `physicsHapticLevel` 进 MmdVrPrefs，默认 low（开） |
| 加载进度反馈 | ⛔ 已回退 | `setTimeout` 在 XR 沉浸模式下被延迟，导致加载卡死 |

---

## 2. 范围边界（v0 约定）

### 2.1 资源上限（初值，可手测后调）

| 项 | 初值上限 | 说明 |
|----|----------|------|
| 同时加载模型 | **1–3** | 默认 1；UI 明确「已达上限」 |
| 每模型 body 动作 | **1** 主轨（可换） | 不设多轨混叠时间轴 |
| face / morph 动作 | **0–1** 可选 | v0 可仅 body |
| camera 动作 | **不做**（v0） | 相机以用户行走为准 |
| 贴图分辨率 | 随画质档降采样可选 | 低档优先稳帧 |
| Bullet 物理 | **默认关** | 后续可选实验，不进默认 |

### 2.2 交互（目标体验）

| 能力 | v0 | 后续 |
|------|----|------|
| 进入 / 退出 XR | ✅ | — |
| 平滑行走（摇杆/拇指） | ✅ | 速度档、晕动选项 |
| Snap 或平滑转向 | ✅ 至少一种 | 与 VR 桌面策略对齐可调 |
| 播放 / 暂停 / 重播 / 循环 | ✅ | 简易进度条 |
| 导入模型（PMX 等） | ✅ 有限；优先 2D 预选再进 VR，或 XR 内文件选择（能力因平台） | 最近使用列表 |
| 导入 / 切换动作（VMD 等） | ✅ 单 body + 单 face | 每模型动作配置、多动作列表 |
| 模型位姿微调 | ✅ 点地位置、Y 轴旋转、连续缩放、复位 | 轴约束拖动 |
| 舞台地面 / 简单灯光 | ✅ | 天空 / IBL 轻量 |
| 画质档 | ✅ 高/均衡/低 | 与视觉开关绑定 |
| 轻量视觉效果 | ❌ v0 | 见 §4 v1.1 |

### 2.3 入口（产品流）

推荐顺序（可并存）：

```
2D MMD Studio 或 设置 / 控制中心
  →「VR 展示」/ requestMmdVrEnter（click 内）
      · 可选：Studio 写入 pending assets
      · openOverlay + preload + requestSession（并行）
  → AttachPending：gl.xr.setSession(pending)
  → 加载 session assets → 行走 / 播放 / HUD
  → 退出 → 回 2D（不自动进 VR 桌面）
```

- **不**从 VR 桌面 `openApp` 嵌展示器。  
- 若用户已在 VR 桌面：须 **先结束 VR 桌面会话** 再进展示（或入口禁用并提示）。  
- HTTPS / 手势规则与 [vr-desktop-roadmap.md](./vr-desktop-roadmap.md) §5 一致。

---

## 3. 工程结构（当前）

```
src/xr/                      # 与 VR 桌面共用的 WebXR 核心
  createProductXrSession · qualityAxes · createXrSceneMountGuard …

src/shared/panelTexture.ts   # createPanelTexture / secondary btn / FPS（无 React）

src/mmdVrShowcase/
  requestMmdVrEnter.ts       # → requestImmersiveEnter + assets 握手
  mmdVrSession.ts            # → createProductXrSession（独立实例）
  mmdVrStore.ts · mmdVrQuality.ts · mmdVrAssets.ts · mmdVrClock.ts
  MmdVrOverlay.tsx · MmdVrScene.tsx
  components/                # Stage / Hud / PlayerRig / SessionBridge
```

**复用**

| 复用 | 不复用 |
|------|--------|
| `src/xr` 进入 / attach / quality 轴 / lifecycle | 与 VR 桌面**分会话实例** |
| `shared/panelTexture` HUD 按钮 | 不依赖 `vrDesktop/*` |
| `mmdRuntime` 加载与 per-frame 更新（WebGL） | `MmdSidePanel` / 完整 Studio store UI |
| loader / 材质 WebGL 路径 | `mmdTslPipeline` / WebGPU bridge |
| 画质预设 + 细项（共用轴 + 本产品 knobs） | Studio `MmdPostFx` 全栈 |

依赖：已有 `three` · `@react-three/fiber` · `@react-three/xr` · `@yohawing/three-mmd-loader`；**不**为展示器新增 WebGPU 路径。

---

## 4. 阶段规划

### v0 — 可玩展示（MVP）

目标：Quest 上能进、能走、能播 1 个模型 + 1 个动作。

| ID | 任务 | 优先级 | 验收 |
|----|------|--------|------|
| M0 | 独立入口 + lazy Scene + 会话进入/退出 | P0 | ✅ 设置 / Studio；`src/mmdVrShowcase` |
| M1 | 舞台：地面、基础方向光、环境光、参考网格（可关） | P0 | ✅ `MmdVrStage` |
| M2 | 加载 1 模型（WebGL runtime）并显示 | P0 | ✅ pending assets → `addModel` |
| M3 | 加载 1 body 动作；播放/暂停/循环 | P0 | ✅ HUD；face 可选随清单 |
| M4 | 行走 locomotion + 转向 | P0 | ✅ 平滑走 + snap 30° |
| M5 | 画质三档（dpr / 阴影 / 网格） | P1 | ✅ prefs + `mmdVrQuality` |
| M6 | 有限导入：第 2–3 模型或换动作（达上限提示） | P1 | 部分：Studio 最多送 3；XR 内导入未做 |
| M7 | 2D 预选清单 → VR 读取（推荐路径） | P1 | ✅ 独立准备页 |
| M8 | Quest 手测记录（机型 / 档 / 模型复杂度） | P0 | 部分：已确认进入、加载与 HUD；型号/FPS/复杂度矩阵待记录 |

### v0.1 — 导入与清单打磨

| ID | 任务 | 说明 |
|----|------|------|
| M10 | 最近使用 / 会话清单持久化（localStorage） | 体积与权限注意；只存句柄元数据时需设计 |
| M11 | face/morph 动作可选一条 | ✅ 准备页可选一条 face VMD；无完整 morph 浏览器 |
| M12 | 模型列表：显隐 / 移除 / 切换当前动作 | 部分：显隐、目标选择、缩放、旋转、复位已做；移除/换动作未做 |
| M13 | 简单模型位姿（射线点地放置或轴约束拖） | ✅ 点地放置、Y 轴 15° 旋转、连续缩放和整模型复位；不做完整 Gizmo |
| M14 | 空态 / 错误态文案（中英若项目已有 i18n） | ✅ 无资产 / 加载中 / 失败 |

### v0.2 — Quest 稳定性签字（当前）

| ID | 任务 | 状态 / 验收 |
|----|------|-------------|
| S1 | Quest 会话可靠进入 | ✅ 默认不应用 framebuffer scale / foveation；仅实验渲染覆盖显式开启时在会话配置阶段应用 |
| S2 | 角色材质正确性 | ✅ 不强制 DoubleSide；只禁用动画模型视锥剔除 |
| S3 | 双眼 HUD 与滑条 | 部分：透明排序已修；待 Quest 复测可见性与可读性 |
| S4 | 真机性能矩阵 | ⬜ 记录设备、系统、模型复杂度、1/2/3 模型和高/均衡/低档 FPS |
| S5 | 设置真实性 | ✅ 默认隐藏 framebuffer scale / foveation 控件；「实验渲染覆盖」显式开启后展示并生效，避免暴露无效设置 |
| S6 | 物理时间步稳定 | ✅ 模拟增量钳制 50ms（`clampMmdVrSimulationDelta`，与 Studio 一致）；固定步进累加器入 X6 |
| S7 | 物理质量档与诊断 | ✅ 会话内 低/中/高（默认中）+ HUD 碰撞诊断；自适应策略入 X9 |
| S8 | 碰撞震动反馈 | ✅ 三档 off/low/normal（默认 low）+ 冷却/防抖 + 速度映射；冲量与连续反馈入 X10–X13 |

### v1 — 观看体验

| ID | 任务 | 说明 |
|----|------|------|
| M20 | 固定观赏点 / 重置视角 | ✅ 重置视角 |
| M21 | 简易进度条（时间或帧） | ✅ HUD 进度条可点 seek |
| M22 | 灯光预设 2–3 套 | ✅ 扩展为 6 套：stage / soft / daylight / warm / rim / contrast；雾 / 地面 / 天空底部改为随预设联动并统一色温（原雾与地面写死深色，导致亮色预设下天空与场景撕裂） |
| M23 | 可选地面阴影（map，低成本） | ✅ 画质细项 shadows |
| M24 | 与 Studio 资源握手（可选） | ⛔ 已取消；保持页面/renderer 隔离 |
| M12 | 模型列表显隐 | ✅ 最多 3 条 HUD 切换 |

### v0.3 — 资产与观看闭环（下一阶段）

| ID | 任务 | 说明 |
|----|------|------|
| A1 | 角色 / 场景资产类型 | 准备页显式指定；场景不计入角色动作逻辑，材质面策略分离 |
| A2 | 每模型动作配置 | 每个角色独立选择 body / face，不再把同一动作应用到全部模型 |
| A3 | VR 内移除模型 | ✅ 模型卡片内移除；释放 runtime、材质、贴图、动作和独立 Bullet world |
| A4 | 模型级完整复位 | ✅ 初始位置、旋转和缩放已实现；真机确认交互文案 |
| A5 | 加载预算提示 | 准备页显示文件体积；能可靠读取时再增加顶点/贴图提示 |
| A6 | 环境物件 glTF/GLB（轻量旁路） | ✅ 准备页可选 glTF/GLB 场景物件（上限 3 个）；**不进 mmdRuntime**，用 `GLTFLoader` 直接加载为 `THREE.Group` 与角色同场景共存；支持显隐 / 放置 / 缩放 / 旋转 / 移除；**无动画、无物理、无 morph**；`.glb` 自包含直接加载，`.gltf` 外部资源（bin/纹理）按目录同伴文件做 URL 改写；资源随移除 / 退出释放 |

### v0.4 — 舒适性

| ID | 任务 | 说明 |
|----|------|------|
| C1 | Snap turn 角度 | ✅ VR 内 15° / 30° / 45° 循环；默认 30° |
| C2 | 移动方向 | 头部朝向 / 左手控制器朝向 |
| C3 | 坐姿 / 站姿预设 | 复用现有身高补偿，不引入第二套高度状态 |
| C4 | 移动暗角 | 仅在 M8 表明有必要时实现；必须可关 |

### v0.5 — HUD 信息架构（后续）

保持 `MmdVrPrefs` 扁平字段、localStorage key 和 settings backup v2 不变，只重组 XR 内呈现。该阶段必须在 Quest 上验证按钮尺寸、射线可达性和双眼可读性，不能仅按桌面截图完成。

| ID | 任务 | 说明 |
|----|------|------|
| H1 | HUD 四分组 | 舞台 / 移动 / 物理 / 诊断；主面板只保留播放、放置、物理、重置和退出等高频操作 |
| H2 | 参数归位 | 部分完成：`exposure` 已移入独立视觉面板；`snapTurnDegrees` 尚待移入移动页 |
| H3 | 文案结构化 | 将 `MmdVrScene → PlayerRig → ControlBar` 的逐项 label props 改为结构化 labels，避免每增一项修改多层签名 |
| H4 | 操作状态 | HUD 显示 enable / disable / rebuild 进行中状态，并保持恢复失败提示优先于普通空态 |

### v1.1 — 轻量视觉效果（白名单）

原则：**默认关或随「高」档**；每项可单独关；禁止引入 Studio 级 EffectComposer 全家桶。

| ID | 候选效果 | 条件 |
|----|----------|------|
| V1 | 简单色调 / exposure | ✅ VR 内 0.7–1.3 调节；持久化偏好 |
| V2 | 轻 bloom 或仅 emissive 增强 | ✅ 逐材质自发光强度 0–2；默认 0；复用现有 MMD shader uniform，无后处理 pass，因此不限定高档 |
| V3 | 简单天空色 / 渐变背景 | ✅ StageSky 穹顶 + 灯光预设色；视觉面板独立开关 |
| V4 | 可选 HDR/IBL（低分辨率 PMREM） | 手测后；低档关 |
| V5 | 雾 / 暗角 | 雾已实现并可独立开关；暗角未做 |

**明确延后**：SSR、DoF、体积光、复杂 LUT 链、TSL toon 专用路径。

### v1.2 — 审计补缺（已知缺口）

> 2026-07-31 全面审计后发现的功能缺口。按严重度排列。

| ID | 任务 | 严重度 | 说明 |
|----|------|--------|------|
| G1 | 音频播放（BGM） | 高 | 完全缺失：无 audio 元素、无加载入口、无音频同步。准备页无音频文件选择器，`mmdVrAssets` 无音频字段，`MmdVrStage` 无 audioRef。Studio 有完整音频同步（`MmdCanvas.tsx:990` 用 `audio.currentTime` 驱动时间轴）。需在准备页加音频选择、`mmdVrAssets` 加 `audioFile`、`MmdVrStage` 加 audio 元素并与 `mmdVrClock` 同步 |
| G2 | 物理参数持久化 | ✅ | `physicsQuality` / `physicsColliderRadius` / `physicsBoneFeedback` / `physicsColliderFriction` / `physicsColliderRestitution` / `physicsHapticLevel` 移入 `MmdVrPrefs` + `settingsBackup` schema，跨会话持久化；hapticLevel 默认从 off 改为 low（默认开） |
| G3 | VR 内换动作 | 中 | `runtime.loadMotion()` 仅初始加载调用一次（`MmdVrStage.tsx:545,553`），store 无换动作 action，HUD 无换动作按钮。换动作须退出 VR → 准备页改 → 重新进 VR → 重新加载全部模型。应在 HUD 加换动作入口，store 加 `requestMotionLoad` action |
| G4 | VR 内恢复加载失败 | 中 | 模型加载失败仅显示文案（`MmdVrStage.tsx:587`），无重试 / 换模型按钮。须退出重进。应在 HUD 加重试入口或允许 VR 内重新选文件 |
| G5 | 表情 / morph 手动控制 | 中 | Runtime 支持 `setMorphWeight()`（`mmdRuntime.ts:824`），`applyMorphOverrides` 每帧调用（`mmdRuntime.ts:958`），但 VR HUD 无 morph UI。face VMD 的 morph 轨道会播放，用户无法手动调节。应在模型面板加 morph 滑条或独立 morph 面板 |
| G6 | 热路径 GC 优化 | ✅ | `takeModelRemovals` / `takeVisibilityToggles` / `takeModelTransformRequests` 空队列返回冻结哨兵；`getMeshMaterials` 用 `WeakMap` 缓存单材质数组，消除每帧分配 |
| G7 | 进度条拖拽 scrub | ✅ | `ProgressBar` 支持指针捕获和 `onPointerMove`，沿进度条连续 seek |
| G8 | 渲染器显式 dispose | ✅ | `MmdVrScene` unmount 时通过 `onCreated` 捕获 `gl` 并在 cleanup effect 中 `gl.dispose()` |
| G9 | 控制器丢失追踪时物理跳过 | 不做 | 未使用控制器时会切换到手部追踪，不采用“丢失控制器跳过物理”的优化路径 |
| G10 | 材质面板 | ✅ | 独立浮动面板，从模型面板"材质"按钮打开。两级导航：材质列表（每页 7 个 + 分页）→ 材质详情（opacity / roughness / metallic 滑条 + 显隐开关）。`MaterialPanel` 条件挂载（`materialPanelModelId != null`），关闭时完全卸载 |
| G11 | 加载进度反馈 | ⛔ 已回退 | 曾尝试 `yieldToBrowser()`（`setTimeout(0)`）在模型间让出主线程 + 显示 `(2/3)` 进度。但 `setTimeout` 在 WebXR 沉浸模式下被浏览器延迟执行（优先 XR 渲染循环），导致 `await` 不 resolve → 加载流程卡住 → Quest 卡在 VR 加载动画。已回退为原始同步加载 |
| G12 | 材质状态清理 | ✅ | `syncMaterialModels()` 按当前 runtime 模型整体重建材质映射，空资源时清空，移除模型后不再残留无效条目 |
| G13 | 暂停动画时手部碰撞 | 中 | 当前暂停后 `MmdVrStage` 仍调用 `runtime.update()`，但动画时间不变；`three-mmd-loader` 根据连续 update 时间计算 `deltaSeconds`，因此 Bullet 不再步进，控制器矩阵虽更新但碰撞不响应。正确方案是为动画和物理维护独立时钟：暂停时固定 `animationSeconds` 以保持动画姿态，继续增加 `physicsSeconds` 以驱动 Bullet。需要先扩展 `three-mmd-loader` 的 update API 支持独立 `physicsSeconds`，再修改项目 runtime、seek/reset/loop 语义，并补充暂停、seek、循环和 Quest 真机测试。 |

### v2 — 可选进阶（低优先级）

| ID | 任务 | 说明 |
|----|------|------|
| X1 | Bullet 物理开关（实验） | ✅ 会话内默认关；左右 grip 各注入 8cm 静态球体；已含 50ms 时间步钳制、质量档、碰撞诊断与速度映射震动三档；Quest 真机碰撞、性能与手感待验收 |
| X2 | 双柄缩放舞台或模型 | 晕动与误触 |
| X3 | 手部追踪实验 | 默认关 |
| X4 | 从 VR 桌面「切换会话」引导 | 仍分会话，只做流程文案 |
| X5 | camera 动作轨道（可选） | 与用户行走互斥策略要先定 |
| X6 | 物理固定时间累加器 | 当前已将 XR 卡顿帧的模拟增量限制为 50ms；后续评估独立 `1/60s` 累加器与每帧追赶预算，兼顾动画、音频和循环同步 |
| X7 | 物理启动预热 | 模型和动作加载后执行有限预热步，减少头发、裙摆和软体的开场瞬态；需先测 Quest CPU 峰值 |
| X8 | 手柄碰撞轨迹稳定化 | 为控制器刚体增加速度限制或分段插值，减少快速挥动时的穿透和冲量突变 |
| X9 | 物理质量自适应策略 | 优先降低渲染负载以保持稳定步进；评估基于持续帧时间调整 solver 档位，避免频繁切换 |
| X10 | 基于 Bullet 冲量的震动 | 当前已按手柄移动速度映射轻触/重碰强度；后续暴露接触冲量或相对法向速度，使模型主动撞向静止手柄时也能准确反馈 |
| X11 | 按刚体类型区分反馈 | 保留接触刚体索引并映射骨骼/用途，为头发、裙摆、身体和场景物件提供不同反馈；不得以接触点数量直接代表撞击强度 |
| X12 | 持续接触材质反馈 | 仅作为默认关闭的实验模式，限制更新频率、占空比和强度；释放、失去追踪或退出会话时必须立即停止 |
| X13 | 物理步内震动接触信号 | 当前 30Hz 采样可能漏掉短于 33ms 的碰撞，且仍受 256 条诊断接触保护上限影响；后续在物理步内用单次无分配扫描累积每手 onset 标志，避免短碰撞丢失、密集布料假阴性和诊断数组热路径分配 |
| X14 | 静态模型物理持续抖动 | ⬜ 已知缺陷（部分缓解）：无动作时开启物理，部分模型衣物/裙摆持续抖动。已尝试对齐官方 solverIterations=20、physicsOnlyTime 5s settle 上限（冻结 deltaSeconds）、boneFeedbackScale 三档调节，均未根治。官方 viewer 暂停时 elapsedSeconds 冻结→deltaSeconds=0→Bullet 完全不步进，而我们暂停+物理开时仍需步进以维持控制器碰撞。**根因已定位**：IK 在无 body 动画时仍开启（`ik: true`），IK solver 在 rest pose 上产生微修正 → Bullet 读取修正后的骨骼旋转 → 输出物理修正 → `skeleton.update()` 应用到所有骨骼 → 下一帧 IK 读取 Bullet 修改的骨骼 → 不同 IK 结果 → 不同 Bullet 输入 → 持续振荡。有 body 动画时不发生（动画每帧覆写骨骼打断反馈环）。**已应用缓解**：`ik: entry.bodyAnimation != null`（对齐官方 viewer 的 `hasCurrentMotion()` 逻辑），残余抖动可能来自 Bullet 自身约束求解残余。控制器碰撞开启时不冻结时间线（需 deltaSeconds>0 解决穿透），抖动会回来——交互性优先 |

---

## 5. 与其它模块关系

```
                    ┌─────────────────┐
                    │  2D 桌面 / 设置  │
                    └────────┬────────┘
           ┌─────────────────┼─────────────────┐
           ▼                 ▼                 ▼
   ┌───────────────┐  ┌─────────────┐  ┌──────────────────┐
   │ MMD Studio    │  │ VR 桌面     │  │ MMD VR 展示器    │
   │ WebGL (+TSL)  │  │ WebGL XR    │  │ WebGL XR 舞台    │
   └───────┬───────┘  └─────────────┘  └────────▲─────────┘
           │     runtime 子集 / 临时清单          │
           └────────────────────────────────────┘
```

| 关系 | 约定 |
|------|------|
| vs Studio | 展示器 **消费** 加载能力；不反向把 XR UI 塞进 Studio |
| vs VR 桌面 | **分会话**；能力不合并进 `vrLauncher` 嵌面板 |
| vs shared | 若多端要共用「最近模型元数据」，再进 `src/shared`；二进制资源不进 localStorage |
| 文档 | VR 桌面 roadmap **D1** 由本文件承接细化 |

---

## 6. 性能与验收

### 6.1 预算（初值）

| 档位 | 意图 | 建议 |
|------|------|------|
| 高 | 清晰 | 阴影可开；轻量效果可开 |
| 均衡（默认） | Quest 可玩 | 目标 **≥50 FPS** 立体；1 中等模型 + 动作 |
| 低 | 稳帧 | 无阴影、无额外效果、更低 dpr |

禁止：热路径 React `setState` 刷骨骼；每帧 new 材质/光；未限数量的并行解码。

### 6.2 手测记录表

| 日期 | 设备 | 画质 | 模型规模 | 动作 | 行走 | FPS 观感 | 备注 |
|------|------|------|----------|------|------|----------|------|
|  |  |  |  |  |  |  |  |

### 6.3 风险

| 风险 | 对策 |
|------|------|
| 晕动（平滑行走） | 速度上限；可选瞬移/减少加速；设置项后续 |
| 模型过大 OOM / 掉帧 | 上限 + 低档 + 加载前体积/顶点数提示（能做则做） |
| 角色与房间 PMX 材质需求冲突 | 增加显式资产类型；禁止对所有模型统一强制 DoubleSide |
| Quest attach 阶段画质 API 卡会话 | 默认不应用 framebuffer scale / foveation；仅「实验渲染覆盖」显式开启时应用；无真机回归不得放开默认值 |
| 文件选择在 VR 内难用 | **2D 预选再进 VR** 作主路径 |
| 与 VR 桌面会话冲突 | 入口互斥；文档与 UI 写清 |
| 误把 Studio 后处理拷进 XR | Code review + 本非目标表 |
| 包体 | Showcase Scene lazy；MMD vendor 已分包则保持 |

---

## 7. 近期建议顺序（执行）

> 全项目 VR 人力优先本文件；勿回流做 VR 桌面新 app。

1. **S3 / S4 / M8**：Quest 双眼 HUD 复测与性能矩阵签字（记 §6 表），含物理中档与震动三档手感验收
2. **G1**：音频播放（BGM）— 当前完全缺失，影响核心观看体验
3. **A1**：区分角色与场景资产，解决房间内表面与角色材质策略冲突
4. **A2**：每模型动作配置，完成资产清单闭环；A3 已完成；与 G3（VR 内换动作）可合并设计
5. **G3 / G4**：VR 内换动作 + 恢复加载失败 — 减少"退出重进"摩擦
6. **G5**：表情 / morph 手动控制 — 丰富观看体验
7. **C2**：移动方向；C1 已完成，再依据真机反馈决定 C3 / C4
8. **V4**：只有性能矩阵留有预算时评估 IBL；V1 已完成，bloom 继续延后
9. **G7**：进度条拖拽 — 真机验证拖动和 seek 反馈

**已完成可跳过：** M0–M5、M7、M11、M13、M14、M20–M23、V3，以及模型缩放/旋转/复位、身高补偿、VR 内快速设置、Quest 预设与旧偏好迁移、实验渲染覆盖、物理时间步钳制、物理质量档与诊断、震动三档、A6 环境物件、G2 物理参数持久化（含 hapticLevel）、G6 热路径 GC、G7 进度条拖拽、G8 渲染器 dispose、G10 材质面板、G11 加载进度反馈、G12 材质状态清理、X14 IK 反馈环缓解。G9 不做；X6–X13 未实现。X1 已完成实验实现，但必须通过 Quest 真机碰撞与性能验收后才能视为稳定能力。

---

## 8. 决策记录（摘要）

| 决策 | 选择 |
|------|------|
| 完整 Studio 进 VR？ | **否** |
| 嵌进 VR 桌面面板？ | **否** |
| 渲染 | **WebGL + WebXR only** |
| 物理默认 | **关** |
| 非 MMD 角色（glTF/FBX 等） | **不做**（v0–v1）；只做 glTF/GLB **环境物件**轻量旁路（A6） |
| 控制器物理碰撞 | **实验性**；左右 grip 以 8cm 静态球形刚体进入每个启用物理的模型 Bullet world；tracking 丢失时移出场景 |
| 相机动作 v0 | **不做**（用户行走） |
| 视觉效果 | **后续白名单**，非 Studio 全栈 |
| 导入主路径 | **2D 预选 → VR**；XR 内导入为辅 |
| Quest framebuffer scale / foveation | 默认不应用；仅「实验渲染覆盖」显式开启后应用；稳定性优先 |
| PMX 角色与场景 | 下一阶段显式分类，不再依赖材质启发式判断 |
| 近期 VR 优化是否回流 Studio | **否**（除概念性共享）：光照预设联动、阴影档位化均依赖 VR 舞台/会话语义；「暂停跳过骨骼求值」守卫已在 VR 启用（修复版：加载完成回调重置求值时间戳，避免静态模型永不求值），仅作为 Studio demand-render 的经验参照（见 mmd-studio.md 缺陷 #10） |

---

## 8.5 踩坑记录（供后续参考）

> 2026-07-31 开发过程中遇到的非显而易见的问题与解决方案。

### 1. `setRuntimeRef` 在 `useMemo` 中调用导致黑屏

**现象**：进入 VR 后一片黑，无法恢复。

**根因**：`setRuntimeRef()`（zustand `set`）在 `useMemo` 回调内调用——即在 React 渲染阶段触发 store 状态更新。React 不允许在渲染过程中调用 `setState`，导致渲染被中断/丢弃，R3F 的 Canvas 初始化失败。

**修复**：将 `setRuntimeRef` 调用从 `useMemo` 移到独立的 `useEffect`，在 commit 阶段执行。

### 2. `requestAnimationFrame` 和 `setTimeout` 在 WebXR 沉浸模式下不可靠

**现象**：加载模型时卡在"加载中"/Quest VR 加载动画无法完成。

**根因**：`requestAnimationFrame` 在 WebXR 沉浸模式下被 XR session 的 RAF 取代，浏览器 RAF 不触发。`setTimeout(0)` 也被浏览器延迟执行（优先 XR 渲染循环），`await` 迟迟不 resolve → 加载流程挂起。

**修复**：回退为原始同步加载流程，不在加载循环中使用任何 yield。加载进度反馈（G11）标记为已回退。

### 3. 加载循环中 `syncModelList()` 触发 React 状态更新导致黑屏

**现象**：显示模型的瞬间黑屏。

**根因**：`syncModelList()` → `setModels()` 在加载循环中间触发 React 状态更新，组件重渲染干扰 R3F 的 WebGL 帧循环。

**修复**：移除加载循环中间的 `syncModelList()` / `syncObjects()` 调用，只在全部加载完成后统一同步一次。

### 4. `MaterialPanel` 无条件挂载导致黑屏

**现象**：进入 VR 后一片黑。

**根因**：`MaterialPanel` 即使 `modelId` 为 null 也存在于渲染树中。其 `useEffect(() => { setView("list"); ... }, [modelId])` 在初始 mount 时触发 3 个 `setState`，在 R3F 初始化阶段产生额外渲染周期，干扰 WebGL 上下文初始化。

**修复**：`MaterialPanel` 改为条件挂载——只有 `materialPanelModelId != null` 时才渲染组件。关闭时完全卸载。

### 5. 物理参数 `solverIterations` 过低导致衣物抖动

**现象**：开启物理后部分模型衣物持续抖动。

**根因**：`PHYSICS_QUALITY_OPTIONS` 中 `solverIterations` 设为 6/10/16，远低于官方默认值 20。Bullet 的 Sequential Impulse 约束求解器迭代不足时，MMD 铰链约束链无法收敛。

**修复**：对齐官方默认值——low: 15, medium: 20, high: 20。

### 6. 无动作时 IK + Bullet 形成反馈环导致抖动（X14）

**现象**：无动作时开启物理，衣物/裙摆持续抖动不止。

**根因**：官方 viewer 无动作时传 `ik: false`（`hasCurrentMotion()` 为 false），我们一直传 `ik: true`。IK solver 在 rest pose 上产生微修正 → Bullet 读取修正后的骨骼 → 输出物理修正 → 应用到所有骨骼 → 下一帧 IK 读取 Bullet 修改的骨骼 → 振荡。有 body 动画时动画每帧覆写骨骼，打断反馈环。

**修复**：`ik: entry.bodyAnimation != null`。残余抖动可能来自 Bullet 自身约束求解残余。

### 7. 控制器碰撞开启时物理冻结导致 C=3 卡死

**现象**：物理开启 + 控制器碰撞开启时，手柄碰到模型后物理卡住，C=3，球变绿，需重置物理才恢复。

**根因**：5 秒 settle 上限冻结 `physicsOnlyTimeRef` → `deltaSeconds=0` → Bullet 不步进。控制器碰撞球虽每帧更新位置（静态刚体 teleport），但 Bullet 无法检测/解决穿透——接触卡在 3 条，刚体被穿透锁死。

**修复**：当 `physicsControllerCollisions` 开启时不冻结时间线，让 Bullet 能正常解决控制器穿透。5 秒冻结仅在碰撞关闭时生效。

---

## 8.6 结构审查与拆分计划

当前目录按展示器、R3F 组件、MMD runtime、资产、session、时钟和 haptics 分层，整体结构足够支撑继续开发，暂不需要大规模重构。

**已知维护风险**：`src/mmdVrShowcase/components/MmdVrHud.tsx` 已约 1500 行，同时包含通用 HUD 控件、主控制条、模型/物件面板、材质面板、物理设置和 FPS 显示。下一次修改 HUD 时优先拆分为通用控件、模型/物件面板、材质面板、物理设置面板和控制条组装层。

**后续拆分候选**：`src/mmdVrShowcase/components/MmdVrStage.tsx` 已约 900 行，同时负责 runtime 生命周期、资源加载、store 同步、灯光、时间轴、物理和 haptics。暂不直接拆分，避免破坏 R3F hooks、runtime ref 和 store 之间的生命周期关系；下次修改加载或物理逻辑时，再按 loader、sync、physics 边界逐步抽取。

**暂不拆分**：`mmdVrStore.ts`、`mmdRuntime.ts` 和 `MmdVrPlayerRig.tsx` 当前职责仍可理解。store/runtime 的拆分需要先明确跨状态和内部 entry 依赖，不按行数机械拆分。

**建议顺序**：先拆 HUD 的 `MaterialPanel` 与 `PhysicsSettingsPanel`，再拆模型/物件面板，最后评估 Stage 的 loader/sync/physics 抽取。

---

## 9. 参考

- [mmd-studio.md](./mmd-studio.md) — Studio 能力与 runtime 约定  
- [vr-desktop-roadmap.md](./vr-desktop-roadmap.md) — WebXR 进入/性能/非目标；**D1**  
- [Immersive Web](https://immersiveweb.dev/)  
- [three.js WebXR](https://threejs.org/docs/#manual/en/introduction/How-to-create-VR-content)  
- [@react-three/xr](https://docs.pmnd.rs/xr)  
- [R3F pitfalls](https://docs.pmnd.rs/react-three-fiber/advanced/pitfalls)  
