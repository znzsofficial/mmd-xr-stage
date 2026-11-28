# 会话交接｜2026-11-28

**本轮已结项，无待发布的产品改动。** [海站与站前公园](https://mmd-xr-stage.pages.dev/?set=seasideTerminus&view=screen) · [WebGPU 海站](https://mmd-xr-stage.pages.dev/?set=seasideTerminus&xrBackend=webgpu) · [`d3f7aac` 固定部署](https://6cc38554.mmd-xr-stage.pages.dev) · [发布记录](./release-history.md)。后续产品改动验证通过就发布，除非用户明确要求暂缓。

## 正式站能做什么

- WebGPU 首次并行准备布料管线，第二人和同设备再次入场复用；切回此前绘制过的画风可复用绘制对象。实模复切仿终末地由 28 个着色器模块／17 条渲染管线降为 **0／0**。首次画风仍按需编译。`gpuTiming=1` 额外导出首次进入、放置及换画风的分段墙钟。[同脚本放置和切换测量](./performance/README.md#webgpu-首次放置与切画风)

- 新版修复[极端质量尾链离开骨盆](./performance/xr-runtime-performance.md#开物理后尾根离开身体)，以及 WebGPU XR 收起操作页误收搭档。屏幕与模拟 XR 同一 PMX、开物理 6 秒后尾根均稳定，收起搭档面板后手动位置保持、已启动的自动往复继续。[双后端技术栈](./xr-rendering-stack.md)并排列出渲染、求值、布料与按需 GPU 分段计时；[海站双眼画面与开销](./performance/README.md#webgpu-单人播舞)只作桌面结论。

- 17 个布景、13 件背包道具。WebGL 和 WebGPU 可在同一标签页续接 **3 名 PMX 演员＋3 件 GLB/glTF 物件**的布局，保留各自的动作、材质、摆位和舞段时刻。屏幕观看与默认 XR 入口仍用 WebGL。[物件导入](./gameplay/asset-workflow.md#放一件-glb-或-gltf) · [跨后端、换肤、接触和阴影的实绘对照](./webgpu-xr-status.md#混合布局材质与环境的画面对照)
- 海站连接日照喷泉公园、树荫和商店街。同页支持[外置可撕丝袜](./gameplay/actor-tools.md)，WebGPU XR 的演员画风可选原 MMD、仿终末地和[仿卡拉彼丘](./scenery/strinova-render-study.md#在舞台上切换)。
- 现有 [16 种快速体位](./gameplay/pose-and-body-states.md#快速体位)。[半透明搭档](./gameplay/pelvic-attachment.md#选择支架或半透明搭档)可在原位编辑演员，一侧膝盖变化不挪动另一侧撑手。穿衣实模七姿模拟双眼复核，最终成品另经 screen/Bullet 检查；[WebGPU 布料](./performance/gpu-cloth-lab.md#实际解算的内容)减少了采样矩阵上传与 CPU 骨节点访问，未证实整帧或 Quest FPS 上升。[角色工具回归](./performance/actor-tools-regression.md) · [历史 Quest 记录](./performance/quest-floor-dance.md)

## 下次从哪里接

**优先建议（未排期）：[在半身镜头里按住吐舌、松开恢复](./gameplay/next-actor-tools.md#候选主动表情)。** 两份本地 PMX 已找到相关顶点形态，尚未实绘确认它们会带动哪些五官。若用户选这项，先验证作者表情与当前 VMD 的叠加和复原。

备选是让演员按公园长椅的真实座面高度坐下。性能另走[同场景单人播舞的分项对照](./performance/README.md#webgpu-单人播舞)，已有布料收益不重复立项。六个小片场仍可从星环大厅或直链进入；具体封存哪些尚待玩家点名，不删旧布局、不重做小房间。

## Loader 和上游 PR

正式站使用官方 `three-mmd-loader 0.9.0`＋自有 fork `main@c762507` 的生成补丁，匹配 mmd-anim 0.5.5 和 Three r187；官方开发依赖仍锁 r184。[三方版本与特性归属](./three-mmd-loader-maintenance.md) · [精确来源与制品摘要](../loader-source.json) · [旧版排障归档](./three-mmd-loader-history.md)

截至 2026-11-27 收尾，[#48 共享骨架 CPU 去重](https://github.com/yohawing/three-mmd-loader/pull/48) 和 [#49 材质／描边透明度](https://github.com/yohawing/three-mmd-loader/pull/49) 均已提交官方 `develop`，**Node 22、24 CI 全部通过，均未合并、无审阅意见**。两条修复都已由 fork 提供，正式站无需等待上游。若接续审阅，先查看对应 PR 的最新反馈；保留各自的 head 分支。[测试证据、贡献范围和分支清理记录](./three-mmd-loader-upstream.md)

## 未排期事项

UV 形态与透明度分开处理，CCD 优化在取得新版基准前留在 fork；暂不继续投稿。角色慢帧与模型兼容专项、历史设备回访、恋活卡导入仍按需处理。旧记录中“多人／导入物件未开放”仅适用于早期单角色版本。

[文档索引](./README.md) · [角色画风对照](./scenery/character-toon-references.md) · [较早的完整交接](./handoff-history-2026-11-26.md)。本机私有审图索引：`local-review/README.md`。
