import { Group, Scene, Vector3 } from 'three';
import { expect,it } from 'vitest';
import { createPropColliderFeed, mountHeldColliderSource } from './propColliders';

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
