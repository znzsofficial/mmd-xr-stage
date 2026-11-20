# 会话交接｜2026-11-20

[线上舞台](https://mmd-xr-stage.pages.dev) · [固定版 `943379d`](https://d2e0bf42.mmd-xr-stage.pages.dev) · [分类文档索引](./README.md)

**线上基线**：九景六件道具，含[秦淮歌楼](./scenery/qinhuai.md)、[医院教学与用品](./scenery/clinic-teaching.md)、指腹浅压痕、物理模块预热与回场诊断。本地适配的 Blender 角色使用同一背包与碰撞路径。329 项测试、生产构建、模拟 XR 放置和回场、真实 Bullet 暂停拨衣、主域名入口及 51 份资源哈希通过；头显舒适度与新版真机性能另验。

## 下次从这里开始

**下一轮按[喜院、草坪通医院、秦淮近景与音乐计划](./scenery/next-modeling-round.md)派工，尚未开工。** 五组建模：喜院布局、建筑、婚俗陈设、草坪花径到医院南门的双向支路、秦淮琴案和系舟处。先用两位角色验喜堂尺度；各组按机位画原创贴图。Live House 不再安排精修。另派一组实现单曲本地音乐，屏幕与 VR 都能控制，Quest 无需准备文件。公共接入与发布归主代理。

**并行工作不要覆盖的基线**：[Blender 本地角色包](./gameplay/blender-characters.md)已验源尺寸、组合表情、暂停拨衣和回场。用户优先与自选角色互动；恋活卡桥暂缓。11 月 20 日教室真机关／开物理 60／41 FPS，仍未稳定 72 FPS；首开模块预热、回场动作等待及[轻触手感](./performance/fingertip-indent.md)按[既有短测](./performance/next-quest-export.md)另验，不是开建喜院的前置条件。公开 README 保留四个 badge 和技术章节，只使用适合公开的示例与实景。

## 已发布与证据

[发布里程碑](./release-history.md) · [建模与贴图](./scenery/README.md) · [桌面物理回归](./performance/xr-runtime-performance.md)

接手先看 `git status --short --branch`。用户模型仅在本机使用；不暂存 `sample/` 或 `.openchamber/`。功能验证通过后按[发布约定](./deployment.md)正常推送并核对主域名；只整理文档时推送文档即可。
