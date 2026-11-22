import { Group, Matrix4, Scene, Vector3 } from 'three';
import { expect,it } from 'vitest';
import { createPropColliderFeed, EGG_SLOT, mountHeldColliderSource } from './propColliders';
import { createWearableCollider, mountWearableCollider } from './remote/wearableCollider';
import { clearRemoteEgg, startEggBinding } from './remote/remoteMotor';

it('samples the mounted, rotated flex joint from the current usable XR frame; rejects transfers, stale frames and visibility gaps',()=>{
  const scene=new Scene(),root=new Group(),wand=new Group(),flex=new Group();
  scene.add(root);root.add(wand);wand.add(flex);wand.name='play:piece:wand';flex.name='wand:flex';
  root.position.set(.3,1,-.7);root.rotation.y=.55;wand.rotation.x=-.48;wand.position.set(0,-.034,-.041);flex.position.y=.078;flex.rotation.z=.095;
  const owner={toy:'wand',hand:'left'} as const,session=Object.assign(new EventTarget(),{visibilityState:'visible'}) as XRSession;
  const frame={session} as XRFrame, feed=createPropColliderFeed(), data=root.userData;
  Object.assign(data,{heldToy:'wand',propSource:{handedness:'left'},propFrame:frame,propUsable:true});
  const release=mountHeldColliderSource(scene,root,session), parked=()=>feed.getMatrices().every(m=>m.elements[13]===-1000);
  const tick=(f=frame)=>feed.sample(scene,null,owner,null,f);
  try{
    tick();expect(parked()).toBe(true);expect(tick()).toBe(true);
    const pos=new Vector3().setFromMatrixPosition(feed.getMatrices()[6]);expect(pos.distanceTo(flex.localToWorld(new Vector3(0,.0468,0)))).toBeLessThan(1e-8);
    expect(feed.getMatrices().slice(0,4).every(m=>m.elements[13]===-1000)).toBe(true);
    expect(tick({session} as XRFrame)).toBe(false);expect(parked()).toBe(true);
    tick();tick();data.propSource={handedness:'left'};expect(tick()).toBe(false);expect(parked()).toBe(true);tick();
    session.dispatchEvent(new Event('visibilitychange'));data.propFrame=frame;expect(tick()).toBe(false);expect(parked()).toBe(true);
    tick();data.propUsable=false;expect(tick()).toBe(false);expect(parked()).toBe(true);
    data.propUsable=true;tick();tick();wand.visible=false;expect(tick()).toBe(false);expect(parked()).toBe(true);
    wand.visible=true;release();expect(tick()).toBe(false);expect(parked()).toBe(true);
    // A screen wrist uses the same manufactured profile without a player frame.
    expect(feed.sample(scene,root,null,owner)).toBe(false);expect(feed.sample(scene,root,null,owner)).toBe(true);
  }finally{release();}
});

it('takes the stand piece in world coordinates, preserving shaft slots and reporting a parked boundary per stepping world',()=>{
  const scene=new Scene(),feed=createPropColliderFeed(),world=new Group(),late=new Group();
  const pieceWorld=new Matrix4().makeRotationX(1).setPosition(.3,.7,-1.2),stand={pieceWorld,binding:{}};
  const tick=()=>feed.sample(scene,null,null,null,undefined,stand);
  const slots=(w:Group)=>feed.getMatrices(w).map((m,i)=>m.elements[13]===-1000?-1:i).filter(i=>i>=0);
  expect(tick()).toBe(false);expect(slots(world)).toEqual([]);
  expect(tick()).toBe(true);expect(slots(world)).toEqual([0,1,2,3]);expect(slots(late)).toEqual([]);
  const heel=new Vector3().setFromMatrixPosition(feed.getMatrices(world)[0]);
  expect(heel.distanceTo(new Vector3(0,-.041,0).applyMatrix4(pieceWorld))).toBeLessThan(1e-8);
  tick();expect(slots(late)).toEqual([0,1,2,3]);stand.binding={};tick(); // Late world missed the rebind sample.
  tick();expect(slots(late)).toEqual([]);expect(slots(late)).toEqual([]);tick();expect(slots(late)).toEqual([0,1,2,3]);
  feed.sample(scene,null,null,null);expect(slots(world)).toEqual([]);expect(feed.getMatrices()).toHaveLength(8);
});

it('keeps the wearable in its own world with no transmitter proxy on screen, and never uses screen fallback for missing XR frames',()=>{
  const scene=new Scene(),feed=createPropColliderFeed(),host=new Group(),neighbor=new Group(),source=createWearableCollider();
  const off=mountWearableCollider(scene,source,new Group()),owner={hand:'left',toy:'remoteEgg'} as const;
  const slots=(world:Group)=>feed.getMatrices(world).flatMap((m,i)=>m.elements[13]===-1000?[]:[i]);
  try{
    startEggBinding('host');
    source.begin(host,100,false);feed.sample(scene,null,owner,null);expect(slots(host)).toEqual([]);
    feed.sample(scene,null,owner,null);expect(slots(host)).toEqual([EGG_SLOT]);expect(slots(neighbor)).toEqual([]);
    feed.sample(scene,null,owner,null);expect(slots(neighbor)).toEqual([]);
    source.begin(host,120,true);expect(feed.sample(scene,null,owner,null)).toBe(false);expect(slots(host)).toEqual([]);
  }finally{clearRemoteEgg();off();}
});
