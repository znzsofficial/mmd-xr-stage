# 会话交接｜2026-11-20

[线上舞台](https://mmd-xr-stage.pages.dev) · [上一固定版 `1abb982`](https://e30a429d.mmd-xr-stage.pages.dev) · [分类文档索引](./README.md)

**本轮功能**：九景六件道具。新增可上二楼的[秦淮歌楼](./scenery/qinhuai.md)、[医院教学与用品](./scenery/clinic-teaching.md)、指腹浅压痕、放置后物理模块预热和回场动作分段。327 项测试、生产构建、双语屏幕导览、模拟 XR 上楼放置和回场、真实 Bullet 暂停拨衣通过；头显舒适度与新版真机性能另验。

## 下次从这里开始

1. **下份报告先查放置后预热和回教室的动作任务。** 11 月 20 日 `03-17-01-777Z` 真机教室首开 1493 ms 中有 1434 ms 等模块；泳池→教室 8815 ms 中身体动作任务占 6207 ms。预热不创建世界，来不及预热就按需加载；回场另记缓存命中和绑定耗时。[工程证据](./performance/physics-warm-start.md) · [用户最短操作](./performance/next-quest-export.md)
2. **手追轻触先看实机手感。** 暂停，食指轻按胸前并横移，再移开，比较两处的凹陷与回弹；粗网格保留原有响应。没有第二个开关。[局部形变验证](./performance/fingertip-indent.md)。本次教室空手稳定播放关／开物理 60／41 FPS，开物理原生步进 6.96 ms；仍未稳定 72 FPS，不用预热时间推算逐帧收益。[历次报告与条件](./performance/viewing-and-diagnostics.md#已有测量)
3. **优先直接与自选角色互动，舞蹈次之。** 用户关注不同体型的角色、姿势配合和手部接触。恋活卡本地转换桥仍是讨论中的后续路线，没有读卡或配对姿势功能。三区长期资源趋势、暂停休眠和多人同时触碰的帧耗仍待验。

## 已发布与证据

[发布里程碑](./release-history.md) · [建模与贴图](./scenery/README.md) · [桌面物理回归](./performance/xr-runtime-performance.md)

接手先看 `git status --short --branch`。用户模型仅在本机使用；不暂存 `sample/` 或 `.openchamber/`。功能验证通过后按[发布约定](./deployment.md)正常推送并核对主域名；只整理文档时推送文档即可。
