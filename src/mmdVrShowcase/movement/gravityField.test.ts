import {Vector3} from 'three';
import {expect,it} from 'vitest';
import {sceneryIds} from '../scenery/catalog';
import {allMoons} from '../scenery/planet/windAtlas';
import {homeWorld,sampleStageGravity} from './gravityField';

it('writes fixed world-down in ordinary rooms, even at the coordinates of a previous well',()=>{
  const p=homeWorld.centre.clone(),out=new Vector3();
  for(const room of sceneryIds.filter(id=>id!=='glassPlanet')){
    out.set(8,9,10);
    expect(sampleStageGravity(room,p,homeWorld,out)).toBeNull();
    expect(out.toArray()).toEqual([0,-9.81,0]);
  }
});

it.each([homeWorld,...allMoons])('samples $id by object position and returns the authored identity',w=>{
  const radial=new Vector3(.6,0,-.8),p=w.centre.clone().addScaledVector(radial,w.radius),before=p.clone(),out=new Vector3();
  expect(sampleStageGravity('glassPlanet',p,null,out)).toBe(w);
  expect(out.distanceTo(radial.multiplyScalar(-w.surfaceGravity))).toBeLessThan(1e-12);
  expect(p.equals(before)).toBe(true);
});

it('retains separate histories in the strait, then reacquires when an object crosses',()=>{
  const salt=allMoons.find(m=>m.id==='salt')!,glaze=allMoons.find(m=>m.id==='glaze')!;
  const axis=glaze.centre.clone().sub(salt.centre).normalize(),distance=salt.centre.distanceTo(glaze.centre);
  const seam=salt.centre.clone().addScaledVector(axis,(distance+salt.radius-glaze.radius)/2);
  const a=new Vector3(),b=new Vector3();
  const fromLeft=sampleStageGravity('glassPlanet',salt.centre,null,a);
  const fromRight=sampleStageGravity('glassPlanet',glaze.centre,null,b);
  expect(sampleStageGravity('glassPlanet',seam,fromLeft,a)).toBe(salt);
  expect(sampleStageGravity('glassPlanet',seam,fromRight,b)).toBe(glaze);
  expect(a.dot(axis)).toBeLessThan(0);expect(b.dot(axis)).toBeGreaterThan(0);
  expect(sampleStageGravity('glassPlanet',seam.addScaledVector(axis,.4),fromLeft,a)).toBe(glaze);
});

it('weakens with altitude, fades at the edge, and clears a previous well in deep space',()=>{
  const out=new Vector3(),down=new Vector3(0,-1,0);
  const at=(r:number)=>homeWorld.centre.clone().addScaledVector(down,r);
  expect(sampleStageGravity('glassPlanet',at(24),null,out)).toBe(homeWorld);
  expect(out.y).toBeCloseTo(2.5/4,12); // opposite hemisphere: pull is world-up
  expect(sampleStageGravity('glassPlanet',at(36.6),homeWorld,out)).toBe(homeWorld);
  expect(out.y).toBeCloseTo(.5*2.5*(12/36.6)**2,12); // middle of the outer fade
  expect(sampleStageGravity('glassPlanet',at(38),homeWorld,out)).toBe(homeWorld);
  expect(out.lengthSq()).toBe(0); // hysteresis retains the identity just outside its pull
  out.set(8,9,10);
  expect(sampleStageGravity('glassPlanet',at(100),homeWorld,out)).toBeNull();
  expect(out.toArray()).toEqual([0,0,0]);
});

it('captures a drifting object at the faded sulfur boundary when glaze already exerts gravity',()=>{
  const point=new Vector3(20.915205,24.200860,-29.515221),acc=new Vector3(),fresh=new Vector3();
  const sulfur=allMoons.find(m=>m.id==='sulfur')!,glaze=allMoons.find(m=>m.id==='glaze')!;
  expect(sampleStageGravity('glassPlanet',point,null,fresh)).toBe(glaze);
  expect(sampleStageGravity('glassPlanet',point,sulfur,acc)).toBe(glaze);
  expect(acc.length()).toBeGreaterThan(.9);expect(acc.equals(fresh)).toBe(true);
});
