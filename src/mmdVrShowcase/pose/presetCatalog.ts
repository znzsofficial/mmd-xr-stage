const basic = [
  { id: 'supine', zh: '仰卧屈膝', en: 'Supine · knees bent' },
  { id: 'legsUp', zh: '仰卧抬腿', en: 'Supine · legs raised' },
  { id: 'allFours', zh: '四点跪撑', en: 'On all fours' },
  { id: 'straddle', zh: '骑乘跪坐', en: 'Kneeling straddle' },
  { id: 'side', zh: '侧卧屈腿', en: 'Side-lying curl' },
  { id: 'standingLean', zh: '站姿前倾', en: 'Standing lean' },
] as const;
const teasing = [
  { id: 'thighCradle', zh: '仰卧分膝捧腿', en: 'Supine thigh hold' },
  { id: 'forearmKneel', zh: '跪趴翘臀', en: 'Hips-up kneel' },
  { id: 'sideLegLift', zh: '侧卧撩腿', en: 'Side leg lift' },
  { id: 'coveredKneel', zh: '跪坐掩胸', en: 'Kneeling chest cover' },
] as const;
export const presetGroups = { basic, teasing } as const;
export const posePresets = [...basic, ...teasing] as const;
export type PosePresetId = typeof posePresets[number]['id'];
