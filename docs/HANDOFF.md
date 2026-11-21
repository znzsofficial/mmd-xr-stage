# 会话交接｜2026-11-21

[正式舞台](https://mmd-xr-stage.pages.dev) · [固定版 `aee99d5`](https://1b995ab7.mmd-xr-stage.pages.dev) · [发布记录](./release-history.md) · [文档索引](./README.md)

**16 景、9 件道具，主列表 10 个入口。** [星环遗庭传送大厅](./scenery/README.md)接入六个独立小片场；[琉璃小行星](./scenery/opal-planet.md)仍可直达。主域名六门往返、模拟双眼 XR 扳机进门和 B 面板返回已复核。

## 下次从这里开始

1. **待真机：先验星球，再单独测教室。** 星球冷进和重入试两根摇杆；能动再用左 X 起飞、返航，侧移看环缝与暗星。教室用上次角色和大身体 VMD，阴影关，物理关／开各看约 20 秒，保持物理开从泳池回教室，退出立即导出 JSON。[操作和读数](./performance/next-quest-export.md)。11 月 20 日 14:43Z 是改前报告；新版预热、回场缓存和持续 72 FPS 尚无真机结论。
2. **角色优先：** 恋活卡已重启兼容调查，尚不能直接进舞台。先读卡的 Sideloader 引用，用 GUID、类别和原始槽位核对 zipmod，再看一套穿搭能否还原脸、眼睛和头发。[Blender 转换](./gameplay/blender-characters.md)已交付，可作后段验证。下一个布景先从用户想让角色入镜的画面选，不把扩充数量当目标。
3. **未排期：** [合卺对影／霜岬回波](./gameplay/interactive-scene-studies.md)、草坪↔礼拜堂、套房↔私汤、[莱布伦城街角](./scenery/strinova-map-study.md)与[三处新景](./scenery/next-modeling-round.md#婚礼之后的新景候选未排期)均为候选。[暂停物理休眠](./performance/README.md#回场与后续验收)先取证；[Babylon](./three-tooling.md#什么时候再考虑迁移)保留实验，正式版用 Three。

接手先看 `git status --short --branch`；改代码读[架构](./architecture.md)和 [AGENTS.md](../AGENTS.md)。私有模型、原图和真机原始 JSON 留在本机。只改文档时推送文档即可。
