import { Bone, Group, Quaternion, Scene, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { CORD_SAMPLES, createKiteHorizon, displayedEyelet, flightPoint, headOf, registerEyelet, writeCord } from './kiteFlight';
import { getKiteWind, resetKite, setKiteWind, useKiteStore } from './kiteStore';
import {homeWorld} from '../../movement/gravityReference';

describe('portable swallow kite', () => {
  it('never substitutes the visible bench for a hidden controller or a missing wrist', () => {
    const scene = new Scene(), stand = new Group(), wrist = new Group(), hand = new Group();
    stand.name='story:bench-reel';wrist.name='play:character';hand.userData.heldToy='kite';
    const a = new Group(), b = new Group(), c = new Group();stand.add(a); wrist.add(b);hand.add(c);scene.add(stand,wrist,hand);
    const release=registerEyelet(scene,a);registerEyelet(scene,b);registerEyelet(scene,c);
    expect(displayedEyelet(scene,'bench')).toBe(a);expect(displayedEyelet(scene,'controller')).toBe(c);
    hand.visible=false;expect(displayedEyelet(scene,'controller')).toBeNull();
    wrist.position.set(1,2,3); wrist.rotation.z = Math.PI/2; b.position.y = .1;
    expect(displayedEyelet(scene,'wrist')!.getWorldPosition(new Vector3()).x).toBeCloseTo(.9);
    wrist.visible=false; expect(displayedEyelet(scene,'wrist')).toBeNull();
    wrist.visible=true; scene.remove(wrist); expect(displayedEyelet(scene,'wrist')).toBeNull();
    release(); expect(displayedEyelet(scene,'bench')).toBeNull();
  });

  it('carries the launch heading along the shell and lifts above the local horizon',()=>{
    const frame=createKiteHorizon(),rotation=new Quaternion(),radial=new Vector3(),at=new Vector3();
    const up=new Vector3(0,1,0),back=new Vector3(0,0,1),tip=new Vector3();
    for(let i=0;i<=12;i++){
      const angle=i*Math.PI/12;radial.set(Math.sin(angle),Math.cos(angle),0);
      at.copy(homeWorld.centre).addScaledVector(radial,homeWorld.radius+1.4);
      frame.sample('glassPlanet',at,i===0);frame.orient(rotation,i===0?back:null);
      expect(up.clone().applyQuaternion(rotation).dot(radial)).toBeCloseTo(1);
      expect(back.clone().applyQuaternion(rotation).dot(back)).toBeCloseTo(1);
      expect(flightPoint(tip,2,1,true).applyQuaternion(rotation).dot(radial)).toBeGreaterThan(1.2);
    }
    frame.sample('glassPlanet',at.set(1e4,0,0),false);expect(frame.up.dot(radial)).toBeCloseTo(1);
    frame.sample('chapel',at,true);frame.orient(rotation,up); // straight overhead is still a usable horizontal basis
    expect(up.clone().applyQuaternion(rotation).dot(up)).toBeCloseTo(1);
  });

  it('uses the animated PMX head rather than the model origin when the dancer bends and turns', () => {
    const root = new Group(), neck = new Bone(), head = new Bone(); head.userData.mmdBoneName='頭';
    head.name='bone42'; root.add(neck); neck.add(head); head.position.y = 1;
    const sample = headOf(root)!; neck.rotation.z=Math.PI/2; root.position.x=5;
    expect(sample.getWorldPosition(new Vector3()).x).toBeCloseTo(4);
  });

  it('pins both ends and keeps even opposite-wind line segments off the face throughout the crossing', () => {
    const path = new Float32Array(CORD_SAMPLES*3), end = new Vector3();
    for (const x of [-.60,.60]) for (const y of [-.60,.12,.62]) for (const lane of [-1,-.5,0,.5,1]) {
      const start = new Vector3(x,y,.15); flightPoint(end,3.4,lane,false); writeCord(path,start,end,true);
      expect(new Vector3().fromArray(path).distanceTo(start)).toBeLessThan(.00001);
      expect(new Vector3().fromArray(path,path.length-3).distanceTo(end)).toBeLessThan(.00001);
      let nearest = Infinity;
      for (let i=3; i<path.length; i+=3) {
        const ax=path[i-3], ay=path[i-2], dx=path[i]-ax, dy=path[i+1]-ay;
        const t=Math.max(0,Math.min(1,-(ax*dx+ay*dy)/Math.max(1e-12,dx*dx+dy*dy)));
        nearest = Math.min(nearest,Math.hypot(ax+t*dx,ay+t*dy));
      }
      expect(nearest).toBeGreaterThan(.34);
    }
  });

  it('launches off shoulder, keeps the left glide wider and lower, and stays within a finite volume', () => {
    const lo = new Vector3(), hi = new Vector3();
    expect(flightPoint(lo,0,-1,false).x).toBeLessThan(-.7);
    for (const s of [2,8.1,93.4,1e6]) {
      flightPoint(lo,s,-1,false); flightPoint(hi,s,1,false);
      expect(-lo.x).toBeGreaterThan(hi.x); expect(hi.y-lo.y).toBeGreaterThan(.7);
      expect(lo.length()).toBeLessThan(3.5); expect(hi.length()).toBeLessThan(3.5);
      expect(flightPoint(hi,s,0,true).y).toBeGreaterThan(1.2);
    }
  });

  it('clears the chosen breeze with the active flight on reset', () => {
    setKiteWind('left'); expect(useKiteStore.getState().active).toBe(true); expect(getKiteWind()).toBe('left');
    resetKite(); expect(useKiteStore.getState().active).toBe(false); expect(getKiteWind()).toBe('right');
  });
});
