import {expect,it} from 'vitest';
import {useMmdVrStore} from '../mmdVrStore';
import {clearBackpack, syncBackpackFiles, useBackpack} from '../backpack/store';
import {walkBetweenZones} from './campusTransit';
import {roomLinks} from './connections';

it('keeps the translated view through the clinic door, but resets it on a menu jump',()=>{
  const stage=useMmdVrStore.getState,entry=roomLinks.find(l=>l.from==='lawn'&&l.to==='clinic')!,exit=roomLinks.find(l=>l.from==='clinic'&&l.to==='seasideTerminus')!;
  const original=stage().prefs.scenery;
  try{
    stage().openOverlay();stage().setPrefs({scenery:'lawn'});const epoch=stage().viewEpoch;
    syncBackpackFiles([new File([], 'actor.pmx')]);
    const bag=useBackpack.getState();bag.beginPlace(bag.entries[0].id);
    expect(walkBetweenZones(entry)).toBe(false);expect(stage().prefs.scenery).toBe('lawn');bag.cancelPlace();
    expect(walkBetweenZones(entry)).toBe(true);expect(stage().prefs.scenery).toBe('clinic');expect(stage().viewEpoch).toBe(epoch);
    expect(walkBetweenZones(exit)).toBe(true);expect(stage().prefs.scenery).toBe('seasideTerminus');expect(stage().viewEpoch).toBe(epoch);
    stage().setPrefs({scenery:'clinic'});expect(stage().viewEpoch).toBe(epoch+1);
  }finally{stage().closeOverlay();stage().setPrefs({scenery:original});clearBackpack();}
});
