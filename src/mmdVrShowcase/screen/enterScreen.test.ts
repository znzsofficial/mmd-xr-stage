import { afterEach, expect, it } from 'vitest';
import { clearBackpack, syncBackpackFiles, useBackpack } from '../backpack';
import { getMmdVrSessionAssets } from '../mmdVrAssets';
import { useMmdVrStore } from '../mmdVrStore';
import type { StageSnapshot } from '../stageSnapshot';
import { enterScreen } from './enterScreen';

const get=useMmdVrStore.getState;
afterEach(()=>{get().closeOverlay();useMmdVrStore.setState(useMmdVrStore.getInitialState());clearBackpack();});

it('opens the selected room without replacing the last XR layout or promoting its actors into a different room',()=>{
  const pmx=new File(['test'],'actor.pmx');syncBackpackFiles([pmx]);
  const saved:StageSnapshot={scenery:'floor',time:12,physicsEnabled:false,controllerCollisions:true,playing:false,loop:true,models:[],objects:[],assets:[{kind:'model',modelFile:pmx,companionFiles:[pmx],bodyMotionFile:null}]};
  useBackpack.setState({layouts:{floor:saved}});useMmdVrStore.setState({savedStage:saved});get().setPrefs({scenery:'lawn'});
  enterScreen();expect(get()).toMatchObject({presentation:'screen',overlayOpen:true,phase:'idle',resumeStage:null});expect(getMmdVrSessionAssets()).toEqual([]);
  expect(useBackpack.getState().layouts.floor).toBe(saved);expect(useBackpack.getState().entries[0].file).toBe(pmx);
  get().closeOverlay();get().setPrefs({scenery:'floor'});enterScreen();expect(get().resumeStage).toBe(saved);expect(getMmdVrSessionAssets()[0]).toMatchObject({modelFile:pmx});
});

it('cannot take over an entering or active XR canvas or discard a pending placement',()=>{
  get().setPhase('entering');const epoch=get().entryEpoch;enterScreen();expect(get().entryEpoch).toBe(epoch);expect(get().overlayOpen).toBe(false);
  get().openOverlay();get().markEntered();useBackpack.setState({draft:'keep'});enterScreen();expect(get().presentation).toBe('xr');expect(useBackpack.getState().draft).toBe('keep');
});
