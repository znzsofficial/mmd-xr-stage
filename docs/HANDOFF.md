# 会话交接｜2026-11-19

[线上舞台](https://mmd-xr-stage.pages.dev) · [固定功能版 `bc945d6`](https://99a48d30.mmd-xr-stage.pages.dev) · [分类文档索引](./README.md)

**当前状态**：七个布景和四幕玩法均已上线。`bc945d6` 取消了按布景只列三件玩具的限制；礼拜堂也能看全五件，借风线轴、丝带话筒排在前两行。入口见[道具清单](./gameplay/README.md)。276 项测试及生产构建通过；模拟手柄已在礼拜堂实际取还新道具并检查四个玩法切景入口。主域名 22 个资源哈希一致，线上屏幕模式可查看全部五件。

## 下次从这里开始

1. **先做可回退的物理切换原型。** 礼拜堂单角色真机开启物理忙了 3.534 秒；屏幕复现时，开关都会重读贴图。从 [`rebuildAllModels`](../src/mmdVrShowcase/mmdRuntime/mmdRuntime.ts) 开始，尝试复用网格和材质。比较前后切换时间，同时测播放恢复、多模型、切景取消和失败回滚。[性能优先级与验收](./performance/README.md)
2. **有 `c4d068a` 或更新的 Quest 报告再分析持续播放。** 上一份礼拜堂记录物理关／开为 52／32 FPS，开物理后模型更新 16.91 ms，其中后端 9.85 ms。新字段 `bulletStepWork` 能分开看刚体输入、原生步进和输出。最新去重的收益已有桌面对照，尚待头显数据。[历次报告与口径](./performance/viewing-and-diagnostics.md#已有测量)
3. **下次戴头显顺手验交互。** 左右腕握姿、风筝线是否挡脸、收回／切景是否干净，以及暂停拨衣和追踪恢复。15 分钟持续观看另测，不必重复上次的短测。

## 已发布与证据

[发布里程碑](./release-history.md) · [建模与贴图](./scenery/README.md) · [桌面物理回归](./performance/xr-runtime-performance.md)

接手先看 `git status --short --branch`。用户模型仅在本机使用；不暂存 `sample/` 或 `.openchamber/`。功能验证通过后按[发布约定](./deployment.md)正常推送并核对主域名；只整理文档时推送文档即可。
