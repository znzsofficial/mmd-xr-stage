# 会话交接｜2026-11-19

[线上舞台](https://mmd-xr-stage.pages.dev) · [固定功能版 `02a62f4`](https://29e30021.mmd-xr-stage.pages.dev) · [分类文档索引](./README.md)

**当前状态**：物理切换已复用渲染资源，280 项测试、生产构建、主域名 37 项资源哈希及线上模拟 XR 进出和导出通过。七个布景都能看全[五件道具](./gameplay/README.md)，线轴、话筒在前两行。

## 下次从这里开始

1. **有新版报告时先看切换。** 礼拜堂旧版单角色真机开启物理忙了 3.534 秒。`02a62f4` 在桌面对照中每次少读三张大贴图，采样姿态一致；查看 `physicsRebuilds[].durationWallMs` 判断头显上的收益。[原地切换回归与桌面对照](./performance/physics-toggle.md)
2. **有 `c4d068a` 或更新的 Quest 报告再分析持续播放。** 上一份礼拜堂记录物理关／开为 52／32 FPS，开物理后模型更新 16.91 ms，其中后端 9.85 ms。新字段 `bulletStepWork` 能分开看刚体输入、原生步进和输出。最新去重的收益已有桌面对照，尚待头显数据。[历次报告与口径](./performance/viewing-and-diagnostics.md#已有测量)
3. **下次戴头显顺手验交互。** 左右腕握姿、风筝线是否挡脸、收回／切景是否干净，以及暂停拨衣和追踪恢复。15 分钟持续观看另测，不必重复上次的短测。

## 已发布与证据

[发布里程碑](./release-history.md) · [建模与贴图](./scenery/README.md) · [桌面物理回归](./performance/xr-runtime-performance.md)

接手先看 `git status --short --branch`。用户模型仅在本机使用；不暂存 `sample/` 或 `.openchamber/`。功能验证通过后按[发布约定](./deployment.md)正常推送并核对主域名；只整理文档时推送文档即可。
