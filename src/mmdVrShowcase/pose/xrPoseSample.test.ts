import { Group, Matrix4, Vector3 } from 'three';
import { expect, it } from 'vitest';
import { xrPoseSampler } from './xrPoseSample';

it('uses grip and aim in the XR origin frame, and reports inferred or lost grip even with a valid ray', () => {
  const origin=new Group(); origin.position.set(2,.2,-1); origin.rotation.y=Math.PI/2;
  const source={gripSpace:{},targetRaySpace:{}} as XRInputSource, ref={} as XRReferenceSpace;
  const session={visibilityState:'visible',inputSources:[source]} as unknown as XRSession;
  const pose=(x:number,y:number,z:number) => ({emulatedPosition:false,transform:{matrix:new Matrix4().makeTranslation(x,y,z).elements,position:{x,y,z}}});
  const aim=pose(0,1,.1); let grip: ReturnType<typeof pose> | null=pose(.02,.98,.14);
  const frame={session,getPose:(space:XRSpace)=>space===source.gripSpace?grip:aim} as unknown as XRFrame;
  const sample=xrPoseSampler(), read=()=>sample(source,session,frame,ref,origin);
  expect(read()!.grip.distanceTo(new Vector3(2.14,1.18,-1.02))).toBeLessThan(1e-6);
  expect(read()!.ray.direction.distanceTo(new Vector3(-1,0,0))).toBeLessThan(1e-6);
  grip.emulatedPosition=true; expect(read()?.emulated).toBe(true);
  grip=null; expect(read()).toBeNull();
});
