# 会话交接｜2026-11-21

[线上舞台](https://mmd-xr-stage.pages.dev) · [固定版 `10af811`](https://8dcd90e9.mmd-xr-stage.pages.dev) · [分类文档索引](./README.md)

**十六景、九件道具。** [电玩厅出生点](./scenery/arcade-hall.md)支持上下层摆放，G／左 X 过洞，门前约 2 米宽的平台东西贯通，一楼双门墙与外沿齐平。[刑讯室](./scenery/medieval-chamber.md)沿用已修复的无面八角柜、石作与接缝；布景原有人物默认隐藏。莱布伦城街段仍是[独立研究](./scenery/strinova-map-study.md)。

## 下次从这里开始

**新路线真机短验：** 从[草坪](https://mmd-xr-stage.pages.dev/?set=lawn)的版画街走进电玩厅西廊，经外梯上二楼，从东廊下坡到泳池计时台，再沿东岸回草坪。[江南河街](./scenery/jiangnan-river-street.md)从喜轿旁上桥，桥顶摆一位角色，过门到秦淮埠头再回望。留意步道地面、日暮切换和回访等待；Quest 3S 帧率仍需实测。

**`37a0ef3` 真机报告已收到。** 星球空场两次进入，B 正常但不能行走或转向，21 个采样窗中位 117 FPS；当时未记录摇杆输入。教室单角色同一趟首访播放，关／开物理的窗口中位数 64／42 FPS；首次开启 949 ms 中 893 ms 等模块，泳池回教室 8.74 秒中 6.26 秒等超限身体动作。[下次短测](./performance/next-quest-export.md)：先在新页立即试星球两根摇杆，教室另测同一大动作回场和首次开物理。稳定 72 FPS 仍未获真机验证。

**正式版继续用 Three，Babylon 只保留实验。** 见[重新考虑迁移的条件](./three-tooling.md#什么时候再考虑迁移)。海边终点站、旧城皮影台、深夜唱片行按用户决定留待以后。

**继续开发的边界**：[舞台架构](./architecture.md)区分页面背包、观看会话和当前房间；玩家移动、资产放置和手部拨衣分别判断。用户优先与自选角色互动，[Blender 角色包](./gameplay/blender-characters.md)已走通，恋活卡暂缓。医院「场景人物」只切换[原有静态护士](./scenery/clinic-teaching.md)；喜院和教室的[首轮材质样板](./scenery/art-direction.md)已完成，其他美术候选未排期。公开 README 保留 badge 和技术章节，私有素材和真机原始 JSON 留在本机。

## 已发布与证据

[发布里程碑](./release-history.md) · [建模与贴图](./scenery/README.md) · [桌面物理回归](./performance/xr-runtime-performance.md)

接手先看 `git status --short --branch`。用户模型仅在本机使用；不暂存 `sample/` 或 `.openchamber/`。功能验证通过后按[发布约定](./deployment.md)正常推送并核对主域名；只整理文档时推送文档即可。
