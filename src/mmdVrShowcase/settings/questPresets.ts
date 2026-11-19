import type {MmdVrPrefs} from '../mmdVrStore';

const common={dprPref:'auto',antialiasPref:'auto',shadowsPref:'off',advancedRenderOverrides:true} as const;
export const questPresets={
  safe:{...common,renderQuality:'low',frameRatePref:'72',framebufferScalePref:'0.7',foveationPref:'high'},
  balanced:{...common,renderQuality:'balanced',frameRatePref:'90',framebufferScalePref:'0.85',foveationPref:'medium'},
  clarity:{...common,renderQuality:'high',frameRatePref:'90',framebufferScalePref:'1',foveationPref:'medium'},
} as const satisfies Record<string,Partial<MmdVrPrefs>>;
export function currentQuestPreset(prefs:MmdVrPrefs){
  return (Object.keys(questPresets) as (keyof typeof questPresets)[]).find(id=>
    Object.entries(questPresets[id]).every(([k,v])=>prefs[k as keyof MmdVrPrefs]===v))??'custom';
}
