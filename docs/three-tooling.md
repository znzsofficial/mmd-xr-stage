# 除了行走，哪些东西适合用现成工具

正式版继续用 Three；XR 母星的胶囊由独立的 Rapier 世界驱动，[步进与控制输入同钟](./performance/home-walk.md)。早期对照实验使用 Ecctrl。下面的工具按具体需求考虑，不是下一轮的安装清单。

| 任务 | 已经在用 | 下一步值得试什么 |
|---|---|---|
| 角色动作、IK、衣物 | `three-mmd-loader` + Bullet。暂停姿态与物理时钟独立 | 保留已验证的手部碰撞、追踪恢复、缩放和局部轻压适配。Rapier 只管小星球玩家；通用布料与动画混合器不等于 PMX 关节和 VMD 求值。 |
| 布景摆位、门洞和机位 | 布局数据、实际屏幕与 XR 验收；鼠标浏览用 OrbitControls | [Three Editor](https://threejs.org/editor/) 或仅开发用的 [TransformControls](https://threejs.org/docs/#TransformControls) 粗摆，记录位置和旋转，再回舞台验正反向视线、实际门线和摆人落点。无需给玩家安装编辑器。 |
| GLB 加载和减重 | GLTFLoader；ZIP 已用 zip.js | 对自制 GLB 离线使用 [glTF Transform](https://gltf-transform.dev/cli) 的 `inspect`、`validate`、`dedup`、`prune`。先查大贴图和重复资源，有相应解码器再启用 Meshopt、Draco 或 KTX2。不改变用户导入的模型原件。 |
| 大型静态导入场景的射线与碰撞查询 | Three 射线、布景地面与遮挡；平地行走已有实测缓存 | [three-mesh-bvh](https://github.com/gkjohnson/three-mesh-bvh) 适合三角面很多的静态网格。先比较建树和更新耗时、射线命中、移除资源。它不负责角色布料或玩家重力。 |
| XR 输入、音乐和材质 | `@react-three/xr` 与本地手柄配置；浏览器 Audio 播单曲；Three 实例化绘制和色调映射 | 输入回归已用 IWER。暂不为一首歌增加音频框架。PMX 自定义材质的亮部在截断前修正，不靠全屏后期找回已剪白的细节。 |

## 什么时候再考虑迁移

[修正蒙皮更新后的桌面 A/B](../experiments/mmd-engine-ab/README.md)中，同一角色开物理的 CPU 更新时间，Babylon 比 Three 低约 44%–51%；[独立教室实验](../experiments/mmd-engine-ab/quest-classroom.md)也验证了暂停后用手柄托起衣摆、撤手回落。前者不是 Quest 双眼整帧收益，后者不含逐指手追、局部轻压或触觉反馈。

如果正式版真机报告表明角色更新是主要瓶颈，再用同一头显、同一角色和动作、相同画质及图层尺寸做双眼对照。只有 Babylon 持续减少慢帧，且角色外观、暂停拨衣和追踪恢复不退步，才重开迁移讨论。角色偏亮已有[同姿态修正对照](./scenery/model-highlight-color.md)，球面玩法也已在 Three 上实现。
