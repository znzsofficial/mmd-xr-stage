# 会话交接｜2026-11-19

[线上舞台](https://mmd-xr-stage.pages.dev) · [固定功能版 `c4d068a`](https://f094afa5.mmd-xr-stage.pages.dev) · [分类文档索引](./README.md)

**当前状态**：七个布景、屏幕观看和 VR 均已上线。原计划四幕已完成：月面邮局 `4c50b7b`；纸鸢站、泡影渡口、返场染印社 `5b13356`。玩法入口和待测手感见[道具清单](./gameplay/README.md)。最近功能发布通过 275 项测试／65 个文件、生产构建、主域名 22 项资源哈希及线上模拟 XR 进出和导出。

## 下次从这里开始

1. **先做可回退的物理切换原型。** 礼拜堂单角色真机开启物理忙了 3.534 秒；屏幕复现时，开关都会重读贴图。从 [`rebuildAllModels`](../src/mmdVrShowcase/mmdRuntime/mmdRuntime.ts) 开始，尝试复用网格和材质。比较前后切换时间，同时测播放恢复、多模型、切景取消和失败回滚。[性能优先级与验收](./performance/README.md)
2. **有 `c4d068a` 或更新的 Quest 报告再分析持续播放。** 上一份礼拜堂记录物理关／开为 52／32 FPS，开物理后模型更新 16.91 ms，其中后端 9.85 ms。新字段 `bulletStepWork` 能分开看刚体输入、原生步进和输出。最新去重的收益已有桌面对照，尚待头显数据。[历次报告与口径](./performance/viewing-and-diagnostics.md#已有测量)
3. **下次戴头显顺手验交互。** 左右腕握姿、风筝线是否挡脸、收回／切景是否干净，以及暂停拨衣和追踪恢复。15 分钟持续观看另测，不必重复上次的短测。

## 已发布与证据

[发布里程碑](./release-history.md) · [建模与贴图](./scenery/README.md) · [桌面物理回归](./performance/xr-runtime-performance.md)

接手先看 `git status --short --branch`。用户模型仅在本机使用；不暂存 `sample/` 或 `.openchamber/`。功能验证通过后按[发布约定](./deployment.md)正常推送并核对主域名；只整理文档时推送文档即可。
