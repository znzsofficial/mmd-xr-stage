# 秦淮歌楼 · 泊月楼

一座取意晚明秦淮水岸的虚构歌楼。木栈埠头临画舫，正门通堂前茶座；再向前三级登台，左边是妆镜，右边是琴案与琵琶。想从上方看演出，回到正门外，面朝舞台向左走，沿西侧长梯登二楼听曲廊。屏幕的「埠头望歌楼」「堂前茶席」「二楼听曲廊」「戏台琴案」「临水看画舫」对应同一处实景。

## 尺度与落点

- 主堂宽 11.4 米，演员可摆在中央、茶桌间、埠头木栈、戏台和楼廊。戏台高 0.42 米；楼廊高 2.72 米，16 级楼梯每级高 0.17 米、深 0.34 米。摇杆行走沿连续斜面抬升视点，手调身高是独立偏移，离景后不带走楼高。
- 戏台有封闭台基，楼廊下为封闭木壁。每个平面坐标只有一个实际可站立的高度。拾取另设两个有限的高处平面；背包与旧版落地操作都核查地形与遮挡，提交时按本景实际高度写入 PMX 或 GLB 的世界坐标；楼上摆位会随布局保存。楼梯用于行走，不是演员落位点。
- 画舫和对岸民居是借景，水面不接收落点。视线可以越过低桌和栏杆，不能穿过实体台基、楼板、正门侧屏和桌椅来放置。人体碰撞用留有鞋宽的足点判断，并不推测导入模型的裙摆或舞蹈扫掠范围。
- `qinhuai` 是独立 `SceneryId`。上下楼、进出厅堂不换景，不卸载演员或物理世界，所以不设置跨区门线。

## 制作与核查

[`songhouseLayout.ts`](../../src/mmdVrShowcase/scenery/qinhuai/songhouseLayout.ts) 管地面、墙、柱、梯段、机位与射线；[`songhouseGeometry.ts`](../../src/mmdVrShowcase/scenery/qinhuai/songhouseGeometry.ts) 共用这些坐标建模。屋面是收脊起翘的曲面，窗棂、木阶、茶具按实例批绘；舞台六扇屏借同一幅原创绢本山水，木匾、织锦同在一张[本地图集](../../src/mmdVrShowcase/scenery/qinhuai/songhouse-silk.webp)。[烘焙脚本](../../src/mmdVrShowcase/scenery/qinhuai/bakeSonghouse.py) 可从头生成图集。月色、水纹与灯影不用反射相机，也不为每盏灯建立光源。

### 琴案和系舟处：固定机位对照

| 机位（世界米，眼点 → 注视点） | 原版 | 新版 | 量尺验证 |
|---|---|---|---|
| 琴案 `(3.48,2.05,-5.70)` → `(4.03,1.41,-6.70)` | [方肩琴身、凸起的徽](../screenshots/qinhuai-detail-zither-before.webp) | [弧面、弦枕、螺钿徽与桌缘](../screenshots/qinhuai-detail-zither-after.webp) | [桌上 50 厘米水平尺](../screenshots/qinhuai-detail-zither-ruler.webp) |
| 埠头 `(4.38,0.91,13.03)` → `(3.65,0.19,11.99)` | [光杆和分离的绳圈](../screenshots/qinhuai-detail-mooring-before.webp) | [缆绳绕桩、石岸水痕](../screenshots/qinhuai-detail-mooring-after.webp) | [桩旁 50 厘米竖尺](../screenshots/qinhuai-detail-mooring-ruler.webp) |

琴身长 1.44 米，七弦在首尾弦枕折下；十三徽按有效弦长的泛音节点嵌入漆面，第七徽稍大。琴案保留 2.05 × 0.63 米占地，四角攒框、桌沿凹槽与下缘圆线有厚度。两条船缆从画舫前甲板系到栈桥临船的两个桩上；桩上留绳头与近三道缠绕，受力绳身略有垂度。缆绳约 3 厘米粗，弯处多分段，直处少分段。占地按缠绳后的 0.28 米核算，栈桥中路保持畅通。石岸保留实缝与倒角压顶；浅色旧水位线在现水面上方，潮湿带向下过渡为青苔。

漆纹、螺钿、谱页、木口年轮、麻股及三块驳岸石面是同一张[原创 WebP](../../src/mmdVrShowcase/scenery/qinhuai/songhouse-close.webp)，**1024 × 1024，107,538 字节**。用 [Python 烘焙源](../../src/mmdVrShowcase/scenery/qinhuai/bakeCloseDetails.py) 重画，烘焙与[近景网格](../../src/mmdVrShowcase/scenery/qinhuai/songhouseClose.ts)共用[图块坐标](../../src/mmdVrShowcase/scenery/qinhuai/closeAtlas.json)。烘焙时核查每块 10 像素的外延不重叠，运行时采用 mipmap 和 4 倍各向异性过滤。

### 实测预算与落点回归

- 两处均在产品屏幕 Canvas 拍摄，基线 `4358375`；Edge/ANGLE SwiftShader，1250 × 686 像素、DPR 1、FOV 50°、抗锯齿开、阴影关，同一灯光，无角色，无量尺。**两个机位均为 10 → 11 次绘制、59,528 → 62,210 个三角形（+4.5%）、10 → 11 份几何、2 → 3 份纹理**。每个已挂接着色器的 `COMPILE_STATUS` 都为真。从歌楼切至地台再回来三轮，每次歌楼均回到 11 份几何、3 份纹理。
- 横移 6.6 厘米，取 12 帧，在屏幕像素中重投影七弦及相邻弦隙：近景每帧的平均亮度差为 99.1–100.9（满量程 255），原「戏台琴案」导览机位为 9.3–10.9。近看能分辨弦与漆纹，退远后细节对比自然降低。桌面数据不推算 Quest 帧率或双眼稳定性。
- 模拟 Quest 3 摇杆从埠头登台、折返、登二楼：原始眼高 1.65 米，戏台 2.07 米、楼廊 4.37 米。右扳机隔栏指楼下被拒，楼上实放 PMX 于 `(-7.10,2.72,-2.72)`；附加身高 0.20 米后，下楼眼高为 1.85 米，切去地台再回访，PMX 仍在楼上。屏幕实点戏台使 PMX 落在 0.42 米，实点二楼使 GLB 落在 2.72 米，点水面仍保留放置草稿。
- 专项：`pnpm exec vitest run src/mmdVrShowcase/scenery/qinhuai/songhouseLayout.test.ts src/mmdVrShowcase/components/MmdVrStage.test.tsx`。覆盖登楼、隔栏遮挡及绕桩新增占地。真机上楼舒适度、双眼细纹稳定度和开启角色物理后的帧率仍待验证。
