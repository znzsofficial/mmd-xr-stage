# 部署与 wrangler 版本注意事项

最后更新：2026-11-28

## 当前部署路径

经典 Cloudflare Pages 直传。**在下一次构建覆盖 `dist/` 前，先[登记上一版固定部署](#从上一版制品生成旧标签页清单)**，把增量清单随本轮源码提交。小改默认 `pnpm run release:quick [相关测试文件…]`，例如 `pnpm run release:quick experiments/gpu-cloth/xrPalms.test.js`。仅运行指定用例文件，再构建一次，上传后核对两入口及入口 JS/CSS。文案或布局只需看实际效果时可不指定测试；收据的 `checks.files` 会如实为空。PR 和 `master` 的 CI 在后台跑全量。背包数据、XR 入场、loader、跨模块重构或影响范围不清，用下面的 `release:prepare` 全量档。两档二选一，共用原制品收据、旧标签页保护和上传命令，不把快速档写成全量通过。发布从干净、已提交、用锁文件安装的检出开始：

```bash
pnpm run release:prepare
# 对这个 dist 做本次变更需要的浏览器冒烟；通过后上传原目录
pnpm run deploy
```

- 本仓库（mmd-xr-stage）：`mmd-xr-stage.pages.dev`
- 主仓库（neko-virt-os）：`neko-virt-os.pages.dev` / `os.nekolaska.vip`

`release:prepare` 一次执行远端 loader 对齐、`check`（含一次构建）和旧标签页桥校验；成功后在上传目录之外的 `stage-release.local` 留下 Git 提交与完整文件树 SHA-256。重新准备会先作废旧收据。`pnpm run deploy` 只晋级：核对当前提交、工作树和 `dist` 全部文件名／内容，使用固定 `wrangler@4.168.0` 上传到已有 Pages 项目，再核对主域入口及关键资源。没有收据、改过源码或制品拒绝上传；上线后如遇传播或网络故障可单独重试 `pnpm run release:live`，不必重新部署。收据覆盖自动检查；镜片观感不是收据的一部分。Git 默认分支是 **master**，Pages 生产分支是 **main**。

所有现有场景均可在准备页选择「WebGPU」，或用 `/?set=<布景 ID>&xrBackend=webgpu`。默认 WebGL；构建校验准备页静态图不含该后端。`node scripts/webgpu-actor/rooms-smoke.cjs dist` 用单浏览器检查正式构建布景的上下场、着色器和双眼画面；`node scripts/webgpu-actor/mixed-layout.mjs --screen-only --dist` 在同一制品中从准备页实测 GLB/glTF 导入、放置和回场。独立资格预览仍写 `dist-qualification/`，不要用它覆盖生产 `dist/`。

发布前检查构建 exit code；不要用 `| Select-Object` 等过滤管道掩盖失败。合并前完成必要验证和构建，合并后复用制品及时部署。验证生产 HTML 引用、JS/CSS/Bullet/动画 WASM 的内容哈希；HTTP 200 本身不能证明资源存在，因为 SPA 回退可能返回 HTML。验证 URL 加新的 cache-buster，勿复用旧查询参数。

本机 Git 推送已验证需显式代理：

```bash
git -c http.proxy=http://127.0.0.1:7897 -c https.proxy=http://127.0.0.1:7897 push origin master
```

## 从上一版制品生成旧标签页清单

上版主域验收通过后，保留 **`dist/` 和它旁边的 `stage-release.local`**。取该版 Pages 上传结果中的固定部署 ID（例如 `fc3e5420`，不是 Git 短提交、`main` 或主域名）。在这对文件还在项目根目录时只需：

```bash
pnpm run release:retain fc3e5420
```

若已另存旧版，把 `--dist` 指向留存的完整目录；默认从其父目录找收据，也可指定 `--receipt <文件>`。例如 `pnpm run release:retain fc3e5420 --dist local-review/release-archives/fc3e5420/dist`。登记在本地完成，不要求旧提交仍是当前 HEAD，也不会改动输入。工具逐件计算 SHA-256，先核对**完整文件树**与收据，再登记两个构建的 `assets/`、`labs/cloth/assets/` 下全部哈希资源，包括间接导入、Worker、WASM、CSS 和图片。两个目录中同名文件是两个 URL。入口 HTML 和 `public/` 的固定路径由当前构建提供；例如 `public/mmd/0.8.6/` 仍须保留旧 Bullet。

[清单目录](../scripts/legacy-scene/)中 `history.mjs` 保留了原有的 309 条路径、来源部署和摘要。每个 `<部署 ID>.json` 记录上版提交、收据摘要及新增的「原相对路径 → SHA-256」。已知路径内容相同则沿用原部署；内容不同、中途改过制品或试图用不同的制品改写已生成的清单都会报错。`5972872` 的 454 个文件中有 403 个构建资源，[本轮增量](../scripts/legacy-scene/fc3e5420.json)为 94 个；重复登记输出 `0 new`。登记异常退出若留下 `.record.lock`，确认没有登记命令在运行后再移除这个锁并重试。

`release:quick` 和 `release:prepare` 在**新制品**上补齐清单：已有文件先验哈希，禁止覆盖；缺项最多六路并行从原固定部署取回并验哈希。可设置 `STAGE_LEGACY_DIST` 为留存的完整旧 `dist/` 以按原路径读缓存，仅缓存缺项才联网。旧的 `STAGE_LEGACY_ASSETS` 仍可指向顶层 `assets/` 缓存，只匹配这一棵树。源文件即使 HTTP 200，正文与清单摘要不符也会拒绝写入。全量上线核对仍检查历史 `organ.worker-dQG0D6Ad.js` 以及新旧解析／Bullet WASM。

跨版本行为验收：`node scripts/verify-old-tab.mjs <上版已封存的dist目录> dist`。同一个浏览器标签页在旧准备页先选 PMX，服务器切到补齐清单的新 `dist/` 后首次选 WebGPU、进星球、用扳机放下角色，并用摇杆实际走动。脚本检查两个眼图中演员的像素、已加载的旧分块、Rapier 步进和视点行程；不依赖 HTTP 200 或新开一页。

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
