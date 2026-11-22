import { CircleGeometry, Group, Mesh, Ray, Raycaster, RingGeometry, Vector3, type Intersection } from 'three';
import { expect, it } from 'vitest';
import { confirmPosePress, posePicker } from './posePick';
import type { PoseKey } from './poseSession';

it('picks a selected rear ankle through the front one, and a wrist center through the selected ankle dial', () => {
  const joints = new Map<PoseKey,Group>(), pick = posePicker();
  const add = (key: PoseKey, x:number, z:number, dial=false) => {
    const joint=new Group(), point=new Mesh(new CircleGeometry(.1,32));
    joint.position.set(x,0,z); joint.add(point); point.userData.poseHit={key,ring:false};
    if (dial) { const turn=new Mesh(new RingGeometry(.18,.24,32)); turn.userData.poseHit={key,ring:true}; joint.add(turn); }
    joints.set(key,joint);
  };
  add('leftFoot',0,-1.6,true); add('rightFoot',.026,-1.3); add('leftHand',.2,-2);
  const ray=new Raycaster(new Vector3(),new Vector3(0,0,-1));
  const at=(x:number,focus:PoseKey) => {
    ray.ray.origin.x=x; const hits:Intersection[]=[]; pick(ray,joints,focus,hits);
    return hits[0]?.object.userData.poseHit;
  };
  expect(at(0,'leftFoot')).toEqual({key:'leftFoot',ring:false});
  expect(at(.026,'rightHand')).toEqual({key:'rightFoot',ring:false});
  expect(at(.2,'leftFoot')).toEqual({key:'leftHand',ring:false});
  expect(at(-.21,'leftFoot')).toEqual({key:'leftFoot',ring:true});
  joints.get('leftHand')!.visible=false;
  expect(at(.2,'leftFoot')).toEqual({key:'leftFoot',ring:true});
});

it('rechecks selectstart against the actual picker: a stale wrist, a stale center or a departed ray cannot start another drag',()=>{
  const root=new Group(), joints=new Map<PoseKey,Group>(), pick=posePicker();
  for(const key of ['leftHand','rightHand'] as const){
    const joint=new Group(), point=new Mesh(new CircleGeometry(.10)), ring=new Mesh(new RingGeometry(.19,.23));
    point.userData.poseHit={key,ring:false}; ring.userData.poseHit={key,ring:true}; joint.add(point,ring);
    joint.position.set(key==='leftHand'?0:.50,0,-2); joints.set(key,joint); root.add(joint);
  }
  root.raycast=(caster,out)=>pick(caster,joints,'leftHand',out);
  const cast=new Raycaster(), ray=new Ray(new Vector3(),new Vector3(0,0,-1)), old=joints.get('leftHand')!.children[0];
  const press=(x:number)=>{ray.origin.x=x;return confirmPosePress(cast,root,ray,old)};
  expect(press(.50)).toBeNull(); expect(press(.21)).toBeNull(); expect(press(1)).toBeNull();
  const fresh=press(.04);expect(fresh?.object).toBe(old);expect(fresh!.point.x).toBeCloseTo(.04);
});
