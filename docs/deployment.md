# 部署与 wrangler 版本注意事项

最后更新：2026-11-25

## 当前部署路径

经典 Cloudflare Pages 直传。日常／PR 用 `pnpm run check`：舞台 Vitest → 工具和实验的 Node 测试 → loader 校验、类型检查、舞台与实验构建。PR 和 `master` 的检查没有部署凭证。发布从干净、已提交、用锁文件安装的检出开始：

```bash
pnpm run release:prepare
# 对这个 dist 做本次变更需要的浏览器冒烟；通过后上传原目录
pnpm run deploy
```

- 本仓库（mmd-xr-stage）：`mmd-xr-stage.pages.dev`
- 主仓库（neko-virt-os）：`neko-virt-os.pages.dev` / `os.nekolaska.vip`

`release:prepare` 一次执行远端 loader 对齐、`check`（含一次构建）和旧标签页桥校验；成功后在上传目录之外的 `stage-release.local` 留下 Git 提交与完整文件树 SHA-256。重新准备会先作废旧收据。`pnpm run deploy` 只晋级：核对当前提交、工作树和 `dist` 全部文件名／内容，使用固定 `wrangler@4.128.0` 上传同一目录，再核对主域入口及关键资源。没有收据、改过源码或制品拒绝上传；上线后如遇传播或网络故障可单独重试 `pnpm run release:live`，不必重新部署。收据覆盖自动检查；镜片观感不是收据的一部分。Git 默认分支是 **master**，Pages 生产分支是 **main**。

发布前检查构建 exit code；不要用 `| Select-Object` 等过滤管道掩盖失败。合并前完成必要验证和构建，合并后复用制品及时部署。验证生产 HTML 引用、JS/CSS/Bullet/动画 WASM 的内容哈希；HTTP 200 本身不能证明资源存在，因为 SPA 回退可能返回 HTML。验证 URL 加新的 cache-buster，勿复用旧查询参数。

旧分块最多六路并行取回。可用 `STAGE_LEGACY_ASSETS` 指向留存的旧构建 `assets/` 目录：只读取清单列出的名字，每个文件仍验原 SHA-256，缺项从固定部署补齐。私有测试目录不是发布依赖。

本机 Git 推送已验证需显式代理：

```bash
git -c http.proxy=http://127.0.0.1:7897 -c https.proxy=http://127.0.0.1:7897 push origin master
```

小行星在进景时才取物理模块。兼容脚本保留 `37a0ef3` 的旧移动模块和内联 WASM，以及 `7acb202` 的平滑球壳物理适配器，方便已打开、尚未进星球的旧标签页。新页只在进星球时取当前适配器。

旧标签页首次打开器官动态图也会按需取 Worker。发布后从主域名 GET `/assets/organ.worker-dQG0D6Ad.js`（加新查询参数），对响应正文计算 SHA-256，与[保留清单](../scripts/retain-legacy-scene.mjs)中固定部署 `41ef223b` 的 `3d6c4a49afc3d6a435d5fe81cdfc7cf8b92b00989efc15cda6b2bb548e8e13cb` 比对。HTTP 200 或回退绘图正常都不能证明旧 Worker 内容正确。

入口观察图还会按需加载 `entryLettering.worker-*.js`，身体状态的乳房观察使用 `breast.worker-*.js`。从包含这些模块的版本升级时，也要核对并保留旧标签页需要的 Worker。实际杆位和计量不依赖绘图或字表 Worker。

## wrangler ≥4.130 的代理委托坑（PR #15004）

wrangler 检测到命令由 AI 代理执行时，以下操作会被**委托成 Workers 静态资产向导**：

- `pages project create --production-branch <name>`（全新项目）
- 对**全新项目**的 `pages deploy`（4.130 起门槛从账户级放宽为项目级）

向导会改写 `package.json`（deploy 脚本换成 `wrangler deploy`）、新增 `wrangler.jsonc`、安装 wrangler devDependency。mmd-xr-stage 建站时已踩过一次：本地污染已还原，但向导**同时在远端创建并部署了一个同名 Worker**（2026-09-14 的过期快照），当日已用 `wrangler delete --name mmd-xr-stage` 删除，仅保留经典 Pages 项目。

**规避方式（任选）：**

```bash
npx wrangler@4.128.0 pages project create <name> --production-branch=main   # 钉版本
# 或由人在终端手动执行——委托仅在检测到代理环境时触发
```

**已存在的项目不受影响**：对已有 Pages 项目的 `pages deploy` 永远留在经典路径。

## 长期方向：Workers 静态资产

Cloudflare 正把 Pages 并入 Workers（Pages 冻结、无迁移期限）。以后新建静态站建议直接走新路径：

```jsonc
// wrangler.jsonc
{
  "name": "<name>",
  "compatibility_date": "2026-09-14",
  "assets": {
    "directory": "./dist",
    "html_handling": "auto-trailing-slash",
    "not_found_handling": "single-page-application"
  }
}
```

```bash
wrangler deploy              # 生产；URL 为 <name>.<账户子域>.workers.dev
wrangler versions upload     # 预览版本（取代 branch 预览语义）
```
