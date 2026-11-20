import {expect,it} from 'vitest';
import {normalizeMmdVrPrefs} from './preferences';
import {getMmdVrRenderProfile} from '../mmdVrQuality';
import {currentQuestPreset,questPresets} from './questPresets';

it('keeps locomotion independent of the selected device preset and recognises deliberate overrides',()=>{
  for(const id of ['safe','balanced','clarity'] as const){
    const prefs=normalizeMmdVrPrefs({...questPresets[id],walkSpeedPref:'auto'});
    expect(currentQuestPreset(prefs)).toBe(id);
    expect(getMmdVrRenderProfile(prefs).walkSpeed).toBe(2.4);
    expect(currentQuestPreset({...prefs,advancedRenderOverrides:false})).toBe('custom');
    expect(currentQuestPreset({...prefs,antialiasPref:'on'})).toBe('custom');
  }
});
