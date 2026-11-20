# 会话交接｜2026-11-20

[线上舞台](https://mmd-xr-stage.pages.dev) · [固定版 `b7273ba`](https://b9e62e8a.mmd-xr-stage.pages.dev) · [分类文档索引](./README.md)

**线上基线**：十二景八件道具。教室、泳池、门诊的[三条路线](./scenery/campus-garden-routes.md)已重新选址；新增[情侣套房与双人私汤](./scenery/private-retreats.md)以及[两件可交接的道具](./gameplay/README.md)。[结构审查五项](./structure-review-2026-11-20.md)已全部落实。372 项测试通过；主域名入口及 70 份文件哈希一致，模拟 Quest 两景换区、拿和收道具，屏幕键盘、滚轮、拖动和复位均通过。

## 下次从这里开始

1. **下一份 Quest 3S JSON 优先。** 新页教室放同一角色、绑同一动作，阴影关，空手同机位先关后开物理；再关，去泳池、回教室，正常退出后导出。[短测和字段](./performance/next-quest-export.md)。桌面已走通这趟，不能把旧版 60／41 FPS 当成本版成绩。
2. **另外游玩时看路线与手感**：普通模式试三个门的反向视线，疾行、低顶、拨衣、细纹和双人远端站位仍要真机判断。[行走碰撞配对](./performance/player-collision-work.md)的 1789 点输出一致；[PMX 骨骼遍历候选](./performance/pmx-root-propagation.md)未测出可靠的整模提速，没有采用。

**继续开发的边界**：[舞台架构](./architecture.md)区分页面背包、观看会话和当前房间；玩家移动、资产放置和手部拨衣分别判断。用户优先与自选角色互动，[Blender 角色包](./gameplay/blender-characters.md)已走通，恋活卡暂缓。医院「场景人物」只切换[原有静态护士](./scenery/clinic-teaching.md)；喜院和教室的[首轮材质样板](./scenery/art-direction.md)已完成，其他美术候选未排期。公开 README 保留 badge 和技术章节，私有素材和真机原始 JSON 留在本机。

## 已发布与证据

[发布里程碑](./release-history.md) · [建模与贴图](./scenery/README.md) · [桌面物理回归](./performance/xr-runtime-performance.md)

接手先看 `git status --short --branch`。用户模型仅在本机使用；不暂存 `sample/` 或 `.openchamber/`。功能验证通过后按[发布约定](./deployment.md)正常推送并核对主域名；只整理文档时推送文档即可。
