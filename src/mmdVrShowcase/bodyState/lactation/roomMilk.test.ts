// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { Group, InstancedMesh, Matrix4, Scene, Vector3, type WebGLRenderer } from 'three';
import { clearBackpack, syncBackpackFiles, useBackpack } from '../../backpack';
import { useMmdVrStore } from '../../mmdVrStore';
import { useBodyState } from '../store';
import { DEFAULT_BODY_PROFILE } from '../data';
import { clearMilkEffects, offerMilkDrain } from './events';
import { mountRoomMilk } from './roomMilk';

let dispose:(()=>void)|null=null;
afterEach(()=>{dispose?.();dispose=null;useMmdVrStore.getState().closeOverlay();clearBackpack();vi.restoreAllMocks();});

function fixture(xr=false){
  let now=0,track=true;vi.spyOn(performance,'now').mockImplementation(()=>now);
  const hidden=vi.spyOn(document,'hidden','get').mockReturnValue(false);
  const file=new File([''], 'outlets.pmx');syncBackpackFiles([file]);const assetId=useBackpack.getState().entries[0].id;
  const runtimeId='model:1',live={runtimeId,visible:true,position:[0,0,0] as [number,number,number]};
  useBackpack.setState({selected:assetId,live:{[assetId]:live}});
  useBodyState.setState({inspection:{assetId,runtimeId},byAsset:{[assetId]:{...DEFAULT_BODY_PROFILE,lactating:true}}});
  useMmdVrStore.getState().openOverlay(xr?'xr':'screen');
  const scene=new Scene();let actor=new Group();scene.add(actor);
  const session=Object.assign(new EventTarget(),{visibilityState:'visible'}),getViewerPose=vi.fn(()=>track?{}:null),frame={session,getViewerPose} as unknown as XRFrame;
  const gl={domElement:document.createElement('canvas'),xr:{isPresenting:xr,getSession:()=>session,getReferenceSpace:()=>({})}} as unknown as WebGLRenderer;
  const sample=vi.fn((_id:string,side:'left'|'right',pos:Vector3,normal:Vector3,_bare?:boolean)=>{
    actor.localToWorld(pos.set(side==='left'?.08:-.08,1.4,.15));normal.set(0,0,1).transformDirection(actor.matrixWorld);return true;
  });
  const getModelRoot=vi.fn((id:string|null)=>id===runtimeId?actor:null);
  const room=mountRoomMilk(scene,gl,{sampleMilkOutlet:sample,getModelRoot},()=>!useMmdVrStore.getState().overlayOpen);
  dispose=room.dispose;
  const tick=(dt=1/90)=>{now+=dt*1000;room.advance(dt,xr?frame:undefined);};
  const emit=(side:'left'|'right'='left',amount=.25)=>offerMilkDrain({kind:'drain',assetId,runtimeId,side,amount});
  const mesh=()=>scene.getObjectByName('body:milk-droplets') as InstancedMesh|undefined;
  const matrix=(i=0)=>{const m=new Matrix4();mesh()!.getMatrixAt(i,m);return m;};
  return {scene,room,assetId,runtimeId,live,tick,emit,sample,hidden,session,gl,actor,mesh,matrix,getModelRoot,getViewerPose,get count(){return mesh()?.count??0;},
    idle:(ms:number)=>{now+=ms;},track:(t:boolean)=>{track=t;},replace:()=>{actor.removeFromParent();actor=new Group();scene.add(actor);}};
}

it('forms a small bead even for the last fraction, follows the evaluated side until release, then falls independently in world space',()=>{
  const f=fixture();expect(f.emit()).toBe(false);f.tick();expect(f.emit('left',.00001)).toBe(true);
  expect(f.count).toBe(1);const at=new Vector3().setFromMatrixPosition(f.matrix()),small=f.matrix().elements[0];
  f.actor.position.x=.3;f.actor.rotation.y=Math.PI/2;f.actor.scale.setScalar(1.4);f.tick(.1);
  const following=new Vector3().setFromMatrixPosition(f.matrix());expect(following.x).toBeGreaterThan(at.x+.35);
  expect(following.y).toBeGreaterThan(at.y+.45);f.tick(.101);
  const released=new Vector3().setFromMatrixPosition(f.matrix());f.actor.position.x+=2;f.tick(.1);
  const airborne=new Vector3().setFromMatrixPosition(f.matrix());expect(airborne.x-released.x).toBeCloseTo(.0042,4);
  expect(released.y-airborne.y).toBeCloseTo(.05,3);expect(f.count).toBe(1);
  f.tick(.15);f.tick(.15);expect(f.count).toBe(0);
  expect(f.emit('right',.25)).toBe(true);expect(f.matrix().elements[0]).toBeGreaterThan(small);f.tick(.12);f.tick(.12);expect(f.count).toBe(2);
  expect(f.sample.mock.calls.at(-1)?.[1]).toBe('right');clearMilkEffects(f.assetId);f.tick();expect(f.count).toBe(0);
});

it('rejects uncertain poses and uses only this side’s current exposure confirmation, including withdrawal and saved fallback',()=>{
  const f=fixture();f.tick();f.sample.mockImplementation((_id,side,p,n,bare)=>{p.set(side==='left'?.1:-.1,1,0);n.set(0,0,1);return side==='left'||bare===true;});
  expect(f.emit('right')).toBe(false);expect(f.emit('left')).toBe(true);clearMilkEffects(f.assetId);
  const saved={...DEFAULT_BODY_PROFILE,lactating:true,bareLeft:false,bareRight:true};
  useBodyState.setState({byAsset:{[f.assetId]:saved}});f.tick();expect(f.count).toBe(0);
  expect(f.emit('right',.04)).toBe(true);useBodyState.setState({draft:{assetId:f.assetId,value:{...saved,bareLeft:true,bareRight:false}}});
  expect(f.count).toBe(0);expect(f.emit('right')).toBe(false);expect(f.emit('left',.04)).toBe(true);
  useBodyState.setState({draft:null});f.tick();expect(f.count).toBe(1); // Explicit left outlet is independent of the override.
  f.sample.mockImplementation((_id,_side,p,n)=>{p.set(0,0,NaN);n.set(0,0,1);return true;});f.tick();expect(f.count).toBe(0);
  expect(f.emit()).toBe(false);f.sample.mockReturnValue(false);f.tick();expect(f.count).toBe(0);
});

it('does no garment sampling, XR tracking or render allocation while roaming past a configured actor',()=>{
  const f=fixture(true);useBodyState.setState({inspection:null});
  for(let i=0;i<90;i++)f.tick();
  expect(f.sample).not.toHaveBeenCalled();expect(f.getViewerPose).not.toHaveBeenCalled();expect(f.getModelRoot).not.toHaveBeenCalled();expect(f.mesh()).toBeUndefined();
  useBodyState.setState({inspection:{assetId:f.assetId,runtimeId:f.runtimeId}});f.tick();
  expect(f.getViewerPose).toHaveBeenCalledOnce();expect(f.sample).not.toHaveBeenCalled();
});

it('clears synchronously on transient selection/hide, rejects stale runtime roots and never catches up after frame stalls',()=>{
  const f=fixture();f.tick();expect(f.emit()).toBe(true);
  useBackpack.setState({selected:null});useBackpack.setState({selected:f.assetId});expect(f.count).toBe(0);expect(f.emit()).toBe(false);
  f.tick();expect(f.emit()).toBe(true);useMmdVrStore.getState().enqueueVisibilityToggle(f.runtimeId);expect(f.count).toBe(0);
  useMmdVrStore.getState().takeVisibilityToggles();f.tick();expect(f.emit()).toBe(true);
  f.replace();expect(f.emit()).toBe(false);expect(f.count).toBe(0);f.tick();expect(f.count).toBe(0);
  expect(f.emit()).toBe(true);f.idle(500);expect(f.emit()).toBe(false);f.tick(.6);expect(f.count).toBe(0);expect(f.emit()).toBe(false);
  f.tick();expect(f.emit()).toBe(true);f.hidden.mockReturnValue(true);document.dispatchEvent(new Event('visibilitychange'));f.hidden.mockReturnValue(false);
  expect(f.emit()).toBe(false);f.tick();expect(f.count).toBe(0);expect(f.emit()).toBe(true);
  f.room.dispose();expect(f.mesh()).toBeUndefined();expect(f.emit()).toBe(false);dispose=null;
});

it('requires a tracked XR frame in the current visible session; a hidden→visible transition or context loss cannot replay',()=>{
  const f=fixture(true);f.tick();expect(f.emit()).toBe(true);
  f.track(false);f.tick();expect(f.count).toBe(0);expect(f.emit()).toBe(false);f.track(true);f.tick();expect(f.count).toBe(0);
  expect(f.emit()).toBe(true);f.session.dispatchEvent(new Event('visibilitychange'));expect(f.count).toBe(0);expect(f.emit()).toBe(false);
  f.tick();expect(f.emit()).toBe(true);f.gl.domElement.dispatchEvent(new Event('webglcontextlost'));f.tick();expect(f.count).toBe(0);expect(f.emit()).toBe(false);
  f.gl.domElement.dispatchEvent(new Event('webglcontextrestored'));f.tick();expect(f.emit()).toBe(true);
  f.session.dispatchEvent(new Event('end'));f.tick();expect(f.emit()).toBe(false);expect(f.count).toBe(0);
});
