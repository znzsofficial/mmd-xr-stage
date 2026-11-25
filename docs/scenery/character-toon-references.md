# 普通 PMX 的角色卡渲参考：先看《卡拉彼丘》

优先借鉴脸、头发和衣料对**同一盏主光**的不同反应：脸颊有连贯的明暗边界，发束保留成片的亮带，浅色衣褶在亮面仍可读。单纯拉高对比度会一起压黑眼线和衣纹。

## 从作者资料看什么

| 一手来源（均为社区作者） | 可核对的材质，以及值得借的原则 |
| --- | --- |
| **卡拉彼丘**：[LSCherry 框架](https://github.com/lvoxx/LSCherry/tree/f870dbe7d42b4ff008c2775ec508285bfd4f4ae0) · [配套 LSPotato 的 Strinova 节点](https://github.com/lvoxx/LSPotato/tree/6e5ac0e52c910525994bfc31f7784fea667f8950/src/nodes/shader/lscherry/starters/strinova)；Blender，两个仓库均标 GPL v3。 | 看 `face_textures_resolver`：脸底色 `Face_D` 与控制明暗分界的 `SDF` 分开，转灯应移动脸影，不能带走画在底色里的五官。再对照 `hair`、`body` 的纹理解析节点：两者各有底色、法线、两张遮罩与 MatCap，头发还单列 `Highlight Mask`。可借的是限制亮带出现的位置；不必把皮肤和整件衣服一起打亮。 |
| **星穹铁道**：[StarRailNPRShader](https://github.com/stalomeow/StarRailNPRShader) · [作者的材质说明](https://github.com/stalomeow/StarRailNPRShaderDocs/blob/main/docs/zh/character/material.md)；Unity URP，着色器仓库标 GPL v3。 | 作者将 Face、EyeShadow、Hair、Body 分开；脸材质示例分别接主纹理、`FaceMap` 和表情图。文档专列 MMD 模式并指出模型会缺少细节数据。可借的是把眼周绘制与方向性脸影分开：转灯时应看得见眼神，不必模拟缺失的表情图。 |

这些资料描述社区作者的仿制方案；游戏原始资产的授权另行处理。此处只引用材质设计原则。

## 没有专用贴图时

- **脸：**有作者指定、UV 匹配的脸影图才启用 SDF。只有普通底色时，保留眉眼与腮红；对已识别的脸材质减弱法线产生的碎阴影，让脸颊柔和分档。脸与衣服共用材质又无分区时，沿用原 toon，不按肤色猜遮罩。
- **发与衣：**保留 PMX 自带的 toon 渐变、球面贴图及原混合方式。没有发光带遮罩就沿用发纹，不额外叠白；衣料靠原渐变读出褶皱，不用全局曝光制造分层。

**同姿转灯参考（建议对照，非实测）：**用同一件本地 PMX，冻结同一已求值姿势，取同时看得见双颊、刘海和衣领的正面半身。固定机位、环境光、曝光及主光强度，仅将主光以同一仰角从角色左前 60° 经正前转到右前 60°。三个角度各并排比原 toon 与候选：两侧受光时脸影是否换边、眼线是否始终清楚、发亮带是否局限在发束、白衣亮侧能否分出衣褶。只比较角色同一部位，不用全画面平均亮度代替观察。
