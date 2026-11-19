import { afterEach, expect, it } from 'vitest';
import { Box3, Matrix4, Vector3 } from 'three';
import { canPlaceInScenery, POOL } from '../../scenery/placementAreas';
import { makeBoat, makeGate, makeWake } from './ferryModels';
import { advanceFerry, aimFerry, boatPose, boatSize, GATE_RADIUS, GATE_X, GATE_Y, GATE_Z, launchFerry, resetFerry, ringPose, SIDES, sideSign } from './voyage';

afterEach(resetFerry);

it.each(SIDES)('aims into the %s opening from a translated controller in world space', side=>{
  const from=new Vector3(1.2,1.55,1.8),x=sideSign(side)*GATE_X;
  const towards=(dx:number,y:number)=>new Vector3(x+dx,y,GATE_Z).sub(from).multiplyScalar(.3);
  const dir=towards(0,GATE_Y);
  expect(aimFerry(from,dir)).toBe(side);
  expect(aimFerry(from,towards(.5,.14))).toBe(side);
  expect(aimFerry(from,towards(GATE_RADIUS,.2))).toBeNull(); // jamb
  expect(aimFerry(from,towards(.64,GATE_Y+.64))).toBeNull(); // above the curved crown
  expect(aimFerry(from,towards(0,-.5))).toBeNull(); // submerged
  expect(aimFerry(from,dir.clone().negate())).toBeNull();
  expect(aimFerry(from,new Vector3(1,0,0))).toBeNull();
});

it('keeps the real gate meshes, including floating feet, off all placeable ground',()=>{
  for(const side of SIDES){
    const g=makeGate(side);g.computeBoundingBox();
    const b=g.boundingBox!.clone().translate(new Vector3(sideSign(side)*GATE_X,GATE_Y,GATE_Z));
    for(const x of [b.min.x,b.max.x]) for(const z of [b.min.z,b.max.z]) {
      expect(Math.abs(x-POOL.water.x)).toBeLessThan(POOL.water.w/2);
      expect(Math.abs(z-POOL.water.z)).toBeLessThan(POOL.water.d/2);
      expect(canPlaceInScenery('pool',x,z)).toBe(false);
    }
    g.dispose();
  }
});

it.each(SIDES)('sends one ring through the %s arch before the ferry arrives from that side',side=>{
  const muzzle=new Vector3(-.38,1.25,.4),center=new Vector3();
  launchFerry(side,muzzle);
  muzzle.z+=3; // Hand tracking continues updating its scratch vector after firing.
  expect(ringPose(advanceFerry(0)!,center)).toBeGreaterThan(0);expect(center.z).toBeCloseTo(.4);
  let crossed=false, arrived=false;
  const hull=makeBoat(),wake=makeWake(),swept=new Box3(),world=new Matrix4();
  hull.computeBoundingBox();wake.computeBoundingBox();const local=hull.boundingBox!.clone().union(wake.boundingBox!);
  let first=0,last=0;
  for(let v=advanceFerry(.025);v;v=advanceFerry(.025)){
    const rim=ringPose(v,center);
    if(rim>0 && center.z<GATE_Z) {
      if(!crossed) { // Within one frame of passing the centre, rather than disappearing in front of it.
        expect(center.x).toBeCloseTo(sideSign(side)*GATE_X,1); expect(center.y).toBeCloseTo(GATE_Y,1);
      }
      crossed=true;
    }
    const size=boatSize(v);
    if(size<=0) continue;
    if(!arrived) expect(center.z).toBeLessThanOrEqual(GATE_Z + .001);
    const yaw=boatPose(v,center);
    if(!arrived){first=center.x;arrived=true;}
    last=center.x; world.makeRotationY(yaw).multiply(new Matrix4().makeScale(size,size,size)).setPosition(center);
    swept.union(local.clone().applyMatrix4(world));
  }
  expect(crossed).toBe(true);
  expect(first*sideSign(side)).toBeGreaterThan(3.7);expect(last*sideSign(side)).toBeLessThan(-3.7);
  expect(swept.min.x).toBeGreaterThan(POOL.water.x-POOL.water.w/2);
  expect(swept.max.x).toBeLessThan(POOL.water.x+POOL.water.w/2);
  expect(swept.min.z).toBeGreaterThan(POOL.water.z-POOL.water.d/2);
  expect(swept.max.z).toBeLessThan(POOL.water.z+POOL.water.d/2);
  hull.dispose();wake.dispose();
});

it('replaces the active crossing on replay; reset and natural completion leave no queued effects',()=>{
  launchFerry('left');expect(boatSize(advanceFerry(3)!)).toBe(1);
  for(let i=0;i<50;i++) launchFerry('right');
  const replay=advanceFerry(0)!;expect(replay.side).toBe('right');expect(boatSize(replay)).toBe(0);
  expect(advanceFerry(15)).toBeNull();expect(advanceFerry(.1)).toBeNull();
  launchFerry('left');resetFerry();expect(advanceFerry(0)).toBeNull();
});
