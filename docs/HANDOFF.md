# 会话交接｜2026-11-19

[线上舞台](https://mmd-xr-stage.pages.dev) · [固定功能版 `8ce0811`](https://ddc046eb.mmd-xr-stage.pages.dev) · [分类文档索引](./README.md)

**当前状态**：窗边教室和晴空草坪可经后门连廊往返，只保留当前分区的渲染与物理实例。[路线与实景图](./scenery/README.md) · [桌面对照与跨区停顿](./performance/campus-passage.md)。284 项测试、生产构建、模拟 XR 摇杆往返与播放恢复、屏幕往返及主域名 44 项资源哈希通过。

## 下次从这里开始

校园试点已上线；桌面稳定播放未见明显回退，但切区仍有可见长帧。先看 Quest 教室播放及走廊首过，不急接入泳池。动作书签暂缓，目前无音乐播放。

1. **有新版报告时先看切换。** 礼拜堂旧版单角色真机开启物理忙了 3.534 秒。`02a62f4` 在桌面对照中每次少读三张大贴图，采样姿态一致；查看 `physicsRebuilds[].durationWallMs` 判断头显上的收益。[原地切换回归与桌面对照](./performance/physics-toggle.md)
2. **有 `c4d068a` 或更新的 Quest 报告再分析持续播放。** 上一份礼拜堂记录物理关／开为 52／32 FPS，开物理后模型更新 16.91 ms，其中后端 9.85 ms。新字段 `bulletStepWork` 能分开看刚体输入、原生步进和输出。最新去重的收益已有桌面对照，尚待头显数据。[历次报告与口径](./performance/viewing-and-diagnostics.md#已有测量)
3. **下次戴头显顺手验交互。** 左右腕握姿、风筝线是否挡脸、收回／切景是否干净，以及暂停拨衣和追踪恢复。15 分钟持续观看另测，不必重复上次的短测。

## 已发布与证据

[发布里程碑](./release-history.md) · [建模与贴图](./scenery/README.md) · [桌面物理回归](./performance/xr-runtime-performance.md)

接手先看 `git status --short --branch`。用户模型仅在本机使用；不暂存 `sample/` 或 `.openchamber/`。功能验证通过后按[发布约定](./deployment.md)正常推送并核对主域名；只整理文档时推送文档即可。
