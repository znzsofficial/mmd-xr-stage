# 会话交接｜2026-11-21

[正式舞台](https://mmd-xr-stage.pages.dev) · [固定版 `8160ce0`](https://fd236688.mmd-xr-stage.pages.dev) · [发布记录](./release-history.md) · [文档索引](./README.md)

**已交付：16 景、9 件道具。** [四幕玩法](./gameplay/README.md)、[校园电玩环线](./scenery/campus-arcade-loop.md)、[枕河街](./scenery/jiangnan-river-street.md)、双喜堂礼案、两颗可登陆卫星及[潮汐深空](./scenery/opal-planet.md)均已上线。此版 439 项测试通过，主域名和模拟双眼 XR 已复核。

## 下次从这里开始

1. **待真机：先验星球，再单独测教室。** 星球冷进和重入试两根摇杆；能动再用左 X 起飞、返航，侧移看环缝与暗星。教室用上次角色和大身体 VMD，阴影关，物理关／开各看约 20 秒，保持物理开从泳池回教室，退出立即导出 JSON。[操作和读数](./performance/next-quest-export.md)。11 月 20 日 14:43Z 是改前报告；新版预热、回场缓存和持续 72 FPS 尚无真机结论。
2. **未开发，等选题：** [合卺对影／霜岬回波](./gameplay/interactive-scene-studies.md)。推荐先做喜院红绳触发双燕灯影。性能方面，[暂停物理休眠](./performance/README.md#回场与后续验收)须先测静止、接近、首触，再决定是否实现。
3. **未排期：** 草坪↔礼拜堂水庭、情侣套房↔月庭私汤仅是连接建议；[莱布伦城街角](./scenery/strinova-map-study.md)仍是选点研究。[海边终点站、旧城皮影台、深夜唱片行](./scenery/next-modeling-round.md#婚礼之后的新景候选未排期)及恋活卡暂缓。[Blender 转换](./gameplay/blender-characters.md)已交付；[Babylon](./three-tooling.md#什么时候再考虑迁移)保留实验，正式版用 Three。

接手先看 `git status --short --branch`；改代码读[架构](./architecture.md)和 [AGENTS.md](../AGENTS.md)。私有模型、原图和真机原始 JSON 留在本机。只改文档时推送文档即可。
