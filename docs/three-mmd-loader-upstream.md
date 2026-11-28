# three-mmd-loader：上游贡献与分支

[舞台使用的版本](./three-mmd-loader-maintenance.md) · [历史排障](./three-mmd-loader-history.md)

**2026-11-28 核对：**[#48](https://github.com/yohawing/three-mmd-loader/pull/48) 已合入官方 `develop`（`708cc69`）；[#49](https://github.com/yohawing/three-mmd-loader/pull/49) 仍开放，Node.js 22 和 24 检查通过，尚无审阅意见。两项修复都在舞台 fork 中。官方 npm 稳定版仍是 `0.9.0`，待新包发布后核对其实际制品再清理重复补丁。

## 已合并到 develop：共享骨架 CPU 去重

2026-11-27 已提交 [yohawing/three-mmd-loader#48](https://github.com/yohawing/three-mmd-loader/pull/48)。目标为官方 `develop`；来源为 `znzsofficial:perf/dedupe-render-palettes-v0.9`。基线 `35e86bc` 已含正式 0.9.0，两个提交分别是可独立运行的基准 `3ca0713`、实现和回归 `4f1c1c0`。PR 只改 CPU 渲染同步；公开接口、原生二进制和依赖锁不变。

同一角色的身体、材质和描边网格可能共用一个 `THREE.Skeleton`。在 35 个网格共用一套 512 骨骨架的基准中，更新调用从 35 次降到 1 次；35 套独立骨架仍各更新一次。

| Three 运行时 | 35 网格／1 骨架，CPU 渲染同步 | 正确性对照 |
|---|---|---|
| r184（上游锁定） | 498.1 → 42.3 µs/tick | 75 项定向用例通过；公开 PMX/VMD 五帧的完整骨架矩阵逐值相同 |
| r187（舞台使用） | 470.8 → 38.2 µs/tick | 同一组 75 项通过；五帧矩阵及回跳一致。修改的运行时源码通过 r187 类型检查 |

这是同步代码的局部耗时。全库换用 r187 类型定义时，基线与候选都会在 `webgpu/material-assembly.ts:267` 遇到相同的 `TS2345`；这项兼容问题未混入 PR。审阅状态和 CI 以 PR 链接为准。

## 已提交：材质与描边透明度

[PR #49](https://github.com/yohawing/three-mmd-loader/pull/49) 从官方 `develop@35e86bc` 单独提交，head 为 fork 的 `fix/evaluated-material-alpha-v0.9@0d8dc43`。针对 loader 默认 Three.js 材质，在 `model.update` / `updateAsync` 后将已求值的 PMX diffuse／edge alpha 应用到实际材质。未合入 UV 或 #48 的优化。

用可公开生成的双色 PMX 固定机位，在 Three r184、r187 上分别实绘权重 `0 → 0.5 → 1 → 0`：官方 0.9.0 四帧相同；修后本体和描边依次为不透明、半透明、透明、恢复，背景材质保持不变，末帧 RGBA 与原图逐字节一致。提交分支构建、lint 通过，全套 837 项通过、5 项跳过；上游审阅及 CI 以 PR 链接为准。

## 已提交：Bullet 空接触流形

[mmd-anim #73](https://github.com/yohawing/mmd-anim/pull/73) 仍开放，来自 [mmd-anim fork](https://github.com/znzsofficial/mmd-anim/tree/perf/skip-empty-bullet-manifolds) 的 `1fdfcf1`，目标是 `mmd-anim` 的 `develop`。同一修复另回移到舞台当前锁定的 `0.5.5`，以同工具链复编，只改变 Bullet WASM。336 帧实模的接触序列和两种 Bullet 入口均通过回归；[源码构建与双眼对照](./performance/bullet-step-profile.md#第二轮看舞时两只手柄都离开演员)已存档。等待 loader 正式 npm 包包含更新后的 Bullet，再走舞台晋级；现有 `0.9.0` 原配二进制继续使用。

## 其他候选如何处理

| 候选 | 处置与依据 |
|---|---|
| 标准／附加 UV | 与透明度分开；投稿前核对普通 Three 几何与 WebGPU 已有稀疏计算，避免在挂载或恢复时重复变形。 |
| CCD 活跃骨链 | 新版求解器已拆分。保留 fork 的实现；投稿前再测新版的矩阵、残差及几乎所有骨链都活跃时的成本。 |
| 物理中心读取、求值器热切换、诊断计时 | 保留 fork。前两项涉及公开 API 与生命周期；宜先讨论通用需求，不把舞台交互或观测接口一并提交。 |
| 旧修复 | [#38](https://github.com/yohawing/three-mmd-loader/pull/38)、[#40](https://github.com/yohawing/three-mmd-loader/pull/40) 已合入。官方 0.9.0 还提供范围接触查询、共享代理几何、r186/r187 自阴影兼容，不重复投稿。 |

## 分支清理记录（2026-11-27）

清理后保留了三条：`main@c762507` 是舞台来源；`perf/dedupe-render-palettes-v0.9@4f1c1c0` 是 #48 的 head；`codex/release-0.7.0@56a6ba7` 有一个未合入的独有提交，与正式 tag 内容不同，保留追溯。此后新增 #49 的独立 head；两个 PR 审阅期间均保留各自分支。

| 已删除的 fork 远端分支 | 原提交 | 原因 |
|---|---|---|
| `fix/dynamic-with-bone-translation` | `20e1694` | #38 已合入 |
| `fix/bullet-contact-debug-api` | `60e99d7` | #40 已合入 |
| `codex/release-v0.8.1` | `ced11de` | 旧发布准备，提交在主线内 |
| `develop` | `ab0fc79` | fork 的旧开发线停在 v0.8.1，无独有提交；官方 `upstream/develop` 不受影响 |
| `feat/bullet-contact-range-query` | `689d183` | 原提交未按原哈希合并；官方 `7823789` 已提供等价接口，本地保留原分支 |

本地另清理了已合入的两条 `fix/` 分支（#38、#40）以及 `sync/stage-0.8.6`、`sync/v0.8.6-morph-atlas`、`sync/stage-0.9.0`。独立工作树、旧基准分支和标签保留。后续清理仍先核对远端实际 tip、提交可达性、进行中的 PR 和工作树占用。
