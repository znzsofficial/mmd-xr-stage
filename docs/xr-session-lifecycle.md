# XR 启动与退出生命周期

## 状态与职责

`src/xr/pendingSessionSlot.ts` 是浏览器 XRSession 的唯一所有者。每次进入都带单调递增的 generation，状态为：

`idle → requesting → created → bound → presenting`

- `requesting`：点击处理器同步调用 `navigator.xr.requestSession()`，保留用户激活；不等待资源下载或能力探测。
- `created`：浏览器返回 XRSession，注册会话结束监听。无需等 Canvas 挂载即可处理头显主动退出。
- `bound`：对应 renderer 的 `setSession()` 完成，且 `isPresenting` / `getSession()` 与请求一致。不是首帧成功的同义词。
- `presenting`：R3F `useFrame` 收到当前 renderer / session 的非空 XRFrame。表示渲染循环开始，不代表所有模型加载完成或 GPU 已成功提交；资产状态仍由 `assetLoad` 单独表示。

`requestImmersiveEnter()` 在场景模块和会话创建成功后等待 `presenting`，才返回 `entered`。UI 的 `phase=active` 只由这个完成路径设置。无模型、模型加载失败和 XR 绑定失败不再混为一个状态。

## 取消与超时

- `AbortController` 负责取消当前 UI 等待；session generation 负责拒绝旧异步结果。
- Canvas 比会话先准备好时，attach 通过状态订阅等待，不轮询。每个 renderer 的绑定队列串行执行；同一会话重复绑定已 presenting 的 renderer 不再次调用 `setSession()`。
- `setSession()` 前后都验证 generation、session 身份及取消状态。旧 renderer 卡住不会堵住新 renderer 的队列；旧任务不能绑定新会话或结束新进入。
- 场景代码随准备页静态导入，Canvas 仍只在进入后挂载。会话成功后绑定/首 XR 帧限时 20 秒。失败回到准备页；权限确认本身不设强制倒计时，用户可取消。
- watchdog 用于失败收尾，不作为正常加载进度的调度工具；后台或头显系统可能延后定时器回调，不能把它当实时期限。
- `end(generation)` 只处理对应代次，先撤销所有权再结束浏览器会话。`endOnce()` 防止多个退出来源重复调用同一个 session.end()。

## 资源所有权

- `useMmdVrEntryLifetime` 挂在 SceneEntry 上；真正卸载时结束它持有的 generation。微任务检查 effect replay，兼容 StrictMode。
- overlay 由 entryEpoch 设置 React key，旧组件清理不触及新进入。
- `<Canvas gl={{ ... }}>` 创建的 renderer 归 R3F 9.8.2 所有。Scene 不再手动 `gl.dispose()`，也不额外管理 GL ref。
- 应用模型/物理资源仍由 runtime 与 Stage 自身释放。不要把浏览器 session、renderer 和模型 runtime 的释放职责混在一起。

## 实测发现的冷启动缺陷

2026-11-17 使用 IWER 2.4.0 的 Meta Quest 3 模拟 runtime，在真实 R3F Canvas + React StrictMode 下首次进入：会话 `presenting`、资产队列完成，但模型数为 0。

原因：`MmdVrStage` 在 `useMemo` 计算函数内写 `runtimeRef.current`。StrictMode 重复调用计算函数后，React 保留的 memo 值与 ref 最后写入的另一个 handle 不一致。`createModelLoadTask` 的 `isStale()` 因此将真正加载成功的模型当作过期资源移除。

修复：useMemo 只返回 handle，在 `useLayoutEffect`（commit 阶段）同步 runtimeRef。新增 `MmdVrStage.test.tsx`，证明恢复旧代码时模型会被 remove，应用修复后模型保留且首帧求值。

这是可复现的开发模式缺陷，不能单独证明历史上 Quest 生产环境“第二次进入才正常”的全部原因。

## 验证

- 37 个文件、163 项测试；覆盖权限迟到、慢会话、StrictMode effect replay、串行去重绑定、取消中的 setSession、新旧会话交错、绑定未 presenting、替换 renderer 的首帧、头显提前结束、下载/首帧超时、加载中返回、异常边界与真正卸载。
- 使用现有传递依赖 IWER 2.4.0 构建临时开发页（不发布）：完整应用冷启动首次得到 `active / presenting / models=1 / failures=[]`，退出得到 `idle`，第二次进入同样成功。
- 模拟器覆盖浏览器/R3F/资源加载时序，不覆盖 Quest compositor、权限界面、真实手柄追踪或设备定时器行为。需要真机冷缓存首次进入、退出再进入、加载中取消，以及头显系统退出验证。
