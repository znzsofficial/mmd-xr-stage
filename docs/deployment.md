# 部署与 wrangler 版本注意事项

最后更新：2026-09-14

## 当前部署路径

经典 Cloudflare Pages 直传：

```bash
pnpm deploy   # build + wrangler pages deploy ./dist --project-name=<name> --branch=main
```

- 本仓库（mmd-xr-stage）：`mmd-xr-stage.pages.dev`
- 主仓库（neko-virt-os）：`neko-virt-os.pages.dev` / `os.nekolaska.vip`

## wrangler ≥4.130 的代理委托坑（PR #15004）

wrangler 检测到命令由 AI 代理执行时，以下操作会被**委托成 Workers 静态资产向导**：

- `pages project create --production-branch <name>`（全新项目）
- 对**全新项目**的 `pages deploy`（4.130 起门槛从账户级放宽为项目级）

向导会改写 `package.json`（deploy 脚本换成 `wrangler deploy`）、新增 `wrangler.jsonc`、安装 wrangler devDependency。mmd-xr-stage 建站时已踩过一次并完整还原。

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
