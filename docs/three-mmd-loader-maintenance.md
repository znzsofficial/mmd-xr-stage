# three-mmd-loader：舞台用哪一版

舞台只加载一份 loader。源码维护在[我们的 fork](https://github.com/znzsofficial/three-mmd-loader)；安装时，pnpm 用官方 npm 包和[从 fork 生成的补丁](../patches/@yohawing__three-mmd-loader@0.9.0.patch)还原经过验证的构建。玩家的模型和贴图仍由[本地背包](./gameplay/asset-workflow.md)持有。

## 仓库与依赖

| 截至 2026-11-28 | 使用的版本 | 去哪里核对 |
|---|---|---|
| 本项目正式站 | loader 0.9.0 + fork `c4d56e8`，Three r187 | [发布记录](./release-history.md) · [源码锁定清单](../loader-source.json)：347 个 loader `dist/` 文件 |
| 我们的 fork | [`main@c4d56e8`](https://github.com/znzsofficial/three-mmd-loader/commit/c4d56e8) | 接触读取复用缓冲；沿用官方 Bullet JS/WASM，使用 npm 和 `package-lock.json` |
| 官方 | [`v0.9.0@62ce047`](https://github.com/yohawing/three-mmd-loader/releases/tag/v0.9.0)，mmd-anim 0.5.5 | 开发依赖锁定 Three r184；0.9.0 已包含 r187 的 TSL 自阴影兼容修复 |

## 特性归属

| 功能 | 谁提供，舞台如何使用 |
|---|---|
| Bullet 接触、材质与描边共享几何 | 官方提供接触计数、明细和按刚体区间查询；舞台据此区分手柄接触。官方代理共享几何，避免重复分配形态纹理。 |
| 阴影 | 官方提供 r187 兼容的 TSL 阴影 pass。舞台在 XR 关闭专用自阴影代理，避免污染左眼，保留普通投地阴影。 |
| 骨架和物理求值 | fork 对同一骨架每次渲染同步只更新一次，并优化 CCD 活跃骨链。`readRigidBodyCenters` 供失追后恢复；`createDetachedRuntime` / `exchangeRuntime` 用于开关物理时保留演员和动作。 |
| 透明度、UV 与加载 | fork 把求值后的 diffuse／edge alpha、标准／附加 UV 接到实际绘制表面；同图的 alpha 采样可复用，仍按每块材质的 UV 判定。见[实模对照](./performance/model-feature-coverage.md#086-材质透明度uv-和手动求值)。 |
| 帧时与诊断 | fork 提供可选的调试快照开关、矩阵传播合并及分段计时；舞台按需采样，不写入私有文件名。见[物理切换](./performance/physics-toggle.md)与[运行时测量](./performance/xr-runtime-performance.md)。 |
| 玩家功能 | 背包、GLB/glTF 物件、衣柜、持物、GPU 裙摆与跨后端续场由舞台实现。它们不随官方 loader 单独发版。 |

## 怎么保持同步

1. `pnpm loader:upstream` 比对 npm 稳定版、tag、tarball 完整性和 `fork/main`。在 **loader 仓库**从 fork 主线合入新 tag，用 npm、锁定的原生制品和回归测试核对扩展；已有官方等价实现的改用官方代码。
2. 在**舞台仓库**更新精确版本、`pnpm-workspace.yaml` 的补丁声明和 `public/mmd/<version>/` 的 Bullet JS/WASM。旧标签页仍依赖的资源按[部署说明](./deployment.md)保留。
3. 从已提交且干净的 fork 检出运行 `pnpm loader:export <fork目录>`，再 `pnpm install`、`pnpm loader:verify`。将生成补丁、`loader-source.json`、锁文件和对应资产一起提交；不手改补丁。
4. 复验受影响路径、全套测试、构建与正常入口的画面，再按[发布流程](./deployment.md)部署同一份制品。0.9.0 本轮 fork 测试 842 通过、5 跳过；舞台候选 1090 项舞台测试和 31 项工具测试通过，实模及 3 人＋3 物续场已复验。

[上游 PR 与分支](./three-mmd-loader-upstream.md) · [历史排障、旧基准及发布记录](./three-mmd-loader-history.md)
