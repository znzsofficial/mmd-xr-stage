# 会话交接｜2026-11-20

[线上舞台](https://mmd-xr-stage.pages.dev) · [固定功能版 `1abb982`](https://e30a429d.mmd-xr-stage.pages.dev) · [分类文档索引](./README.md)

**线上基线**：八景六件道具，教室↔草坪↔泳池已可连续走。泳池加门廊、计时台与救生椅；持物按左右掌指根和道具握柄定位，VR／屏幕均可手调。311 项测试、实模双腕检查、模拟 XR 三区实走和布局恢复、生产主域名入口及 49 份文件哈希通过。[三区桌面对照](./performance/campus-passage.md) · [操作](./gameplay/vr-controls.md)。

## 下次从这里开始

1. **先查礼拜堂首次开物理的 12.631 秒。** 最新 Quest 报告仍是 11 月 19 日 `16-39-36-188Z`，早于 `1abb982` 的 `physicsRebuilds[].work`。本机先用同一原版 PMX、循环 VMD、真实 Bullet 对照首次开和再开，区分模块等待、后端创建和绑定；有新版真机 JSON 再决定改哪一段。计时已上线，不要重新埋点。[工程步骤及判断标准](./performance/README.md) · [用户最短操作](./performance/next-quest-export.md)
2. **再查持续播放，目标是稳定 72 FPS。** 礼拜堂阴影开，空手关／开物理为 61／34 FPS；开物理的原生步进中位数为 8.42 ms。先固定模型、动作、机位和物理开关，只切阴影。不得通过删关节、屏蔽有效碰撞或改变舞姿来追帧。[历次报告与条件](./performance/viewing-and-diagnostics.md#已有测量)
3. **三区和其他交互另验。** 教室旧两区回场实测 2.669 秒；草坪接泳池已发布，尚缺三区真机往返与长时间资源趋势。握柄、天空和手追可在自然游玩时看。暂停休眠还未实现；首触、回落和追踪恢复先验过再试。动作书签暂缓；本地音乐和新地图未排期。

## 已发布与证据

[发布里程碑](./release-history.md) · [建模与贴图](./scenery/README.md) · [桌面物理回归](./performance/xr-runtime-performance.md)

接手先看 `git status --short --branch`。用户模型仅在本机使用；不暂存 `sample/` 或 `.openchamber/`。功能验证通过后按[发布约定](./deployment.md)正常推送并核对主域名；只整理文档时推送文档即可。
