# 会话交接｜2026-11-28

**当前正式版：准备页画质三档常显，细调一层。** [正式站](https://mmd-xr-stage.pages.dev) · [WebGPU 海站](https://mmd-xr-stage.pages.dev/?set=seasideTerminus&xrBackend=webgpu) · [`f22d7fb` 固定部署](https://ac63ab3d.mmd-xr-stage.pages.dev) · [发布记录](./release-history.md)。

**下次接续：**[海站 72 Hz 验收与三项优化](./performance/README.md#下一轮海站-72-hz)。依次查公园像素与贴图、静态远景网格、开物理后的 Bullet；本轮只整理，三项均未开工。外套下摆已在桌面 WebGPU 实绘并通过双手拨衣，公园店面少画后六个机位双眼像素一致。尚无新版 Quest 帧率；[真机旧记录和桌面新验证](./performance/quest-harbour-2026-11-28.md)分开看。

## 正式站能做什么

- 「服装 → 可撕丝袜」分别识别两侧袜身和脚面，保留衣物遮挡；鞋里没有脚面也可以只贴合有连续腿面的部分。77 份本机角色版本由 23 份扩到 45 份适配，44 份在原衣下至少有一个同侧射线采样命中。[实测口径](./performance/actor-tools-regression.md#外置丝袜的裂口与覆盖) · [普通 XR 记账与可选 GPU 计时的区别](./performance/viewing-and-diagnostics.md#记录本身会不会掉帧)。具名矩阵仅在 `local-review/stocking-compat-round/matrix.md`。

- 海站花园修掉店面共面重叠与铺装交叉抢深度，树冠四批按两眼可见范围减量；北台星云保留星核和环边精度，并减少逐片元壳面求交。[成品对照与剩余闪点范围](./performance/scenery-render-work.md#海站花园与小行星北台2026-11-28)。GPU 分段计时已用；r187 的显式 Render Bundles 经命令复现不适配双眼，WebGPU XR multiview 仍未启用。

- WebGPU 首次并行准备布料管线，第二人和同设备再次入场复用；切回此前绘制过的画风可复用绘制对象。实模复切仿终末地由 28 个着色器模块／17 条渲染管线降为 **0／0**。首次画风仍按需编译。`gpuTiming=1` 额外导出首次进入、放置及换画风的分段墙钟。[同脚本放置和切换测量](./performance/README.md#webgpu-首次放置与切画风)

- 新版修复[极端质量尾链离开骨盆](./performance/xr-runtime-performance.md#开物理后尾根离开身体)，以及 WebGPU XR 收起操作页误收搭档。屏幕与模拟 XR 同一 PMX、开物理 6 秒后尾根均稳定，收起搭档面板后手动位置保持、已启动的自动往复继续。[双后端技术栈](./xr-rendering-stack.md)并排列出渲染、求值、布料与按需 GPU 分段计时；[海站双眼画面与开销](./performance/README.md#webgpu-单人播舞)只作桌面结论。

- 16 个布景、13 件背包道具。WebGL 和 WebGPU 可在同一标签页续接 **3 名 PMX 演员＋3 件 GLB/glTF 物件**的布局，保留各自的动作、材质、摆位和舞段时刻。屏幕观看与默认 XR 入口仍用 WebGL。[物件导入](./gameplay/asset-workflow.md#放一件-glb-或-gltf) · [跨后端、换肤、接触和阴影的实绘对照](./webgpu-xr-status.md#混合布局材质与环境的画面对照)
- 海站连接日照喷泉公园、树荫和商店街。同页支持[外置可撕丝袜](./gameplay/actor-tools.md)，WebGPU XR 的演员画风可选原 MMD、仿终末地和[仿卡拉彼丘](./scenery/strinova-render-study.md#在舞台上切换)。
- 现有 [16 种快速体位](./gameplay/pose-and-body-states.md#快速体位)。[半透明搭档](./gameplay/pelvic-attachment.md#选择支架或半透明搭档)可在原位编辑演员，一侧膝盖变化不挪动另一侧撑手。穿衣实模七姿模拟双眼复核，最终成品另经 screen/Bullet 检查；[WebGPU 布料](./performance/gpu-cloth-lab.md#实际解算的内容)减少了采样矩阵上传与 CPU 骨节点访问，未证实整帧或 Quest FPS 上升。[角色工具回归](./performance/actor-tools-regression.md) · [历史 Quest 记录](./performance/quest-floor-dance.md)

## 下次从哪里接

**纸鸢与海站：**线轴在任一布景均可拿取或交给角色，左右风签跟随持有者；海站长椅另供屏幕空场放飞。独立晴空草坪已移除，`?set=lawn` 按普通无效链接处理。四馆门前共用室外布局，馆内各存摆位，电玩厅二楼可步行到泳池计时台。[路线与布局边界](./scenery/harbour-city.md)。

**重角色开物理播舞：**保留原求解器。手柄离开重角色时可跳过能确认为零的查询，[桌面正反对照与适用范围](./performance/bullet-step-profile.md#第二轮看舞时两只手柄都离开演员)见分测；`local-review/heavy-bullet/` 有原始配对。新头显报告已把查询和角色更新分列。

**两项维护重构已上线。** 旧标签页资源从上版制品生成；已开着的旧页选模后，换成新制品仍能首次进 WebGPU、放置并走星球。WebGPU 房间同步撤销丢失头姿的袜面／摆姿拖动；仍可见的慢帧留在报告中。[范围和玩家验收](./architecture/maintenance.md#清理与验证预算)。搭档面板保持现状。

**准备页：**「观看画质」常显三档和 VR 目标刷新率，「画质细调」仅一层，旧偏好与预设数值维持原样。真机对照使用单项设置；整档切换改变多项，不能用于归因。

**原始证据入口：**[四项优化及双眼还原](./performance/avoidable-work.md)；本机 `local-review/city-polish/` 保留同段形态 A/B、切画风对照、纹理句柄与周边细节设置回放，`local-review/heavy-bullet/` 保留重角色正反顺序 A/B。复工优先复用这些记录；电脑不同功耗档的绝对耗时不混算。

**记录开关：建议暂缓。** 普通记录能留下偶发卡顿，详细 GPU 计时已默认关闭；若需要在 Quest 做“完全不记录”的对照，再评估一个独立于 FPS 显示的采样选项。[开销与重议条件](./performance/viewing-and-diagnostics.md#要不要加记录开关)

WebGPU 大骨架容量是独立的兼容性问题，本轮不排。玩法候选仍是[按住吐舌、松开恢复](./gameplay/next-actor-tools.md#候选主动表情)或长椅落座；均未开工。旧片场封存等玩家点名。

## Loader 和上游 PR

正式站使用官方 `three-mmd-loader 0.9.0`＋自有 fork `main@303bb7c` 的生成补丁，匹配 mmd-anim 0.5.5 和 Three r187；官方开发依赖仍锁 r184。[三方版本与特性归属](./three-mmd-loader-maintenance.md) · [精确来源与制品摘要](../loader-source.json) · [旧版排障归档](./three-mmd-loader-history.md)

截至 2026-11-27 收尾，[#48 共享骨架 CPU 去重](https://github.com/yohawing/three-mmd-loader/pull/48) 和 [#49 材质／描边透明度](https://github.com/yohawing/three-mmd-loader/pull/49) 均已提交官方 `develop`，**Node 22、24 CI 全部通过，均未合并、无审阅意见**。两条修复都已由 fork 提供，正式站无需等待上游。若接续审阅，先查看对应 PR 的最新反馈；保留各自的 head 分支。[测试证据、贡献范围和分支清理记录](./three-mmd-loader-upstream.md)

## 未排期事项

UV 形态与透明度分开处理，CCD 优化在取得新版基准前留在 fork；暂不继续投稿。角色慢帧与模型兼容专项、历史设备回访、恋活卡导入仍按需处理。旧记录中“多人／导入物件未开放”仅适用于早期单角色版本。

[文档索引](./README.md) · [角色画风对照](./scenery/character-toon-references.md) · [较早的完整交接](./handoff-history-2026-11-26.md)。本机私有审图索引：`local-review/README.md`。
