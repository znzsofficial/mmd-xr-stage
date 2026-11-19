# 回场加载：复用静态 PNG 的透明度采样

同一原版角色回场，桌面六组配对全部消除了 **3 次、合计 48 MiB** 的整图像素读回。`load-textures` 中位数从 **188.9 降到 29.9 ms**。包含随后预上传和让步的 `addModel` 总耗时没有一致下降；尚无新版 Quest 回场结果。

## 为何选这里

[14:36Z Quest 记录](./viewing-and-diagnostics.md#已有测量)把首次放置的 3673 ms 定位到 `init-core`，回场模型任务 1839 ms 中有 729 ms 在 `load-textures`。首次 core 计时包含等待 WASM 就绪，不能单凭该值区分网络、编译或调度。本机同页后续 `init-core` 接近零；未改变空场进入或提前启动 core。

原 loader 已在单模型内合并图片读取，但新建角色时仍为每张图 `drawImage`、`getImageData`，再取得 UV 光栅化要用的 512×512 个 alpha 样本。现在将这份**按原坐标取值的采样数组**或「整图无透明像素」标记留在当前观看会话。每个模型仍按自己的材质三角形、UV、阈值判定透明模式。

- 以实际解析出的图片 `File` 身份和尺寸查找；最多 8 张、采样数组共 2 MiB，File 用弱引用。既不缓存最终材质模式，也不保存 RGBA、已解码图像、纹理、角色或物理世界。
- 仅默认图片 loader 读到的本地静态 PNG 可命中。首次采样后异步检查最多 4 KiB 的 PNG 头；APNG、改后缀的其他图片、不能在头部确认、缺图、读回失败均不跨模型命中。替换为同名图片也重新算。
- 缓存属于 `MmdVrStageContent`，切房重建模型，退出清空；已取消的加载不能回填写入。`clearAll()` 也会让进行中的新增角色失效，不影响并行新增。
- 验证释放时发现原默认 loader 创建的图片纹理没有被标为 `owned`，`disposeMmdModel({textures:'owned'})` 会跳过。现在默认纹理只在一次模型加载内去重并随模型释放；自定义图片 loader 的纹理仍由调用方负责。

## 桌面配对条件与结果

用 `pnpm dev` 打开 [scripts/room-load-probe.html](../../scripts/room-load-probe.html)，在本机选取同一 PMX 和配套图片，点 Measure。结果不含文件名、路径或素材。实测用 Chromium Headless 156.0.8078.4、SwiftShader/ANGLE、WebGL 256×256、AA 关、固定 DPR 1、单角色、物理关、无动作、无 XR 绘制。共用一个 renderer。先新建并释放一个 runtime 预热；随后每次都新建 scene、runtime 和模型，实际执行舞台 `prepareModelGpu`，测完立即释放。A 关闭跨房复用，B 命中；两者均使用修正后的纹理所有权。按 AB、BA 交错共六对，全部计入。

| 毫秒，除非另注 | A 中位数 | B 中位数 | 每对 A−B 的中位数 |
|---|---:|---:|---:|
| 解析 `parse-only` | 21.4 | 19.3 | 2.1 |
| 组网格 `create-mesh` | 58.5 | 51.8 | 4.7 |
| 贴图 `load-textures` | 188.9 | 29.9 | 148.3 |
| 其中 Canvas 绘图与整图读回同步调用 | 133.8 | 0 | 133.8 |
| 完整 loader | 280.1 | 108.6 | 159.9 |
| 5 张纹理 `initTexture` 同步调用合计 | 152.2 | 318.4 | −124.1 |
| 上传后让步合计 | 83.5 | 80.2 | 3.2 |
| `addModel` 总墙钟 | 501.3 | 510.4 | 56.7 |

贴图阶段六对 A/B（ms，按对列）：182.9/30.3、173.5/29.6、146.3/26.9、276.8/26.4、194.8/59.3、215.0/35.1。每次 A 读回 50,331,648 字节，B 为零；显式 `clear()` 后重新读回三张。RGBA 累计字节不是显存峰值。21 项材质的透明模式、透明开关、深度写入、alphaTest 和漫反射图尺寸签名相同，贴图告警为零。

**边界：**跳过 Canvas 不一定省掉解码。浏览器可以推迟解码/转换到第一次上传，本探针未隔离原生解码，`initTexture` 也不是纯 GPU 时间。B 的上传在部分轮次明显变慢，六对中只有四对总墙钟较短。两组总量中位数之差不等于配对差的中位数；不据此承诺总加载收益。下一份 Quest 导出应同时看回场的 `load-textures`、`initTextureCpuMs`、`yieldWallMs` 和 `entryToVisibleFrameMs`，首次放置另看 `init-core`。

## 回归

真实 WebGL 下每轮 5 张预上传纹理均触发所有者释放，`renderer.info.memory.textures` 回到 0；同一 loader 连续加载的两个模型也不共享漫反射 GPU 纹理。`materialAlphaTileParity.test.ts` 检查 UV 不同区域、改用同名文件、缺图补图、不可读重试与自定义 loader；`roomAlphaTiles.test.ts` 检查上限、动画/不确定头、取消和清空后的迟到回写；`mmdRuntimeLifecycle.test.ts` 验证退出及清空时晚到的模型、几何、求值器和物理世界不会复活。
