import {Matrix4,Mesh,PlaneGeometry,type WebGLRenderer} from 'three';
import {expect,it} from 'vitest';
import {milkPressFrame,milkRayGuard} from './milkRay';

it('re-picks a tracked trigger or pinch; a lost grip or fingertip is not a held input even if the old ray still hits',()=>{
  const target=new Mesh(new PlaneGeometry(.45,.15));target.position.z=-1;
  const grip={},tip={},thumb={},src={targetRaySpace:{},gripSpace:grip,hand:undefined as Map<string,object>|undefined};
  const session={visibilityState:'visible',inputSources:[src]},gl={xr:{getSession:()=>session,getReferenceSpace:()=>({}),getCamera:()=>({parent:null})}};
  let x=0,emulated=true,gripOK=true,indexOK=true;
  const pose=()=>({emulatedPosition:emulated,transform:{matrix:new Matrix4().makeTranslation(x,0,0).elements,position:{x,y:0,z:0}}});
  const frame={session,getPose:(space:object)=>space===grip&&!gripOK?null:pose(),getJointPose:(joint:object)=>joint===tip&&!indexOK?null:pose()} as unknown as XRFrame;
  const press=()=>milkRayGuard(gl as unknown as WebGLRenderer,session as unknown as XRSession,src as unknown as XRInputSource,target);
  const controller=press();expect(controller(frame)).toBe(true);emulated=false;expect(controller(frame)).toBe(true);emulated=true;expect(controller(frame)).toBe(false);
  x=.27;expect(press()(frame)).toBe(false);x=0;gripOK=false;expect(press()(frame)).toBe(false);
  gripOK=true;emulated=false;src.hand=new Map([['index-finger-tip',tip],['thumb-tip',thumb]]);const pinch=press();expect(pinch(frame)).toBe(true);
  indexOK=false;expect(pinch(frame)).toBe(false);indexOK=true;src.hand.delete('thumb-tip');expect(pinch(frame)).toBe(false);
  session.inputSources=[];expect(press()(frame)).toBe(false);target.geometry.dispose();
});

it('re-picks a deferred pointerdown on the active frame only if its event frame has expired, never on loss, miss, or another session',()=>{
  const session={} as XRSession,source={} as XRInputSource,live={session} as XRFrame;
  const gl={xr:{getFrame:()=>live,getReferenceSpace:()=>({})}} as unknown as WebGLRenderer;
  const lost={session,getPose:()=>null} as unknown as XRFrame;
  const expired={session,getPose:()=>{throw new DOMException('inactive frame','InvalidStateError');}} as unknown as XRFrame;
  expect(milkPressFrame(gl,session,source,expired)).toBe(live);expect(milkPressFrame(gl,session,source)).toBe(live);
  expect(milkPressFrame(gl,session,source,lost)).toBe(lost);expect(milkPressFrame(gl,{} as XRSession,source,expired)).toBeUndefined();
});
