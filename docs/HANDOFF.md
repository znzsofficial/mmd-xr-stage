# 会话交接｜2026-11-27

**本轮已结项，无待发布的产品改动。** [正式舞台](https://mmd-xr-stage.pages.dev) · [WebGPU 海站](https://mmd-xr-stage.pages.dev/?set=seasideTerminus&xrBackend=webgpu) · [`b124f61` 固定部署](https://703e0c9c.mmd-xr-stage.pages.dev) · [发布记录](./release-history.md)。后续产品改动验证通过就发布，除非用户明确要求暂缓。

## 正式站能做什么

- 17 个布景、13 件背包道具。WebGL 和 WebGPU 可在同一标签页续接 **3 名 PMX 演员＋3 件 GLB/glTF 物件**的布局，保留各自的动作、材质、摆位和舞段时刻。屏幕观看与默认 XR 入口仍用 WebGL。[物件导入](./gameplay/asset-workflow.md#放一件-glb-或-gltf) · [跨后端、换肤、接触和阴影的实绘对照](./webgpu-xr-status.md#混合布局材质与环境的画面对照)
- 新增种付位、俯卧侧屈膝和后撑分腿坐；[半透明搭档](./gameplay/pelvic-attachment.md#选择支架或半透明搭档)可替代支架与假阳具。尺寸页直接预览面板阴道模型；自动往复可从主操作排预约一次体外释放。正式制品通过 1107 项舞台＋31 项工具测试；17 项主域页面与资源一致。屏幕 WebGL 与模拟 WebGPU XR 均使用桌面硬件 GPU 和本地 PMX，未测 Quest 实戴。[角色工具回归](./performance/actor-tools-regression.md#阴道尺寸快速体位与半透明搭档) · [历史 Quest 记录](./performance/quest-floor-dance.md)

## Loader 和上游 PR

正式站使用官方 `three-mmd-loader 0.9.0`＋自有 fork `main@c762507` 的生成补丁，匹配 mmd-anim 0.5.5 和 Three r187；官方开发依赖仍锁 r184。[三方版本与特性归属](./three-mmd-loader-maintenance.md) · [精确来源与制品摘要](../loader-source.json) · [旧版排障归档](./three-mmd-loader-history.md)

截至 2026-11-27 收尾，[#48 共享骨架 CPU 去重](https://github.com/yohawing/three-mmd-loader/pull/48) 和 [#49 材质／描边透明度](https://github.com/yohawing/three-mmd-loader/pull/49) 均已提交官方 `develop`，**Node 22、24 CI 全部通过，均未合并、无审阅意见**。两条修复都已由 fork 提供，正式站无需等待上游。若接续审阅，先查看对应 PR 的最新反馈；保留各自的 head 分支。[测试证据、贡献范围和分支清理记录](./three-mmd-loader-upstream.md)

## 未排期事项

UV 形态与透明度分开处理，CCD 优化在取得新版基准前留在 fork；暂不继续投稿。角色慢帧与模型兼容专项、历史设备回访、恋活卡导入仍按需处理。旧记录中“多人／导入物件未开放”仅适用于早期单角色版本。

[文档索引](./README.md) · [角色画风对照](./scenery/character-toon-references.md) · [较早的完整交接](./handoff-history-2026-11-26.md)。本机私有审图索引：`local-review/README.md`。
