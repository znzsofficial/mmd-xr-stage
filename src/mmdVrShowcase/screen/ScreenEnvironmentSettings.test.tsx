// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { useLanguageStore } from '../../languageStore';
import { useMmdVrStore } from '../mmdVrStore';
import { ScreenEnvironmentSettings } from './ScreenEnvironmentSettings';

it('keeps the shared lighting controls direct and the active room’s effects behind Visual details',async()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
  const state=useMmdVrStore.getState(),t=useLanguageStore.getState().t,host=document.createElement('div'),root=createRoot(host);
  try {
    state.setPrefs({scenery:'clinic',stageFogEnabled:false,gridPref:'auto',viewDistance:28});
    await act(()=>root.render(<ScreenEnvironmentSettings/>));
    const open=async(el:HTMLDetailsElement)=>{await act(()=>el.querySelector('summary')!.click());expect(el.open).toBe(true);};
    const main=host.querySelector('details')!,detail=main.querySelector('details')!;
    await open(main);expect(detail.open).toBe(false);
    const lighting=main.querySelector('select')!;
    await act(()=>{lighting.value='warm';lighting.dispatchEvent(new Event('change',{bubbles:true}));});
    expect(useMmdVrStore.getState().prefs).toMatchObject({lightPreset:'warm',stageFogEnabled:false});
    const checkbox=(name:string)=>[...main.querySelectorAll('label')].find(label=>label.textContent===name)?.querySelector('input');
    await act(()=>checkbox(t('sceneryPeople'))!.click());expect(useMmdVrStore.getState().prefs.showSceneryPeople).toBe(true);
    await open(detail);expect(detail.querySelector('summary')!.textContent).toBe(t('settingsVisualDetails'));
    await act(()=>checkbox(t('settingsMmdVrGrid'))!.click());expect(useMmdVrStore.getState().prefs.gridPref).toBe('on');
    await act(()=>state.setPrefs({scenery:'glassPlanet'}));
    expect(checkbox(t('sceneryPeople'))).toBeUndefined();expect(checkbox(t('settingsFog'))).toBeUndefined();
    expect(checkbox(t('settingsMmdVrGrid'))?.checked).toBe(true);expect(checkbox(t('settingsSky'))).toBeTruthy();
    const range=detail.querySelector<HTMLInputElement>('input[type=range]')!;
    expect([range.min,range.value]).toEqual(['70','70']);expect(useMmdVrStore.getState().prefs.viewDistance).toBe(28);
    await act(()=>state.setPrefs({scenery:'liveHouse'}));
    expect([range.min,range.value]).toEqual(['10','28']);expect(checkbox(t('settingsFog'))?.checked).toBe(false);
    expect(checkbox(t('settingsRimLight'))).toBeTruthy();expect(checkbox(t('settingsFloorGlow'))).toBeTruthy();
  } finally {await act(()=>root.unmount());useMmdVrStore.setState(state);vi.unstubAllGlobals();}
});
