# 会话交接｜2026-11-18

## 恢复时先看

本轮功能：**同页背包、空场进入、就地操作和重做的窗边教室**。从准备页导入后，戴上头显，在观看条选好环境，打开背包，再指向空地放置。射线选中角色可在旁边换动作、移动或收回；「更多」保留高级设置。每个布景只保存自己的轻量布局。详见[背包与续场](./asset-workflow.md)和[手柄操作](./vr-controls.md)。[主域名](https://mmd-xr-stage.pages.dev) · [上一版固定部署 `17da9b2`](https://36aab63c.mmd-xr-stage.pages.dev)。

背包流程用合成 PMX、GLB 和两秒 VMD 验证：模拟设备通过手柄扳机实际命中场景、地面和工具，完成两次 XR 会话；包括移动、转向、绑定动作、收回、跨场景恢复和退出后继续。用户此前已在 Quest 3S 确认输入可用；这不代表新菜单、教室和加载速度已通过头显验收。

用户主要导入自己的游戏角色观看，手柄操作菜单、手追体验衣物。**内置建模指环境**（天空、太阳、教室、泳池、草坪），不做展示人偶。HUD 沿用浅瓷与墨蓝，生产后端为 WebGL + WebXR。产品和实现约束分别见 [PRODUCT](../PRODUCT.md)、[AGENTS](../AGENTS.md)。

## 下一轮：先定位剩余加载卡顿

1. **分开比较空场进入、背包确认落点、切景恢复和同页继续。** 同一角色、贴图、VMD 与布景。旧版准备页首选预载的路径已由背包按需取出替代。不要把人看场景、挑角色、选位置的时间算成加载耗时。
2. **退出后先导出，再刷新。** 准备页底部点「导出上次 VR 性能记录（JSON）」。比较 `startup.firstVisibleXrFrameMs` 和 `placements[].confirmToReadyFrameMs`。结合实际 Hz、图层尺寸、帧间隔 P95、最慢帧、超过 1.5 个帧周期的比例及模型 CPU 做判断。字段详见[观看与诊断](./viewing-and-diagnostics.md)。
3. **按结果选择优化。** 首进仍有长帧。下一步可区分 PMX 解析、网格组装、贴图解码／上传与 shader 编译；只有对应阶段确实占主导时，再试 Worker、压缩贴图或分批处理。当前架构足以扩展环境，优先维护清晰的场景和资源所有权。

另外两组待验：用同一段动作比较简易地台和日景，首轮目标为实际 72 Hz、连续观看 15 分钟，看脸部、发丝、窗框和水面在双眼中是否清晰；再试白按钮／滑块上的双色准星，以及「暂停 → 指尖拨衣 → 手离开视野后返回 → 恢复播放」。用户暂时没法测时，可继续做本机加载剖析。**72 Hz 是目标，不是已测成绩。**

## 已完成，不要重新当作待办

| 版本 | 已发布内容 | 改动入口／证据 |
|---|---|---|
| `17da9b2` | 五种观看环境、旧 Live House 偏好迁移；物理续场按快照装载、分批上传与条件式 shader 预编译（当时的准备页首选预载已由背包替代） | `src/mmdVrShowcase/scenery/`、`prepareModelGpu.ts`；[资产流程](./asset-workflow.md) |
| `cc74058` | CCD IK 迭代只更新活跃链所需的世界矩阵；保留原约束、迭代次数和首次完整计算 | 原版逐值对照通过。本地指定模型＋合成 VMD 的模型 CPU 约 9.6 → 3.08–3.23 ms，不是 Quest 整机帧时；[测试条件](./xr-runtime-performance.md) |
| `160fca1`、`5566163` | 重获追踪时重叠碰撞体等待移出再启用；可导出性能记录；显示层降低裙摆静置细颤 | 指定模型本机 72 Hz／0.1× 对照中，裙摆顶点位移指标下降约 58%；保留快速拨动与求解器原始姿态 |
| `35bf752`、`e5d6530` | 增强贴图按最后选择提交，失败／卸载释放资源；暂停 VMD 后衣摆可交互；每手掌心盒＋五指胶囊 | `scripts/paused-cloth-smoke.html` 用生成的 PMX/VMD 和真实 Bullet 检查暂停、恢复、seek 与缩放 |
| `51931ba`、`24fb854` | 场景代码随准备页就绪，Canvas 仍按需挂载；手柄 profile 和手模型同源加载 | [XR 生命周期](./xr-session-lifecycle.md)、[输入资源](./vr-controls.md)、[旧标签页发布兼容](./deployment.md) |

## 维护入口

- 环境在准备页「观看环境」或 VR「画面」中选择。目录是 `src/mmdVrShowcase/scenery/catalog.ts`；布景不占用户 GLB 槽位。日景天空、主方向光和窗光共用方向；[VR 控制说明](./vr-controls.md)。
- 调试先 `git status --short --branch`。Node `26.12.1`、pnpm `11.20.0`，依赖用 `pnpm install --frozen-lockfile`。代码变更按 [AGENTS](../AGENTS.md) 验证；发布按[部署说明](./deployment.md)，保留旧标签页所需文件。`.openchamber/` 是本地证据，`sample/` 含测试材料，均不暂存；用户模型只在本机使用。
- `@react-three/xr` 调用 Zustand 4 旧比较接口的弃用提示仅见于开发模式；生产包没有这条提示，当前不按加载故障处理。
- 更早的调试经过可查 [整理前的交接快照](https://github.com/znzsofficial/mmd-xr-stage/blob/17da9b2/docs/HANDOFF.md)。[历史路线图](./mmd-vr-showcase-roadmap.md)供溯源；近期进度以上述发布与验收项为准。
