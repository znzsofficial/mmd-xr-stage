export const posePresets = [
  { id: 'supine', zh: '仰卧屈膝', en: 'Supine · knees bent' },
  { id: 'legsUp', zh: '仰卧抬腿', en: 'Supine · legs raised' },
  { id: 'allFours', zh: '四点跪撑', en: 'On all fours' },
  { id: 'straddle', zh: '骑乘跪坐', en: 'Kneeling straddle' },
  { id: 'side', zh: '侧卧屈腿', en: 'Side-lying curl' },
  { id: 'standingLean', zh: '站姿前倾', en: 'Standing lean' },
] as const;
export type PosePresetId = typeof posePresets[number]['id'];
