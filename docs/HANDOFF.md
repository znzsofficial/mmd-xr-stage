# 会话交接｜2026-11-20

[线上舞台](https://mmd-xr-stage.pages.dev) · [固定版 `34beed9`](https://fcf6a56a.mmd-xr-stage.pages.dev) · [分类文档索引](./README.md)

**线上基线**：十景六件道具，VR 支持普通行走与自由飞行。`34beed9` 加入[屏幕键盘机位](./gameplay/screen-viewing.md)。350 项测试通过；主域名实测键盘移动、原地转头后滚轮双向缩放、鼠标拖动及切景复位，入口及 62 份文件哈希一致。

## 下次从这里开始

**可先处理的代码问题**：[结构审查第一项](./structure-review-2026-11-20.md)已用房间集成探针复现：由关切到开物理、重建尚未结束就退出，快照会把尚未生效的开关保存为开。其余四项是维护建议，不影响屏幕键盘机位的发布。

1. **下次自然戴 Quest 3S，先试移动手感。** 在教室按 B → 更多 → 玩家，普通模式试 A 跳跃和挡墙，自由模式试穿墙后切回；去草坪比较常速与疾行。模拟 XR 已验十景起跳、低顶、从台箱落地和跨区恢复；真机舒适度、细纹和帧率待反馈。[操作、已验证边界和最短真机路线](./gameplay/player-movement.md)
2. **若有新性能 JSON，再定位等待。** 11 月 20 日旧教室报告关／开物理为 60／41 FPS，不是当前移动版本的测量，也未证明稳定 72 FPS。按[性能短测](./performance/next-quest-export.md)看 `moduleAtFirstRequest` 和 `motionWork[]`，不要把行走试速当作稳态播放对照。

**继续开发的边界**：[舞台架构](./architecture.md)区分页面背包、观看会话和当前房间；玩家移动、资产放置和手部拨衣分别判断。用户优先与自选角色互动，[Blender 角色包](./gameplay/blender-characters.md)已走通，恋活卡暂缓。医院「场景人物」只切换[原有静态护士](./scenery/clinic-teaching.md)；喜院和教室的[首轮材质样板](./scenery/art-direction.md)已完成，其他美术候选未排期。公开 README 保留 badge 和技术章节，私有素材和真机原始 JSON 留在本机。

## 已发布与证据

[发布里程碑](./release-history.md) · [建模与贴图](./scenery/README.md) · [桌面物理回归](./performance/xr-runtime-performance.md)

接手先看 `git status --short --branch`。用户模型仅在本机使用；不暂存 `sample/` 或 `.openchamber/`。功能验证通过后按[发布约定](./deployment.md)正常推送并核对主域名；只整理文档时推送文档即可。
