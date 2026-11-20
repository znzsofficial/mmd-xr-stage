# 妇科医院：教具台、器械盘和卫生用品架

进入妇科医院后，屏幕的「游览机位」可直接选以下三处。XR 可从同一条候诊廊步行进入，过门不切换场景。

[三件解剖教具](../screenshots/clinic-models.webp) · [器械盘](../screenshots/clinic-instruments.webp) · [卫生用品架](../screenshots/clinic-supplies.webp) · [产后宣教图](../screenshots/clinic-postpartum.webp) · [护士工作台](../screenshots/clinic-nurse.webp)

- **解剖教具台（妇科诊室）**：从左至右是盆腔正中矢状剖面、子宫与附件正面剖面、胎儿与胎盘模型。左侧模型的前方在观察者左手边：蓝色膀胱在前，阴道上接宫颈，棕色直肠在后。中央可见宫腔、两侧输卵管及游离的伞端，第三件模型用脐带连接胎儿腹部和宫壁上的胎盘。每件对应一张墙图。护士坐在既有工作台前，不占背包角色名额。
- **妇产科器械盘（手术室）**：在推车近看四件静态器械：带窗叶片的产钳、双叶窥器、环形钳头的卵圆钳、带指环的手术剪。器械牌只列名称与英文对照。
- **卫生用品架（女卫生间）**：在有中文包装和图标的三格货架区分验孕试纸、卫生巾与一次性内裤。置物架旁和两个隔间内各有带盖脚踏桶。产后照护图贴在架旁，也挂在候诊宣教墙，区分可在随访时讨论的问题与需要立即就医的症状。

## 图文依据

模型为放大且简化的教学剖面；不同模型之间不按同一比例。模型、海报插画、包装和中文文案均为本项目创作，未使用患者照片、病历或机构原图。

- 美国国家癌症研究所，SEER Training Modules：[Genital Tract](https://training.seer.cancer.gov/anatomy/reproductive/female/tract.html)。核对阴道、膀胱与直肠的位置关系，以及子宫、输卵管及伞端的形态。
- Cleveland Clinic：[Placenta](https://my.clevelandclinic.org/health/body/22337-placenta)。核对胎盘附着于子宫壁，脐带连接胎儿与胎盘。
- 英国 NHS：[Your 6-week postnatal check](https://www.nhs.uk/baby/support-and-services/your-6-week-postnatal-check/)。用于产后随访讨论的身体恢复、情绪和喂养问题；海报不指定适用于所有地区的复查时间。
- 美国 CDC，Hear Her：[Urgent Maternal Warning Signs and Symptoms](https://www.cdc.gov/hearher/maternal-warning-signs/index.html)。海报选取胸痛、呼吸困难、大量出血（如一小时浸透一片或更多卫生巾）作为应立即就医的例子。

## 维护与核对

- [模型与器械几何](../../src/mmdVrShowcase/scenery/clinic/teachingSolids.ts)在进场时生成，各合并为一个静态顶点色网格。货架、包装、底座和护士复用房间已有实例批次。新增绘制共三批：模型、器械、印刷面；退出后释放几何和图集，不创建额外灯光、骨骼或物理世界。
- [烘焙脚本](../../scripts/bake-clinic-teaching.py)与渲染器共用 `teachingPrints.json` 的像素区域。运行 `python scripts/bake-clinic-teaching.py` 生成 1536 × 1024 的 `clinic-teaching.webp`（约 163 KiB）；需要 Pillow 和中文字体，`CLINIC_FONT`、`CLINIC_FONT_BOLD` 可指定字体文件。改变地面设备位置后，运行 `python src/mmdVrShowcase/scenery/clinic/bakeClinic.py` 刷新地面的接触阴影。
- `pnpm exec vitest run src/mmdVrShowcase/scenery/clinic` 检查房间连通、隔间边界、实际模型顶点是否落在声明的遮挡范围内，以及教具之间可穿过、实体背后不可穿过的放置线段。
- 桌面 WebGL 已从实际屏幕控件打开三个新机位，核对中文海报、包装与器械形状。使用真实鼠标按下／抬起瞄准货架占地和护士背后的空地，均没有确认放置；改向工作台旁无阻挡地面，同一件测试物品成功放置。未作 Quest 帧率和头显可读性测量。
## 卫生用品架侧板修复

[同机位斜视对照：左旧右新](../screenshots/clinic-casework-side.webp)。旧柜层板和背板与侧板同宽，侧面的大片三角形处于同一深度。现在层板和背板装在侧板之间并留 2 毫米装配缝，外侧只剩一层表面。[独立柜体网格](../../src/mmdVrShowcase/scenery/clinic/SupplyCasework.tsx)使用 2.5 毫米倒角；[离线烘焙](../../src/mmdVrShowcase/scenery/clinic/bakeCasework.py)分别描述木面纹理、封边和漆膜的颜色、切线空间法线与粗糙度。背板在层板接缝处带柔和的接触暗部，关实时阴影也能看出进深。

桌面实际 WebGL 对两侧各摆动镜头 11 帧，每帧重投影 54 个侧板接缝采样位置。修复前有 551／1,188 个像素采到棕色层板，修复后为 0；侧视机位绘制调用从 20 到 21。此项不等于 Quest 真机帧率测试。
