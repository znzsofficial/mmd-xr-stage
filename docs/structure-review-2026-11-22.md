# 角色工具收尾审查

审查从 `927f3f1` 开始。下面列出能复现的问题及对应的回归入口。页面文件与预设、观看会话缓存、活动房间实例的所有权见[舞台架构](./architecture.md)。

| 原问题 | 修复与验证 |
|---|---|
| 同一布景更换渲染器后旧运行时未释放；切景前的帧回调还能取走新演员的缩放命令。 | 渲染器／场景身份变化会重新挂载房间，从最近完整布局恢复；已退役的回调在读取全局命令前返回。[StrictMode、恢复和旧帧回归](../src/mmdVrShowcase/components/MmdVrStage.test.tsx) |
| 隐藏、换人或切换绘图模式时，迟到的 Worker 位图可能覆盖旧画布；冻结图像还会因另一人的状态或与当前图无关的更新重画。 | [绘图器](../src/mmdVrShowcase/pelvic/atlas/painter.ts)只订阅当前演员的绘图输入；Worker 回包等待下一次可见绘制，过期结果关闭。屏幕拖动和 XR 纹理归挂载实例持有。[跨演员／卸载测试](../src/mmdVrShowcase/pelvic/atlas/AtlasGraphic.test.tsx) · [慢回包与冻结](../src/mmdVrShowcase/pelvic/atlas/painter.test.ts) |
| 支架同帧停机再开时会续喷上一脉冲；脱离场景或无法验证的喷口还可能遗留待发请求。 | 当前场景、实体和输入代次必须一致。中断清掉尚未发出的部分和排队命令，卸载先结束自己拥有的绑定。[运行时回归](../src/mmdVrShowcase/pelvic/rig.test.ts) · [计量与隔离](../src/mmdVrShowcase/pelvic/store.test.ts) |
| 表情的多个名字指向同一 PMX 形态时，冻结帧可能被无动作的别名置零；重建物理后还可能重新打开已关闭的姿势工具或带回撤销的身体预览。 | 每个形态索引只冻结一次；待恢复的姿势、编辑状态和身体预览分别按演员核对。[动作求值](../src/mmdVrShowcase/pose/poseSolver.test.ts) · [编辑会话](../src/mmdVrShowcase/pose/poseSession.test.ts) · [身体状态回滚](../src/mmdVrShowcase/bodyState/room.test.ts) |

**实模对照：** 本机参考 PMX 有 505 根骨骼、6 个可用姿势控制点。无动作、无物理时旋转右腕再恢复，复用原求值器，505 根骨骼世界矩阵对照最大差为 0。此项只验证姿势恢复，不是衣物、图表性能或真机舒适度测量。

**产品复验：** 屏幕端扣住旧演员真实 Worker 位图，切到另一人后再交付；位图被关闭，新画布未出现旧人画面。模拟双眼 XR 在内 3.7 cm 单次计入 1/4，停机、重启、再停机仍为 1/4。601 项自动测试通过。[固定构建](https://6b1100a1.mmd-xr-stage.pages.dev)

**仍待真机：** 无 Worker 时会在主线程绘图。双眼光学可读性、控制点命中感和持续 72 FPS 都需按 [Quest 分趟短测](./performance/next-quest-export.md)验收。
