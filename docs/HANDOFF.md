# 会话交接｜2026-11-20

[线上舞台](https://mmd-xr-stage.pages.dev) · [固定版 `37a0ef3`](https://561c3380.mmd-xr-stage.pages.dev) · [分类文档索引](./README.md)

**线上基线**：十三景八件道具。新[琉璃小行星](./scenery/opal-planet.md)使用 Ecctrl/Rapier 球面行走；[MMD 角色色彩](./scenery/model-highlight-color.md)默认保留亮部，场内可切回原版。374 项测试通过；主域名入口及 72 份文件哈希一致。在主域名已模拟双眼 XR 走到球背、起跳、召回并点菜单、自由升降和返回水平教室。

## 下次从这里开始

**下次优先拿一份 `37a0ef3` 的 Quest 3S 教室 JSON。** 按[真机短测](./performance/next-quest-export.md)做关／开物理各 20 秒、暂停拨衣、恢复播放关物理、泳池往返回教室，再退出导出。小行星舒适度留到下载后另测。收到报告后按短测页末尾的字段分开读；旧版 60／41 FPS 不是本版成绩。

**引擎决定：Three 继续做正式版，Babylon 只保留实验。** Ecctrl/Rapier 已用于星球玩家，MMD 衣物仍由 Bullet 驱动。桌面 A/B 和暂停拨衣不必重跑；何时值得重开迁移见[选型结论](./three-tooling.md#什么时候再考虑迁移)。

**继续开发的边界**：[舞台架构](./architecture.md)区分页面背包、观看会话和当前房间；玩家移动、资产放置和手部拨衣分别判断。用户优先与自选角色互动，[Blender 角色包](./gameplay/blender-characters.md)已走通，恋活卡暂缓。医院「场景人物」只切换[原有静态护士](./scenery/clinic-teaching.md)；喜院和教室的[首轮材质样板](./scenery/art-direction.md)已完成，其他美术候选未排期。公开 README 保留 badge 和技术章节，私有素材和真机原始 JSON 留在本机。

## 已发布与证据

[发布里程碑](./release-history.md) · [建模与贴图](./scenery/README.md) · [桌面物理回归](./performance/xr-runtime-performance.md)

接手先看 `git status --short --branch`。用户模型仅在本机使用；不暂存 `sample/` 或 `.openchamber/`。功能验证通过后按[发布约定](./deployment.md)正常推送并核对主域名；只整理文档时推送文档即可。
