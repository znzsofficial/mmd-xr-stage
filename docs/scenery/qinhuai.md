# 秦淮歌楼 · 泊月楼

一座取意晚明秦淮水岸的虚构歌楼。木栈埠头临画舫，正门通堂前茶座；再向前三级登台，左边是妆镜，右边是琴案与琵琶。想从上方看演出，回到正门外，面朝舞台向左走，沿西侧长梯登二楼听曲廊。屏幕的「埠头望歌楼」「堂前茶席」「二楼听曲廊」「戏台琴案」「临水看画舫」对应同一处实景。

## 尺度与落点

- 主堂宽 11.4 米，演员可摆在中央、茶桌间、埠头木栈、戏台和楼廊。戏台高 0.42 米；楼廊高 2.72 米，16 级楼梯每级高 0.17 米、深 0.34 米。摇杆行走沿连续斜面抬升视点，手调身高是独立偏移，离景后不带走楼高。
- 戏台有封闭台基，楼廊下为封闭木壁。每个平面坐标只有一个实际可站立的高度。拾取另设两个有限的高处平面；背包与旧版落地操作都核查地形与遮挡，提交时按本景实际高度写入 PMX 或 GLB 的世界坐标；楼上摆位会随布局保存。楼梯用于行走，不是演员落位点。
- 画舫和对岸民居是借景，水面不接收落点。视线可以越过低桌和栏杆，不能穿过实体台基、楼板、正门侧屏和桌椅来放置。人体碰撞用留有鞋宽的足点判断，并不推测导入模型的裙摆或舞蹈扫掠范围。
- `qinhuai` 是独立 `SceneryId`。上下楼、进出厅堂不换景，不卸载演员或物理世界，所以不设置跨区门线。

## 制作与核查

[`songhouseLayout.ts`](../../src/mmdVrShowcase/scenery/qinhuai/songhouseLayout.ts) 管地面、墙、柱、梯段、机位与射线；[`songhouseGeometry.ts`](../../src/mmdVrShowcase/scenery/qinhuai/songhouseGeometry.ts) 共用这些坐标建模。屋面是收脊起翘的曲面，窗棂、木阶、茶具按实例批绘；舞台六扇屏借同一幅原创绢本山水，木匾、织锦同在一张[本地图集](../../src/mmdVrShowcase/scenery/qinhuai/songhouse-silk.webp)。[烘焙脚本](../../src/mmdVrShowcase/scenery/qinhuai/bakeSonghouse.py) 可从头生成图集。月色、水纹与灯影不用反射相机，也不为每盏灯建立光源。

专项回归：`pnpm exec vitest run src/mmdVrShowcase/scenery/qinhuai/songhouseLayout.test.ts src/mmdVrShowcase/components/MmdVrStage.test.tsx`。模拟 Quest 3 实走埠头、戏台和二楼：1.65 米原始眼高在戏台为 2.07 米、楼廊为 4.37 米；扳机隔栏指向楼下被拒，指楼廊成功，切景往返后 PMX 仍在 2.72 米。屏幕鼠标实放 PMX 到戏台、GLB 到二楼，水面被拒。五个空景机位的一帧 WebGL 记录为 9–10 次 draw、57,608–59,528 个三角形；不是 Quest 帧率。真机上楼舒适度、双眼细纹稳定度和开角色物理后的帧率仍待验证。
