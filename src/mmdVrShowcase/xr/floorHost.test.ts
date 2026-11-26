import {afterEach, expect, it, vi} from 'vitest';
import {startGameFloor} from '../../../scripts/webgpu-actor/stage-host.jsx';
import {clearBackpack, syncBackpackFiles, useBackpack} from '../backpack/store';
import {useMmdVrStore} from '../mmdVrStore';
import type {StageSnapshot} from '../stage/stageSnapshot';

// Exercise the real click/abort boundary without ever allocating a renderer.
function arrange(){
  const first=new File([],'one.pmx'), second=new File([],'two.pmx');
  syncBackpackFiles([first,second]);
  const saved:StageSnapshot={scenery:'floor',models:[],objects:[],time:3,playing:false,loop:false,physicsEnabled:true,
    assets:[first,second].map(modelFile=>({kind:'model',modelFile,companionFiles:[],bodyMotionFile:null}))};
  useBackpack.setState({layouts:{floor:saved}});
  useMmdVrStore.getState().setPrefs({scenery:'floor'});useMmdVrStore.setState({savedStage:saved});
  const requestSession=vi.fn();
  vi.stubGlobal('window',new EventTarget());vi.stubGlobal('XRGPUBinding',class {});
  vi.stubGlobal('navigator',{gpu:{},xr:{requestSession}});
  return {requestSession,saved};
}
afterEach(()=>{vi.unstubAllGlobals();clearBackpack();useMmdVrStore.setState(useMmdVrStore.getInitialState());});

it('rejects a multi-actor continuation without requesting XR or consuming the previous layout',async()=>{
  const {requestSession,saved}=arrange(), onStatus=vi.fn();
  const host=startGameFloor({resume:true,onStatus});await host.done;
  expect(host.status.phase).toBe('failed');expect(host.status.error).toBeTruthy();expect(onStatus).toHaveBeenCalled();
  expect(requestSession).not.toHaveBeenCalled();expect(useBackpack.getState().layouts.floor).toBe(saved);
  expect(useMmdVrStore.getState().savedStage).toBe(saved);
});

it('requests fresh XR inside the click, returns immediately from a cancelled prompt and ends only its late grant',async()=>{
  const {requestSession,saved}=arrange();
  let grant!: (session:EventTarget)=>void, deny!: (reason:Error)=>void;
  requestSession.mockReturnValueOnce(new Promise(resolve=>grant=resolve)).mockReturnValueOnce(new Promise((_,reject)=>deny=reject));
  const opts={resume:false,onStatus:vi.fn()};
  const first=startGameFloor(opts);expect(requestSession).toHaveBeenCalledTimes(1);
  first.stop();await first.done;
  const second=startGameFloor(opts);expect(requestSession).toHaveBeenCalledTimes(2);
  const late=Object.assign(new EventTarget(),{end:vi.fn()});grant(late);
  await vi.waitFor(()=>expect(late.end).toHaveBeenCalledOnce());
  expect(second.status.phase).toBe('request');expect(useMmdVrStore.getState().overlayOpen).toBe(false);
  deny(Error('Permission denied'));await second.done;
  expect(second.status.error).toContain('Permission denied');
  expect(useBackpack.getState().layouts.floor).toBe(saved);expect(useBackpack.getState().entries).toHaveLength(2);
});
