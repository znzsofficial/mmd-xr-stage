# three-mmd-loader 近期维护记录

最后更新：2026-08-18

文档索引：[docs/README.md](./README.md)

## 用途

本文记录 NekoVirtOS 对 `@yohawing/three-mmd-loader` 的近期排查、本地补丁、上游提交和后续维护步骤。更新依赖、处理上游 review 或移除 pnpm patch 前，应先查阅本文。

## 仓库与依赖

| 项目 | 位置 / 地址 | 包管理器 | 说明 |
|------|-------------|----------|------|
| NekoVirtOS | `E:\WebProjects\neko-virt-os` | pnpm | 使用 loader、保存临时正式补丁和项目集成代码 |
| loader 本地 clone | `E:\WebProjects\three-mmd-loader` | npm | 上游贡献、测试和 review 修改 |
| upstream | <https://github.com/yohawing/three-mmd-loader> | npm | 默认分支 `main` |
| fork | <https://github.com/znzsofficial/three-mmd-loader> | npm | remote 名为 `fork` |

当前 NekoVirtOS 依赖：

- `@yohawing/three-mmd-loader@0.8.3`
- `mmd-anim WASM 0.5.1`
- Bullet 运行资产：`public/mmd/0.8.3/mmd_bullet.js`、`public/mmd/0.8.3/mmd_bullet.wasm`；版本化目录保证 ABI 配套的 JS/WASM 同步更新
- pnpm patch：`patches/@yohawing__three-mmd-loader@0.8.3.patch`（rigid-body range contact 查询 + three r186 TSL self-shadow 兼容降级，见下文）
- `pnpm-workspace.yaml` 中的 `patchedDependencies` 负责应用补丁
- 当前 lockfile patch hash：`a5b0eff3a72c54ca4776e77506eacd9496b41f2167766998a467465e1d6c8f95`

上游仓库提交了 `package-lock.json`，其开发文档和 CI 均使用 npm。不要在 `E:\WebProjects\three-mmd-loader` 中使用 pnpm 更新依赖或 lockfile。NekoVirtOS 仍使用 pnpm。

## 已解决问题

### 1. dynamicWithBone 缩放漂移

#### 表现

- 开启物理后缩小模型，衣服等物理骨骼向模型原始高度漂移。
- 本地测试模型为 `sample/默认/诺诺.pmx`，此前多个模型均可复现。`sample/` 已被 Git 忽略，模型许可禁止二次分发，不得提交到仓库。

#### 根因

`MmdAnimBulletPhysicsBackend` 将所有非静态刚体的 Bullet 平移和旋转统一写回骨骼。MMD 的 `dynamicWithBone`（physics-with-bone）语义应保留动画骨骼的局部平移，只反馈物理旋转。

旧 Ammo backend 已遵循该语义；新的 mmd-anim backend 对 `dynamic` 和 `dynamicWithBone` 未作区分。模型缩放后，错误的世界平移反馈尤其明显。

#### 修复语义

| 刚体模式 | 平移来源 | 旋转来源 | `updatedBoneIndices` |
|----------|----------|----------|----------------------|
| `dynamic` | Bullet | Bullet | 写入 |
| `dynamicWithBone` | 动画输入 | Bullet | 写入 |

保留了 0.8.1 的 solver ownership 和前向步进逻辑。没有在 physics step 中整体缩放刚体 world，也没有取消现有 root unit-scale 处理。

#### 上游记录

- Issue [#37](https://github.com/yohawing/three-mmd-loader/issues/37)
- PR [#38](https://github.com/yohawing/three-mmd-loader/pull/38)
- 分支：`fix/dynamic-with-bone-translation`
- Commit：`20e16942c6e5301599500183cc5a967cbbd3b5e3`
- Commit 标题：`fix(physics): preserve dynamic-with-bone translation`

2026-08-17：已合入 `main`，并随 `@yohawing/three-mmd-loader@0.8.2` 发布。

### 2. Bullet contact 查询未接通

#### 表现

- 原生 Bullet 已提供 contact 数据，但 TypeScript backend 没有暴露查询方法。
- viewer 已尝试调用 `debugContactCount()` / `debugPhysicsContacts()`，compatibility backend 未实现转发，因此运行时始终无法取得接触。
- NekoVirtOS 控制器 collider 可以参与物理，但无法据此触发触觉反馈。

#### 根因

原生导出 `_mmd_anim_bullet_world_collect_contacts` 已存在，缺失的是 TypeScript mmd-anim backend 的 ABI 解码和 `CustomBulletMmdCompatibilityBackend` 的方法转发。

原生 `mmd_anim_bullet_contact_point` 每条为 48 bytes：

| 偏移内容 | 类型 |
|----------|------|
| `rigidbody_index_a` | `int32` |
| `rigidbody_index_b` | `int32` |
| `distance` | `float` |
| `position_world_on_a[3]` | `float[3]` |
| `position_world_on_b[3]` | `float[3]` |
| `normal_world_on_b[3]` | `float[3]` |

#### 修复语义

- `debugContactCount()` 使用 count-only native query，不创建 contact 列表。
- `debugPhysicsContacts()` 解码完整 48-byte ABI。
- contact buffer 仅在详细查询时延迟分配，后续查询复用，backend dispose 时释放。
- native module 缺少可选导出或 backend 已 dispose 时，安全返回 `0` / `[]`。
- stable Custom Bullet compatibility backend 转发两个方法。
- 不需要修改或重建原生 WASM。

#### 上游记录

- Issue [#39](https://github.com/yohawing/three-mmd-loader/issues/39)
- PR [#40](https://github.com/yohawing/three-mmd-loader/pull/40)
- 分支：`fix/bullet-contact-debug-api`
- Commit：`60e99d72e46c08004dc98acac8648a48f3ee4442`
- Commit 标题：`feat(physics): expose Bullet contact queries`

2026-08-17：已合入 `main`，并随 `@yohawing/three-mmd-loader@0.8.2` 发布。

## NekoVirtOS 集成修改

以下改动服务于本项目，不应混入上述 loader PR：

| 修改 | 位置 | 说明 |
|------|------|------|
| Controller collider wrapper | `src/mmdVrShowcase/mmdRuntime/mmdPhysics.ts` | 向物理 context 追加控制器刚体，读取 contact 并区分左右控制器 |
| Contact / backend 回归测试 | 主仓 `E:\WebProjects\neko-virt-os`（`src/appModules/mmdStudio/mmdPhysics.test.ts`） | 覆盖 direct buffers、contact forwarding、contact 上限和 patched backend 行为；本仓未拷贝该测试 |
| VR 触觉状态 | `src/mmdVrShowcase/mmdVrHaptics.ts` | 管理左右手接触、震动强度和 gate |
| 触觉执行 | `src/mmdVrShowcase/components/MmdVrControllerColliders.tsx` | 驱动 WebXR haptic actuator |
| VR contact 采样 | `src/mmdVrShowcase/components/MmdVrStage.tsx` | 从物理 backend 采样 controller contact |
| Unit-scale physics step | `src/mmdVrShowcase/mmdRuntime/mmdRuntime.ts`、`mmdRuntimeEntry.ts` | 模型显示缩放与 PMX 原尺寸物理 world 的集成处理 |

### 受控的物理重建

模型 transform 后调用 `rebuildPhysics()` 会销毁全部模型并异步重载，期间模型和面板消失，因此 transform 路径不再重建，而是对位置、旋转和复位执行非破坏性 `resetPhysics()` reseed。

`MmdRuntimeHandle.rebuildPhysics()` 仅用于切换“衣物互撞”这类刚体创建时配置。重建期间 UI 保持 busy，并保存模型变换、动作、morph 权重与收藏、材质可见性和材质覆盖；失败时尝试按旧配置恢复。

该问题属于 NekoVirtOS runtime 生命周期，不是 loader 上游问题。

### 已撤回的方案

曾考虑在 physics step 时取消 root scale 强制为 `1`，但刚体形状和关节仍是 PMX 原尺寸，整体传入缩放会产生新的尺寸不一致。该方案未经验证且已撤回，当前不缩放整个 physics context。

## 真机确认

用户已在设备上确认：

- 控制器碰撞后有震动。
- 开启物理后可以调整模型大小，模型和面板不会消失。
- `dynamicWithBone` 平移反馈修复改善了使用该模式的衣物缩放漂移。
- controller matrix rigid 化后，多个复杂纯动态裙子模型在缩放和启用控制器碰撞时均正常下落。
- 主动控制器碰撞、contact 计数和震动正常。

## 已解决：缩小模型后的纯动态裙子上漂

### 稳定复现条件

- 模型显示缩放小于 `1`。
- 开启控制器碰撞。
- 多个模型均可复现，不是 `sample/珠霜舒芙蕾` 的特例。
- 主要影响裙子；身体、头发和其他可碰撞部位通常表现正常。
- 控制器不接触裙子、远离裙子或移动到其他位置时，裙子表现基本不变。
- 缩放停止后裙子立即稳定，不会继续堆高；关闭控制器碰撞后会恢复正常。
- 将控制器碰撞半径调到最小没有消除问题。
- 关闭控制器碰撞后不出现同样的上漂。
- 默认测试模型仍可能表现正常，因此不能用单个正常模型否定问题。

### 与 loader 版本的关系

- `0.8.0 -> 0.8.1` 没有物理 backend、runtime 物理流程或 Bullet WASM 改动。
- `0.8.1` 仅包含 TSL Viewer、self-shadow shader 预编译和 release CI 修复，因此不是该问题的直接版本分界。
- 需要关注的是 `0.7.0 -> 0.8.0`：loader 删除旧 `AmmoMmdPhysicsBackend`，改用 mmd-anim v0.3.3 Bullet backend，并替换 Bullet JS/WASM。
- NekoVirtOS 在提交 `7dd6962` 中从 `^0.7.0` 直接升级到固定的 `0.8.1`，因此没有在项目内单独验证 `0.8.0`。
- 最终根因位于 NekoVirtOS controller world-to-model 映射产生的非刚体矩阵，不是 loader 版本变化本身。

### 已排除或证据不足的方向

| 方向 | 结论 |
|------|------|
| 控制器实际碰到裙子 | 排除；控制器远离且没有接触时仍复现 |
| 控制器球半径过大 | 排除；最小半径及修改模型空间半径换算均未改善 |
| 单个 PMX 模型异常 | 排除；多个模型的裙子均可复现 |
| `dynamicWithBone` 平移覆盖 | 不能解释当前问题；问题裙子主体可由纯 `dynamic` 刚体组成 |
| 弹簧关节参数 | 珠霜 A/B 关闭弹簧后行为几乎不变 |
| contact 查询和触觉采样 | 排除；这些路径只读取 Bullet contact，不参与求解 |
| 瞬时控制器接触漏采样 | 排除；逐帧峰值锁存测试中 `C` 始终为 `0`，只有主动接触才变化 |
| 控制器 proximity / 按需唤醒 | 未改善，已撤回 |
| 开启碰撞后持续推进无动作物理 | 单独限制推进没有改善，不能作为根因 |
| 动态衣物自碰撞 | 默认关闭；没有证据表明它是当前根因 |

### 离线诊断结果

- 珠霜裙子主要由第 6 组的 `288` 个纯动态刚体组成，PMX mask 原本禁止同组互撞。
- 珠霜有 `78` 个弹簧关节；默认模型没有弹簧关节，但关闭弹簧未消除差异。
- Bullet 仿真 3 秒后，珠霜 `288` 个裙子刚体中约 `238` 个向下、`28` 个小幅向上，离线环境没有复现真机中的整体上漂。
- 首帧 seed 姿态与 PMX 原始姿态一致。
- Bullet world 变换、局部骨骼回写和 Three.js world 变换闭环误差接近零。
- 重力方向、关节索引、PMX 欧拉转换和坐标轴翻转未发现明确错误。

### 排查中踩过的坑

1. 不要因为现象只在开启控制器碰撞时出现，就直接断定控制器球正在碰裙子。开关还可能改变刚体数组、collision mask、静态刚体更新和物理时间策略。
2. 不要用控制器中心位置代替球体边界判断接触，但也不要在没有 contact 证据时持续调整半径。
3. PMX `localTranslation` 是相对骨骼的局部偏移，不能直接用于控制器到刚体的模型空间 proximity 判断。需要使用 Bullet 当前刚体 world transform。
4. 冻结显示时间不一定等于完全绕过 runtime；应确认传入 backend 的 `deltaSeconds`。当前 loader 在时间不变时传入 `0`，但仍会执行 backend step 和输出读取。
5. 不要用控制器从隐藏位置 `Y=-1000` 到手部的跳变去 reset 整个 backend。`backend.reset()` 会重置全部模型刚体，而不是只重置控制器。
6. 控制器碰撞组必须优先使用模型未占用的 group。若 16 组全部占用，不能回退到已有组并将该组 bit OR 到所有模型 mask，否则可能意外开启模型内部碰撞。
7. contact 总数超过 HUD 上限时不能直接返回零。密集裙子会产生数百个 world contact，从而让真实控制器 contact 被误报为 `C=0`。
8. `debugPhysicsContactsForRigidBodyRange()` 当前仍让 native 写入完整 contact buffer，只减少 JS contact 对象物化；它不是真正的 native filtered query。
9. 本机没有 Emscripten，`npm run build:bullet:mmd` 会因 `spawn em++ ENOENT` 失败。没有工具链时不要设计必须修改 Bullet ABI 才能验证的方案。
10. 单个默认模型正常不代表实现正确。问题与裙子刚体模式、数量、层级和约束拓扑有关，必须至少使用一个纯动态密集裙子模型做回归。
11. mmd-anim backend 的 `copyDynamicOutputs()` 已分两阶段读取所有 Bullet world pose，再使用同帧 physics parent world 转换子骨骼 local pose；现有父子纯动态链测试也覆盖该行为。没有反例前不要改写该层级转换。
12. 默认模型主要使用 `dynamicWithBone`，复杂问题模型主要使用深层纯 `dynamic` 链；默认模型正常不能排除 synthetic controller bone 中非单位 scale 对纯动态链的影响。

### 已撤回的实验性改动

- 缩小模型时禁止控制器模型空间半径按 `1 / scale` 增大：真机无改善，已撤回。
- 根据控制器移动版本和刚体 proximity 按需唤醒无动作物理：真机无改善，已撤回。
- 控制器 tracking 大位移时调用整个 Bullet backend reset：会影响全部裙子刚体，已撤回。
- proximity 直接读取 PMX `localTranslation`：坐标空间错误，已撤回。
- 调试 HUD 的逐帧 contact 峰值锁存：确认无瞬时接触后已撤回，避免保留临时代码。

### 根因定位 A/B 记录

- scale-only transform 恢复非破坏性 `resetPhysics()` 无改善。
- 完全跳过 controller wrapper 时复杂裙子正常，且物理时钟仍持续推进，将范围限定到 controller wrapper。
- 保留 synthetic controller 骨骼和刚体但禁用 collision mask 时仍异常，排除了 contact、collision filter 和 broadphase pair。
- 只扩展 synthetic skeleton/direct buffers、不追加 controller 刚体时仍异常，排除了额外 Bullet body。
- extra world-matrix slots 固定为单位矩阵时正常，确认扩展 buffer 布局本身无问题。
- 保留真实平移和旋转方向、仅归一化矩阵前三列时正常，最终确认触发条件是 controller matrix 中的 `1 / modelScale` 线性缩放。
- 临时 A/B 查询模式和 HUD 标签在结论确认后已删除。
- 初版 A/B 的 `R/D/S` 全为 `0` 是诊断 wrapper 耦合造成的假象；统计现已移到实际 Bullet context 前，能独立显示真实 `R/D/S`。

### 已确认根因与生产修复

- controller world matrix 通过 `unitRoot * inverseVisualRoot * worldMatrix` 映射到模型单位物理空间。该乘积会正确缩放平移，但也会把 `1 / modelScale` 写入矩阵的三个旋转基向量，使其成为非刚体变换。
- mmd-anim external physics 接口的 bone world matrices 预期是平移加旋转的刚体矩阵。复杂纯 `dynamic` 父子链对 synthetic bone slot 中的非单位 scale 敏感，表现为缩小时裙子向骨盆后上方堆积；以 `dynamicWithBone` 为主的默认模型可能不受影响。
- 生产 controller wrapper 现在写入矩阵前归一化前三列，保留模型空间平移和旋转方向，只移除 scale。controller sphere 半径仍独立通过 `/ modelScale` 换算，因此碰撞体大小和位置语义不变。
- 最终真机确认：正常生产模式下复杂模型缩放、裙子下落、主动控制器碰撞、contact 计数和震动均正常。
- 该问题属于 NekoVirtOS controller integration，不应混入 loader PR #38 或 PR #40。

## 已解决：three r186 与 loader WebGPU self-shadow 的 TSL 兼容

### 背景

- NekoVirtOS 于 2026-09-14 将 three 从 0.185.1 升级到 0.186.0，以获得 WebXR MSAA（`WebGLRenderer` 以 `antialias: true` 创建时，r186 会在 WebGL2 的 `XRProjectionLayer` 上自动设置 MSAA samples，与既有 `antialiasPref` 偏好轴直接配合）。
- r186 将 `getShadowMaterial()` / `getShadowRenderObjectFunction()` 从 `three/tsl` 公共导出中移除并私有化（`_getShadowMaterial` 等，无公开替代）。
- loader 0.8.3 的 `dist/webgpu/self-shadow-pass.js`（实验性 TSL self-shadow，NekoVirtOS 策略强制关闭）静态导入这两个符号，导致 rolldown 构建报 `MISSING_EXPORT`。

### 补丁语义

- patch 追加 `self-shadow-pass.js` 修改：移除两个失效导入，`shadowMaterial` / `shadowRenderObjectFunction` 置 `null`，并在 `prepareShadowRender()` 的早退守卫中加入非空检查。
- 降级行为：pass 的 `render()` / `compileAsync()` 返回 `false`，`setMode` / `visibilityNode` / `dispose` 仍可用；`pipeline.js` 对 pass 的全部调用点本就接受 `false` / optional chaining，且仅当 `needsSelfShadowVisibility` 为真时才创建 pass。
- NekoVirtOS 的 Studio 策略是 TSL self-shadow 恒为关（`mmdRuntime.ts` / `mmdTslPipeline.ts`），因此该降级对当前产品面无行为差异；仅当上游跟进 r186 后才恢复完整 self-shadow 能力。

### 后续

- 上游发布适配 three r186 的版本（或恢复 TSL shadow 公共导出）后，移除补丁中的 self-shadow 段落并重跑本文验证命令。

## 已执行验证

### NekoVirtOS

```bash
pnpm install --frozen-lockfile
pnpm exec tsc -b --pretty false
pnpm test -- src/mmdVrShowcase/mmdVrHaptics.test.ts src/mmdVrShowcase/mmdVrStore.test.ts
pnpm test
pnpm build
git diff --check
```

验证结果：完整测试共 `19` 个文件、`78` 项通过；TypeScript 和生产构建通过。物理 backend 的 direct buffers / contact forwarding 回归测试留在主仓（`src/appModules/mmdStudio/mmdPhysics.test.ts`、`mmdRuntime.test.ts`），升级 loader 时需在主仓补跑。

### loader PR #38

```bash
npm ci
npm run lint
npm run build
npm test
npm run check:fixtures
npm run smoke:dist
```

结果：82 个测试文件，761 项通过，5 项跳过；5 个 fixture 通过。

### loader PR #40

```bash
npm run lint
npm run build
npm test
npm run check:fixtures
npm run smoke:dist
```

结果：82 个测试文件，762 项通过，5 项跳过；5 个 fixture 通过。

`npm run smoke:types` 在本机 Windows + Node.js 26.5.0 下会因上游脚本使用 `spawnSync("npm")` 而找不到 `npm.cmd`。这是脚本的 Windows 调用限制；TypeScript build 和 declarations 已通过，上游 Linux Node.js 22/24 CI 应执行该 smoke test。

## 后续操作

### 查询 PR 状态

在 `E:\WebProjects\three-mmd-loader` 中运行：

```bash
gh pr view 38 --repo yohawing/three-mmd-loader
gh pr view 40 --repo yohawing/three-mmd-loader
gh pr checks 38 --repo yohawing/three-mmd-loader
gh pr checks 40 --repo yohawing/three-mmd-loader
```

如维护者要求修改，切换对应分支，修改、验证、创建新 commit 后正常 push。不要 amend 已推送 commit，除非用户明确要求。

### 同步上游

```bash
git fetch upstream
git switch main
git merge --ff-only upstream/main
git push fork main
```

贡献分支有 review 修改时，先确认 upstream 是否已前进，再按上游偏好 rebase 或 merge。不要 force-push，除非明确获得批准。

### 0.8.2 升级结果

- 2026-08-17 的 `v0.8.2` 已包含 PR #38 和 PR #40。

### 0.8.3 升级结果

- 2026-09-13 的 `v0.8.3` 新增 `MmdAnimRuntime.setHostRig`/`setHostPose` retarget、外部世界矩阵物理回调，修复清空 host rig 后外部物理绑定，并升级 mmd-anim 至 0.5.1。NekoVirtOS 目前未使用这些新 API。
- NekoVirtOS 已升级到 `@yohawing/three-mmd-loader@0.8.3`，并替换 `public/mmd/0.8.3/` 的配套 Bullet JS/WASM。0.8.3 的 WASM 与 0.8.2 不同（Rust 1.88.0 构建）。
- 官方包仍没有 `debugPhysicsContactsForRigidBodyRange()`（已核对 0.8.3 发布包），因此 patch 只保留这一项 JS 过滤；patch 触及的 physics 文件在 0.8.2 与 0.8.3 间上下文一致，仅重命名沿用。
- 上游若发布带 range query 的新版本，再删除 `patchedDependencies` 条目和 `patches/@yohawing__three-mmd-loader@0.8.3.patch`。

### 新版本发布后

1. 确认 release/npm 包是否包含 rigid-body range contact 查询。
2. 在独立分支更新 `@yohawing/three-mmd-loader` 版本。
3. 仅当发布包已覆盖 range query 时，删除 `patchedDependencies` 条目和 patch 文件。
4. 同步版本化 Bullet 资产目录，更新 `mmdPhysics.ts` 脚本路径。
5. 运行 `pnpm install` 更新 lockfile，确认旧 patch hash 消失。
6. 重跑 TypeScript、指定物理/触觉测试、完整测试和 build。
7. 再次进行真机回归：模型缩放、衣服物理、面板存续、左右控制器碰撞和震动。

## 本地分支保留策略

当前 loader clone 中应保留：

- `fix/dynamic-with-bone-translation`，跟踪 `fork/fix/dynamic-with-bone-translation`
- `fix/bullet-contact-debug-api`，跟踪 `fork/fix/bullet-contact-debug-api`
- `feat/bullet-contact-range-query`，跟踪 `fork/feat/bullet-contact-range-query`，整合 PR #38、PR #40 和 range query

PR 合并且 NekoVirtOS 已升级到包含修复的正式版本后，才考虑删除本地和 fork 分支。删除前确认没有待处理 review、未发布 commit 或回归修复。

## 非阻塞提示

- Windows checkout 可能显示 LF/CRLF 转换警告。
- NekoVirtOS build 可能提示 loader parser 的 `node:fs/promises`、`node:url` 被 Vite externalized。
- 部分 bundle chunk 超过 500 kB。
- 上述提示与本次物理/contact 修复无直接关系。
