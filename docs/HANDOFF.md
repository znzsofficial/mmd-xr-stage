# 会话交接 — 2026-11-17

## 首先读这里

用户刚要求“更新和整理文档，包括交接文档，压缩会话后继续”。当前是在**视觉更新收尾途中暂停**，不是新的 GUI 方案征询，也不是已完成发布。

- 工作目录：`E:\WebProjects\mmd-xr-stage`
- 当前分支：`design/vr-porcelain-controls`
- 分支 HEAD / master / origin/master：`3ba4ded`
- 当前浅瓷 GUI、产品/设计文档和本交接均为**未提交工作区改动**，不要 reset/clean、切回 master 或覆盖。
- 线上仍为 `3ba4ded`：<https://mmd-xr-stage.pages.dev>，上一部署 <https://c1e7dba1.mmd-xr-stage.pages.dev>。
- **待发布浅瓷 GUI。** 恢复会话后已对最终进度条修复完成 TypeScript、171 项测试和生产构建；dist 已对应最终源码。

## 用户已确认的方向

- 头显 **Quest 3S**；菜单主要用手柄，手追只用来体验物理。
- **观看为主，偶尔调整**。用户明确不满意旧 GUI 的配色、设计和风格，上一轮功能分页不能代表视觉获认可。
- 已在可视化选择页选定 **浅瓷与墨蓝**（不是深色海盐方案，也不是平面青色方案）。无需再问同一方向。
- 只改 VR HUD：冷白底、墨色文字、克制蓝色选中态、去厚描边和数值卡片外框。准备页、舞台灯光和模型材质保持独立。
- 不反复输出 Impeccable 配置提醒，不为设计任务顺带修 hook/doctor 配置。
- 倾向将同轮改动整合为一个有意义的提交；强推需单独授权，不能沿用过去一次强推许可。
- 合并后及时部署（用户既有偏好为半小时内）；测试/构建尽量在合并前完成。

## 已发布的近期基线

| 提交 | 内容 | 验证 |
|---|---|---|
| `7f0b505` | loader 0.8.6、Three r187、R3F 9.8.2、XR 6.6.32、依赖刷新与补丁迁移 | 143 测试；WASM/WebGL smoke |
| `3f8e02e` | 物理缓冲复用、刚体元数据缓存、辅助碰撞体/隐藏模型触觉误报修复、材质同步减分配 | 150 测试；真实 Bullet direct/copied 240 步轨迹差 0 |
| `42a70b5` | XR generation 状态机、首 XRFrame 才 active、取消/超时、R3F renderer 所有权；StrictMode runtimeRef 修复 | 163 测试；IWER 首次模型加载和重入 |
| `3ba4ded` | Node 26 基线、jsdom 31、GUI 四分类与召回、静态物件裁剪、CPU/renderer 诊断 | 169 测试；裁剪合成场景 draw calls 300→1 |

Node 当前实际版本 **26.12.1**；`.node-version` 同值，engines `>=26.12.1 <27`；pnpm **11.20.0**。`@types/node` 26.6.6、jsdom 31.0.1。不要跟 npm `node latest` 的 27 alpha。

Loader clone `E:\WebProjects\three-mmd-loader` 已同步 upstream/fork main 至 `9c47b94` / v0.8.6，mmd-anim v0.5.4 子模块 `f4f68d7`。该 clone 只用 npm；贡献分支本轮未 rebase/强推。

## 当前未提交实现

### 代码

- `src/mmdVrShowcase/hudAppearance.ts`：独立、固定的 HUD palette，button/tab/quiet 纹理绘制与禁用/危险状态。
- `src/mmdVrShowcase/hudAppearance.test.ts`：普通、次要、选中、危险、禁用文本的颜色对比度 ≥4.5:1，及稳定 token 验证。
- `src/mmdVrShowcase/components/MmdVrHud.tsx`：仅 HUD 改用新 palette（目前以 `useVrHudTheme as useMmdVrTheme` 本地 alias 接入）；冷白实体面板、细分隔、无厚按钮边框、tab 下划线、无边框数值标签、细滑块/小滑钮、观看条背景；修复拖动柄 renderOrder 与模型材质按钮垂直间距。
- 最后一处 review 修复：时间文本原来叠在进度轨道上，现移到纹理 `y=24`，轨道在 `y=56..62`，进度 plane 高度 `0.13`。初始和动态绘制两处都已更新。
- 会话、渲染后端、物理、场景颜色没有在这轮改动。不要把 UI 更新说成 WebGPU 迁移。

### 文档

- `PRODUCT.md`：用户确认的 Quest 3S / 观看 / 手柄场景和产品约束。
- `DESIGN.md`：实际 HUD token、Canvas 像素与世界单位、控件状态及边界。
- `.impeccable/design.json`：设计工具侧车，含预览 metadata；合成色阶和 HTML 示例**不是生产 token 或 XR 实测**。
- `.impeccable/surfaces/vr-hud.md`：本轮方向契约与用户选择。
- `docs/webgpu-xr-status.md`：当前支持调查与来源；见下节。
- `docs/vr-controls.md`、索引、README、部署说明、诊断说明和旧路线图均做了状态校正。

## 验证状态（不要扩大结论）

- **最终源码 171 项 / 42 文件通过**；恢复会话后重新完成 tsc 与生产构建，包含进度条文字分离修复。此前 detector `[]` 通过。
- 最终修复后已在 IWER 模拟页截图确认时间与轨道分离；当前 dist 已重建。测试中的 Three CJS/localStorage 提示及构建的 loader Node 模块外置、大 chunk 提示未导致检查失败。
- 普通/选中/危险/禁用颜色对比测试已过；这不等于 Quest 3S 的镜片、亮度或文字角尺寸验收。
- 独立审查初次 verdict `fix`：唯一阻塞为进度时间对比度。修复后 scoped verdict `ship` / resolved，文本在瓷色底上对比度 **5.47:1**。仅审阅源码与模拟截图，没有全场景/头显/seek 手感批准。
- 模拟界面验证了模型/画面/观看模式；已有自动测试覆盖分页、材质访问、慢扳机释放/取消/防重复触发等。全部功能不能只凭截图宣称真机通过。
- 此轮未添加 UI 图片资产，所有显示图形来自 Canvas/Three 绘制。截图是开发证据，不随产品打包。

## 下一步：先完成这轮收尾

1. 先 `git status`，确认仍在本分支且工作区完整；读本交接、PRODUCT、DESIGN。
2. 对最终进度条修复跑 tsc、必要测试、build、diff-check；上次全量 171 项已过，不要无理由重复多轮。
3. 如需继续看效果，复用下方本地模拟页；不要再设计一遍、不额外换主题。
4. 只暂存实际代码/文档/设计契约。**不要 `git add .`**，`.openchamber/` 截图、`.impeccable/questions/` 运行产物、`sample/` 不应提交。
5. 整合为一个提交，fast-forward 合并到 master，代理推送，再使用固定 wrangler 部署；核对线上入口和制品内容哈希。
6. 更新交接中的发布状态，通知用户可在 Quest 3S 查看。不要宣称 WebGPU 已启用。

```bash
pnpm exec tsc -b --pretty false
pnpm test
pnpm build
git diff --check
```

PowerShell 中分步检查 `$LASTEXITCODE`；不要把 test/build 输出过滤后将过滤命令的成功当作验证成功。

## 本地运行/证据

- 开发服务器原 PID `78944` / 端口 `4186` **已停止**，本会话创建的浏览器标签已关闭。
- `sample/porcelain-smoke.html` 和 `sample/maintenance-minimal.pmx` 保留在已忽略目录，以便复验。前者使用现有传递依赖 **IWER 2.4.0**，安装模拟 Quest runtime，加载完整应用；顶部是测试驱动按钮，不是产品 UI。
- 启动 `pnpm dev --host 127.0.0.1 --port 4186 --strictPort`，打开 `http://127.0.0.1:4186/sample/porcelain-smoke.html`。Enter → Menu/Visuals/Watch；Synthetic progress 只提供模拟 duration，实际 runtime 仍会将静态模型时钟写回 0，因此截图为 `0:00 / 2:00`，不是动作播放证明。
- 截图（保留为未跟踪本地证据）：
  - `.openchamber/screenshots/porcelain-model-2026-11-17T13-59-39-955.jpg`：较早版本，不能用于断言最终拖动柄/材质按钮位置。
  - `.openchamber/screenshots/porcelain-visual-final-2026-11-17T14-03-46-087.jpg`
  - `.openchamber/screenshots/porcelain-watch-final-2026-11-17T14-05-25-104.jpg`
  - `.openchamber/screenshots/porcelain-progress-fixed-2026-11-17T14-14-09-711.jpg`：最终进度对比修复。
- 外部临时目录 `C:\Users\NekoLaska\AppData\Local\Temp\opencode` 保存生成 PMX、性能前后 JSON、旧轮截图和 `verify-mmd-maintenance.mjs`。该验证脚本比较生产 HTML 资源引用及 dist JS/CSS/Bullet/动画 WASM SHA-256，使用动态 cache-buster；运行前读脚本确认路径。
- Review agent `ses_e162b5dd5ffec3Beo03segGMe0` 已完成；documenter `ses_e1629d3cfffe5WK4sjJPRk2Hoy` 已完成。无需轮询。

## 发布规则

- Git 是 `master`，Pages 生产参数是 `--branch=main`；不要混淆。
- 推送代理：`http://127.0.0.1:7897`。
- 使用已验证版本，不临时升级部署工具：

```bash
git -c http.proxy=http://127.0.0.1:7897 -c https.proxy=http://127.0.0.1:7897 push origin master
npx -y wrangler@4.128.0 pages deploy ./dist --project-name=mmd-xr-stage --branch=main
```

- 先完成验证和构建，再合并发布；不拿 deploy 代替测试。HTTP 200 可能是 SPA 回退，必须检查内容/哈希。

## 待办（本轮不继续扩改）

1. **Quest 3S 真机**：冷缓存首次进入、退出重入、菜单光学可读性、B 键召回、手柄慢按/松开、手追、左右眼裁剪、衣物缩放/碰撞/震动。模拟器成功不替代这一项。
2. **贴图异步竞争**：`mmdRuntimeMaterials.ts` 从已提交 prev.requestId 递增，并发未完成请求可能共用 ID；旧结果覆盖新选择，部分贴图加载失败清理不足，外层吞异常。应独立单调代次、File 身份及 finally/失败清理，先补乱序和卸载测试。
3. **动画/物理时钟**：有动作但暂停时 evaluationTime 不推进；需复现 Bullet delta=0 时手柄无法推动衣物，再设计独立物理时间，不能随意改 seek/reseed。
4. **性能与大场景**：当前有模型 CPU cost、draw calls、三角形、资源数量；尚无 GPU timer query。需真实资产、Quest 数据后评估 LOD、材质合批、贴图预算；300→1 是视野外网格合成测试，不是整机 FPS 提升。
5. **WebGPU XR 可选实验**：已有浏览器/Three 支持，但用户本轮只是询问，未授权迁移；保留 WebGL 默认。MMD shader、R3F/XR、会话 webgpu feature、GPUAdapter xrCompatible、双眼与材质一致性、回退均需验证。

## WebGPU 结论与来源限制

Meta 146.0 已公布实验支持，150.1 foveation、152.1 composition layers 的说明仍为实验。156.0 发布索引（11 月 13 日）提及 WebGPU in WebXR，但完整页获取失败，**不能断言全部设备默认开启或已完全稳定**。Three r187 源码有 XRGPUBinding 路径且明确尚无 WebGPU XR multiview。详见 `docs/webgpu-xr-status.md`。

## 必须保留的约束

- loader 0.8.6 的 contact-range 与 TSL self-shadow 降级 patch；XR 6.6.32 输入源清理 patch。
- Bullet `public/mmd/0.8.6/` JS/WASM 与代码路径一致。
- `[model, 2 controllers, 12 hand slots]` 顺序；PMX 物理世界单位尺度、碰撞矩阵 rigid 化和半径/模型尺度独立换算。
- XR Session generation、首 XRFrame 状态、取消/卸载隔离、R3F 自有 renderer 不重复 dispose。
- `runtimeRef` 只在 commit/layout effect 同步，不能写在 useMemo 中（已复现 StrictMode 模型被误删）。
- `sample/` 资产不得提交；LF 文本；无需求不要引入新的 JSX 注释或 UI 框架。
