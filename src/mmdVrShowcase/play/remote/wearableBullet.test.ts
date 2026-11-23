import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { Group, Matrix4, PerspectiveCamera, Scene, Vector3, type Object3D } from 'three';
import { createCustomBulletMmdPhysicsBackend, type CustomBulletMmdModule } from '@yohawing/three-mmd-loader/physics';
import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import { createMmdRuntimeHandle } from '../../mmdRuntime/mmdRuntime';
import { createPropColliderFeed, EGG_SLOT, mountHeldColliderSource, propColliderShape } from '../propColliders';
import { adjustRemoteEgg, clearRemoteEgg, cycleRemoteEgg, startEggBinding, stopRemoteEgg } from './remoteMotor';
import { createWearableCollider, mountWearableCollider, presentRemoteWearable } from './wearableCollider';
import { receiverFixture } from './receiverFixture.testSupport';

let bullet:CustomBulletMmdModule;
const natives:ReturnType<typeof createCustomBulletMmdPhysicsBackend>[]=[];
vi.mock('../../mmdRuntime/bulletModule',()=>({getBulletModule:async()=>({module:bullet,
  createCustomBulletMmdPhysicsBackend:(...a:Parameters<typeof createCustomBulletMmdPhysicsBackend>)=>{
    const world=createCustomBulletMmdPhysicsBackend(...a);natives.push(world);return world;}})}));
beforeAll(async()=>{
  const dir=new URL('../../../../public/mmd/0.8.6/',import.meta.url);
  const make=runInNewContext(`${readFileSync(new URL('mmd_bullet.js',dir),'utf8')};MmdBullet`,{console});
  bullet=await make({wasmBinary:readFileSync(new URL('mmd_bullet.wasm',dir))});
});
afterEach(()=>{clearRemoteEgg();vi.restoreAllMocks();natives.length=0;});

it.each([1,.1])('supports and vibrates a weighted paused PMX hem; parks on discontinuities (actor scale %s)',async scale=>{
  const camera=new PerspectiveCamera(),scene=new Scene(),feed=createPropColliderFeed(),source=createWearableCollider(),view=new Group();
  const unmount=mountWearableCollider(scene,source,view),owner={hand:'right',toy:'remoteEgg'} as const;
  const hand=new Group(),session=Object.assign(new EventTarget(),{visibilityState:'visible'}) as XRSession;
  scene.add(hand,view);const release=mountHeldColliderSource(scene,hand,session);
  const input={handedness:'right'};Object.assign(hand.userData,{heldToy:'remoteEgg',propSource:input,propUsable:false});
  const hidden=new Matrix4().makeTranslation(0,-1000,0),hands=Array(12).fill(hidden);
  let seeds=0,now=0,tracked=true,inXR=false,steps=0,live: Object3D|null=null;
  vi.spyOn(performance,'now').mockImplementation(()=>now);
  const rt=createMmdRuntimeHandle(scene,{propColliders:feed.getMatrices,propShape:propColliderShape,
    controllerColliders:()=>[hidden,hidden],handColliders:()=>hands,onBulletStepWork(_f,_w,_o,seed){if(seed)seeds++;}});
  try{
    const {pmx,vmd}=receiverFixture(1/scale),{modelId:id}=await rt.addModel(pmx,[pmx],{physics:true,transform:{scale,positionX:.34,positionZ:-.45,rotationY:33}});
    await rt.loadMotion(vmd,'body',id);
    const root=rt.getModelRoot(id)!,mesh=rt.getModelSurface(id)!.mesh,pelvis=mesh.skeleton.getBoneByName('Pelvis')!;
    const native=natives[0],indices=[2+14+EGG_SLOT],buf=new Float32Array(3),flip=new Vector3(1,1,-1);
    const center=()=>{expect(native.readRigidBodyCenters(indices,buf)).toBe(true);return new Vector3().fromArray(buf);};
    const touching=()=>native.debugPhysicsContactsForRigidBodyRange(indices[0],1).some(c=>c.rigidBodyIndexA===1||c.rigidBodyIndexB===1);
    const vertex=()=>mesh.getVertexPosition(2,new Vector3()).applyMatrix4(mesh.matrixWorld);
    const tick=(pose=0)=>{
      now=++steps*1000/60;const frame=inXR?{session} as XRFrame:undefined;hand.userData.propFrame=tracked?frame:null;
      source.begin(live,now,inXR);feed.sample(scene,null,owner,null,frame);
      rt.update(pose,true,camera,1,false,1/60);presentRemoteWearable(scene);
      expect(rt.getControllerContactCount()).toBe(0);
    };
    const wait=(n:number)=>{for(let i=0;i<n;i++)tick();};
    wait(50);expect(rt.getRigidBodyCount()).toBe(24);const rest=vertex(),original=pelvis.matrixWorld.clone();
    startEggBinding('worn');stopRemoteEgg();live=root;wait(20); // stationary cloth control before powering the same shell
    expect(center().y).toBe(-1000);expect(vertex().distanceTo(rest)).toBeLessThan(.00005);
    // GUI clicks while VMD is paused: retreat to the left, then approach along
    // the same visible bounded path. Initially overlapping must never activate.
    const nudge=(direction:number,count:number)=>{for(let i=0;i<count;i++){adjustRemoteEgg(0,direction);wait(6);}};
    nudge(-1,10);wait(12);expect(center().y).not.toBe(-1000);
    const recovered=vertex();nudge(1,9);wait(90);
    const supported=vertex();expect(supported.distanceTo(recovered)).toBeGreaterThan(.005);expect(touching()).toBe(true);
    const variation=(n:number)=>{let sum=0,max=0;for(let i=0;i<n;i++){const a=vertex();tick();const d=vertex().distanceTo(a);sum+=d;max=Math.max(max,d);}return {mean:sum/n,max};};
    const quiet=variation(90),seed0=seeds;
    cycleRemoteEgg();wait(12);const steady=variation(120);
    cycleRemoteEgg();const early=variation(40);wait(85);const late=variation(45);
    cycleRemoteEgg();const burst=variation(18);wait(12);const gap=variation(20);
    cycleRemoteEgg();wait(60);const off=variation(60);
    if(process.env.MMD_EGG_METRICS)console.info('receiver cloth',scale,{staticDisplacement:supported.distanceTo(recovered),quiet,steady,early,late,burst,gap,off});
    expect(steady.mean).toBeGreaterThan(quiet.mean+.000025);expect(late.mean).toBeGreaterThan(early.mean*1.4);
    expect(burst.mean).toBeGreaterThan(gap.mean+.00002);expect(off.max).toBeLessThan(steady.max*.1);
    expect(pelvis.matrixWorld.elements).toEqual(original.elements);expect(seeds).toBe(seed0);
    nudge(-1,9);wait(180);expect(touching()).toBe(false);expect(center().y).not.toBe(-1000);
    expect(vertex().distanceTo(recovered)).toBeLessThan(.001);nudge(1,9);wait(60);expect(touching()).toBe(true);
    // The actual native body matches the rendered silicone after an evaluated
    // VMD step, including the 10-unit actor at 0.1× in a translated/yawed root.
    cycleRemoteEgg();for(let t=1;t<=10;t++){
      tick(t/60);const c=center().multiply(flip).sub(root.position).multiplyScalar(scale).add(root.position);
      expect(c.distanceTo(view.localToWorld(new Vector3(0,-.001,0)))).toBeLessThan(.00005);
    }
    // Return to paused pose and rebind inside; synthetic controller remains far
    // away, but stale XR frames cannot keep this attached shell in Bullet.
    tick(0);const afterScrub=seeds;inXR=true;startEggBinding('other');stopRemoteEgg();wait(20);expect(center().y).toBe(-1000);
    tracked=false;wait(5);tracked=true;wait(20);expect(center().y).toBe(-1000);
    nudge(-1,10);wait(10);expect(center().y).not.toBe(-1000);
    nudge(1,9);wait(60);expect(vertex().distanceTo(rest)).toBeGreaterThan(.005);
    const lifted=vertex();tracked=false;wait(240);expect(center().y).toBe(-1000);
    const released=vertex();expect(released.distanceTo(lifted)).toBeGreaterThan(.008);
    tracked=true;wait(24);expect(center().y).toBe(-1000);expect(vertex().distanceTo(released)).toBeLessThan(.001);
    adjustRemoteEgg(0,-12);tick();expect(center().y).toBe(-1000);tick();expect(center().y).toBe(-1000);
    tick();expect(center().y).not.toBe(-1000);wait(10);
    adjustRemoteEgg(0,13);let peak=0;for(let i=0;i<30;i++){tick();peak=Math.max(peak,vertex().distanceTo(released));}
    expect(center().y).toBe(-1000);expect(peak).toBeLessThan(.001);
    live=null;wait(4);expect(center().y).toBe(-1000);expect(seeds).toBe(afterScrub);
  }finally{rt.dispose();release();unmount();}
});
