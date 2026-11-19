# 会话交接｜2026-11-19

[线上舞台](https://mmd-xr-stage.pages.dev) · [固定功能版 `051318c`](https://a095b46a.mmd-xr-stage.pages.dev) · [分类文档索引](./README.md)

**当前状态**：准备页新增默认关闭的「角色手掌托裙摆」。合成 VMD 的真实 Bullet 托起与放开、指定本地模型开关对照、287 项测试、生产构建、屏幕设置与模拟 XR、主域名 44 项资源哈希通过。[操作](./gameplay/vr-controls.md#性能与诊断) · [对照条件](./performance/xr-runtime-performance.md)。

## 下次从这里开始

校园真机报告已到。暂不接入泳池；动作书签暂缓，目前无音乐播放。

1. **单独计回教室恢复。** 开关物理忙段 540／441／67 ms，均成功；回教室的两个采样窗相隔 8.472 秒，无法分解角色、纹理和首帧等待。应补进区到角色就绪的直接计时。
2. **持续播放看原生求解。** 教室单角色开物理 49 FPS，模型更新 9.66 ms，原生 step 5.30 ms。优先评估接触与约束，不牺牲拨衣精度。新选项需真实手经过裙摆的动作复核；无需重跑整趟连廊。[历次报告与口径](./performance/viewing-and-diagnostics.md#已有测量)
3. **下次戴头显顺手验交互。** 左右腕握姿、风筝线是否挡脸、收回／切景是否干净，以及暂停拨衣和追踪恢复。15 分钟持续观看另测，不必重复上次的短测。

## 已发布与证据

[发布里程碑](./release-history.md) · [建模与贴图](./scenery/README.md) · [桌面物理回归](./performance/xr-runtime-performance.md)

接手先看 `git status --short --branch`。用户模型仅在本机使用；不暂存 `sample/` 或 `.openchamber/`。功能验证通过后按[发布约定](./deployment.md)正常推送并核对主域名；只整理文档时推送文档即可。
