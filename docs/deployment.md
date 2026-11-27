# 部署与 wrangler 版本注意事项

最后更新：2026-11-27

## 当前部署路径

经典 Cloudflare Pages 直传。小改默认 `pnpm run release:quick [相关测试文件…]`，例如 `pnpm run release:quick experiments/gpu-cloth/xrPalms.test.js`。仅运行指定用例文件，再构建一次，上传后核对两入口及入口 JS/CSS。文案或布局只需看实际效果时可不指定测试；收据的 `checks.files` 会如实为空。PR 和 `master` 的 CI 在后台跑全量。背包数据、XR 入场、loader、跨模块重构或影响范围不清，用下面的 `release:prepare` 全量档。两档二选一，共用原制品收据、旧标签页保护和上传命令，不把快速档写成全量通过。发布从干净、已提交、用锁文件安装的检出开始：

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

旧分块最多六路并行取回。可用 `STAGE_LEGACY_ASSETS` 指向留存的旧构建 `assets/` 目录：只读取清单列出的名字，每个文件仍验原 SHA-256，缺项从固定部署补齐。私有测试目录不是发布依赖。

0.9.0 更换了动画解析 WASM 和 Bullet WASM。旧舞台与布料实验页首次导入 PMX 时，分别从 `assets/` 和 `labs/cloth/assets/` 读取原版 `mmd_anim_wasm_bg-CY5Cf0iI.wasm`；[旧标签页清单](../scripts/retain-legacy-scene.mjs)保留两个 URL。延后开启物理的旧页面仍从 `mmd/0.8.6/` 取配套 JS/WASM。全量上线核对覆盖新旧两套资源。

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
