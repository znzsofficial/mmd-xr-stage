import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearBackpack, syncBackpackFiles, useBackpack } from './store';
import { useMmdVrStore } from '../mmdVrStore';
import type { StageSnapshot } from '../stage/stageSnapshot';
import {beginMmdVrAssetSession,endMmdVrAssetSession} from './sessionAssets';

const initial = useMmdVrStore.getState();
afterEach(() => { endMmdVrAssetSession();useMmdVrStore.setState(initial); clearBackpack(); });

describe('backpack session boundary', () => {
  const room: StageSnapshot = { scenery:'classroom',assets:[],models:[],objects:[],time:0,playing:false,loop:true,physicsEnabled:false,controllerCollisions:true };
  it('preserves an incompatible saved destination but allows walking across supported rooms',()=>{
    initial.setPrefs({scenery:'floor'});beginMmdVrAssetSession([],'webgpu');initial.openOverlay();
    const saved:StageSnapshot={...room,assets:Array.from({length:4},(_,i)=>({kind:'object',objectFile:new File([],`chair${i}.glb`),companionFiles:[]}))};
    useBackpack.setState({layouts:{classroom:saved}});initial.setPrefs({scenery:'classroom'});
    expect(useMmdVrStore.getState().prefs.scenery).toBe('floor');expect(useBackpack.getState().layouts.classroom).toBe(saved);
    useBackpack.setState({layouts:{classroom:room}});initial.setPrefs({scenery:'classroom'});expect(useMmdVrStore.getState().prefs.scenery).toBe('classroom');
    initial.setPrefs({scenery:'lawn'},{preserveViewOnCrossing:true});expect(useMmdVrStore.getState().prefs.scenery).toBe('lawn');
  });
  it('allows characters and objects alongside a hidden actor and retains their files on exit',()=>{
    syncBackpackFiles(['one.pmx','two.pmx','lamp.glb'].map(name=>new File([],name)));
    const bag=useBackpack.getState(), [one,two,prop]=bag.entries;
    initial.setPrefs({scenery:'floor'});beginMmdVrAssetSession([],'webgpu');initial.openOverlay();
    bag.beginPlace(two.id);expect(useBackpack.getState().draft).toBe(two.id);bag.cancelPlace();
    bag.publishLive({[two.id]:{position:[0,0,0],visible:false,runtimeId:'live:2'}});
    bag.beginPlace(one.id);expect(useBackpack.getState().draft).toBe(one.id);bag.cancelPlace();
    bag.beginPlace(prop.id);expect(useBackpack.getState().draft).toBe(prop.id);bag.cancelPlace();
    initial.setPrefs({scenery:'pool'});expect(useMmdVrStore.getState().prefs.scenery).toBe('pool');
    initial.closeOverlay();bag.beginPlace(prop.id);expect(useBackpack.getState().draft).toBe(prop.id);
    initial.setPrefs({scenery:'pool'});expect(useMmdVrStore.getState().prefs.scenery).toBe('pool');
  });
  it('captures before discarding a draft; Continue uses the captured room, not a later prep selection', () => {
    syncBackpackFiles([new File([], 'prop.glb')]);
    const b = useBackpack.getState(), id = b.entries[0].id;
    initial.openOverlay(); b.beginPlace(id);
    const capture = vi.fn(() => { expect(useBackpack.getState().draft).toBe(id); return room; });
    initial.setStageCapture(capture); initial.closeOverlay();
    expect(capture).toHaveBeenCalledOnce(); expect(useBackpack.getState().draft).toBeNull();
    initial.setPrefs({scenery:'pool'}); initial.prepareStage(true);
    expect(useMmdVrStore.getState().prefs.scenery).toBe('classroom');
    expect(useBackpack.getState().entries[0].id).toBe(id);
  });
  it('does not overwrite the last committed room with an in-flight drop or accept its late completion', () => {
    initial.setPrefs({scenery:'classroom'}); initial.openOverlay();
    useBackpack.setState({ layouts:{classroom:room} });
    syncBackpackFiles([new File([], 'large.pmx')]); const b=useBackpack.getState(), id=b.entries[0].id;
    b.beginPlace(id); b.confirmPlace(id,0,-1,0); const pending=useBackpack.getState().command!;
    const capture=vi.fn(); initial.setStageCapture(capture); initial.closeOverlay();
    expect(capture).not.toHaveBeenCalled(); expect(useMmdVrStore.getState().savedStage).toBe(room);
    b.finishCommand(pending); expect(useBackpack.getState().selected).toBeNull();
  });
});
