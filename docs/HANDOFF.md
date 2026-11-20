# 会话交接｜2026-11-20

[线上舞台](https://mmd-xr-stage.pages.dev) · [固定版 `b492753`](https://4226c7f3.mmd-xr-stage.pages.dev) · [分类文档索引](./README.md)

**线上基线**：十景六件道具。[喜院门楼](./scenery/wedding-materials.md)、[窗边课桌](./scenery/classroom-materials.md)和[诊室护士近景](./scenery/clinic-teaching.md)已上线。「工作台侧面」可近看重新建模的静态护士，「场景人物」只切这位原有人员。339 项测试、生产构建、屏幕和模拟 XR 通过；主域名入口及 62 份文件 SHA-256 已核对。

## 下次从这里开始

**下次自然戴 Quest 时**，沿门扇和窗边课桌横移半步，看漆面反光与细纹是否稳定；在医院「更多 → 环境」切一次护士。真机帧率与佩戴舒适度尚待实测。[其余场景材质方向](./scenery/art-direction.md) · [原建模分工与候选](./scenery/next-modeling-round.md)

**并行工作不要覆盖的基线**：[Blender 本地角色包](./gameplay/blender-characters.md)已验源尺寸、组合表情、暂停拨衣和回场。用户优先与自选角色互动；恋活卡桥暂缓。11 月 20 日教室真机关／开物理 60／41 FPS，仍未稳定 72 FPS；首开模块预热、回场动作等待及[轻触手感](./performance/fingertip-indent.md)按[既有短测](./performance/next-quest-export.md)另验，不是开建喜院的前置条件。公开 README 保留四个 badge 和技术章节，只使用适合公开的示例与实景。

## 已发布与证据

[发布里程碑](./release-history.md) · [建模与贴图](./scenery/README.md) · [桌面物理回归](./performance/xr-runtime-performance.md)

接手先看 `git status --short --branch`。用户模型仅在本机使用；不暂存 `sample/` 或 `.openchamber/`。功能验证通过后按[发布约定](./deployment.md)正常推送并核对主域名；只整理文档时推送文档即可。
