# 会话交接｜2026-11-20

[线上舞台](https://mmd-xr-stage.pages.dev) · [固定版 `daa1b8b`](https://5555be06.mmd-xr-stage.pages.dev) · [分类文档索引](./README.md)

**线上基线**：十景六件道具。[双喜堂](./scenery/wedding-court.md)、[草坪通门诊](./scenery/clinic-garden.md)、[秦淮琴案和系舟处](./scenery/qinhuai.md)与[单曲本地音乐](./gameplay/README.md#上手与验收)已上线。最新修复[卫生用品架侧面闪烁](./scenery/clinic-teaching.md#卫生用品架侧板修复)，以木纹、漆膜和接触暗部作近景材质样例。349 项测试与构建通过，主域名入口及 59 份文件 SHA-256 已核对。

## 下次从这里开始

**并行建模轮已完成。** 下次自然戴 Quest 时可看堂前双人全身、贴近轿帘后的双眼细纹，再沿门诊步道往返看头向与帧率；不用拷音乐。桌面和模拟 XR 不能代替头显结论。后备旧景为星环遗庭观星台，新景为海边终点站，均未排期。[原分工与候选](./scenery/next-modeling-round.md)

**并行工作不要覆盖的基线**：[Blender 本地角色包](./gameplay/blender-characters.md)已验源尺寸、组合表情、暂停拨衣和回场。用户优先与自选角色互动；恋活卡桥暂缓。11 月 20 日教室真机关／开物理 60／41 FPS，仍未稳定 72 FPS；首开模块预热、回场动作等待及[轻触手感](./performance/fingertip-indent.md)按[既有短测](./performance/next-quest-export.md)另验，不是开建喜院的前置条件。公开 README 保留四个 badge 和技术章节，只使用适合公开的示例与实景。

## 已发布与证据

[发布里程碑](./release-history.md) · [建模与贴图](./scenery/README.md) · [桌面物理回归](./performance/xr-runtime-performance.md)

接手先看 `git status --short --branch`。用户模型仅在本机使用；不暂存 `sample/` 或 `.openchamber/`。功能验证通过后按[发布约定](./deployment.md)正常推送并核对主域名；只整理文档时推送文档即可。
