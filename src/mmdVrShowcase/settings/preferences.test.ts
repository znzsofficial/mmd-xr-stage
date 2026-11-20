import { expect, it, vi } from 'vitest';
import { MMD_VR_PREFS_KEY, MMD_VR_PREFS_LEGACY_KEY, prefsStorage } from './preferences';
import { useMmdVrStore } from '../mmdVrStore';

it('keeps migrated preferences across a partial stage edit and reload, leaving the legacy record intact', () => {
  const original = useMmdVrStore.getState();
  const legacy = JSON.stringify({ lightPreset:'rim', liveHouseEnabled:true, frameRatePref:'mid',
    stageRimLightEnabled:false, handTracking:false, showSceneryPeople:false, obsoleteFlag:true });
  const data = new Map([[MMD_VR_PREFS_LEGACY_KEY, legacy]]);
  vi.stubGlobal('localStorage', { getItem:(k:string)=>data.get(k) ?? null, setItem:(k:string,v:string)=>data.set(k,v) });
  try {
    const migrated = prefsStorage.read();
    expect(migrated).toMatchObject({scenery:'liveHouse',frameRatePref:'90',stageRimLightEnabled:false,stageLightPoolEnabled:true});
    useMmdVrStore.setState({prefs:migrated});
    expect(migrated.balancedModelColor).toBe(true);
    expect(migrated.normalEyeOffset).toBe(0);
    original.setPrefs({lightPreset:'stage', exposure:1.24, balancedModelColor:false,normalEyeOffset:.27});
    const persisted = prefsStorage.read();
    expect(persisted).toEqual({...migrated,lightPreset:'stage',exposure:1.2,balancedModelColor:false,normalEyeOffset:.3});
    expect(data.get(MMD_VR_PREFS_LEGACY_KEY)).toBe(legacy);
    expect(JSON.parse(data.get(MMD_VR_PREFS_KEY)!)).not.toHaveProperty('obsoleteFlag');
  } finally {
    useMmdVrStore.setState(original); vi.unstubAllGlobals();
  }
});
