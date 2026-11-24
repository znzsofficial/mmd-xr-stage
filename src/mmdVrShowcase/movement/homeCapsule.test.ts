import {afterAll,beforeAll,expect,it,vi} from 'vitest';
import Rapier from '@dimforge/rapier3d-compat';
import {Vector3} from 'three';
import {createHomeCapsule} from './homeCapsule';
import {addHomeTerrainSolids} from './homeTerrainSolids';
import {createTraveller,planetCentre,surfaceStep,transport,type Traveller} from './planetTravel';
import {stickAxis} from './controllerInput';
import {WALK_SPEED} from '../settings/mmdVrQuality';

let world:Rapier.World,d:ReturnType<typeof createHomeCapsule>;
const eye=new Vector3(0,1.65,0),noop=()=>{};
beforeAll(async()=>{await Rapier.init();world=new Rapier.World({x:0,y:0,z:0});addHomeTerrainSolids(Rapier,world);d=createHomeCapsule(Rapier,world,()=>WALK_SPEED.normal);});
afterAll(()=>{d.dispose();world.free();});
function start(){const s=createTraveller();transport(s);return s;}
function walk(s:Traveller,rate:number,raw:number,frames=rate,localEye=eye){
  let length=0;const old=new Vector3();
  for(let i=0;i<frames;i++){old.copy(s.foot);s.dir.set(0,0,-1).applyQuaternion(s.basis);d.step(s,1/rate,stickAxis(raw),0,localEye,noop);length+=old.distanceTo(s.foot);}
  return length;
}
it.each([20,36,72,90,120])('the real %i Hz world gives the sole two distinct analog speeds and stops on release',rate=>{
  for(const raw of [.25,1]){const s=start();d.seed(s);walk(s,rate,raw);
    expect(walk(s,rate,raw)).toBeCloseTo(WALK_SPEED.normal*stickAxis(raw),1);
    expect(walk(s,rate,0)).toBeLessThan(1e-6);expect(s.grounded).toBe(true);}
});

it('uses the fallback foot and motion on a late seed; park and return do no speculative physics or view writes',()=>{
  const s=start(),travel=new Vector3(),local=new Vector3(.2,1.6,-.17);
  for(let i=0;i<55;i++)surfaceStep(s,travel.set(1,0,0).applyQuaternion(s.basis),2.4,1/90,false,noop,1.745);
  const steps=vi.spyOn(world,'step'),casts=vi.spyOn(world,'castShape');
  try{
    d.stop();const foot=s.foot.clone(),q=s.basis.clone();walk(s,20,1,80);expect(s.foot.equals(foot)&&s.basis.equals(q)).toBe(true);
    d.seed(s);d.step(s,0,1,0,local,noop);expect(s.foot.equals(foot)&&s.basis.equals(q)).toBe(true);expect(steps).not.toHaveBeenCalled();
    expect(walk(s,20,1,1)).toBeGreaterThan(.11);expect(steps).toHaveBeenCalledTimes(3);
    const settled=s.foot.clone();walk(s,90,0);d.stop();walk(s,90,1);expect(settled.distanceTo(s.foot)).toBeLessThan(1e-6);
    expect(steps).toHaveBeenCalledTimes(3);expect(casts).toHaveBeenCalledTimes(3);
    // Reseed at another heading/hemisphere; no north-pad correction, carry
    // velocity or artificial return-to-upright while the stick stays neutral.
    const back=start();back.foot.copy(planetCentre).add(new Vector3(0,-12,0));transport(back);
    surfaceStep(back,travel.set(0,0,0),2.4,1/90,false,noop,1.745);const from=back.foot.clone(),basis=back.basis.clone();
    d.seed(back);walk(back,20,0);expect(from.distanceTo(back.foot)).toBeLessThan(1e-6);expect(basis.angleTo(back.basis)).toBeLessThan(1e-6);
    expect(steps).toHaveBeenCalledTimes(3);expect(walk(back,20,.25,10)).toBeGreaterThan(.08);expect(back.up.y).toBeLessThan(-.99);
  }finally{steps.mockRestore();casts.mockRestore();}
});

it.each(['body','offset head'])('real %s obstacle stops driven travel; removing it restores the same tangent',part=>{
  const s=start(),local=eye.clone();local.z+=.43;
  const from=(part==='body'?new Vector3(0,.8,0):local.clone()).applyQuaternion(s.basis).add(s.foot);
  const wall=world.createCollider(Rapier.ColliderDesc.cuboid(.04,.16,.20).setTranslation(from.x+.90,from.y,from.z));
  d.seed(s);try{
    walk(s,20,1,40,local);expect(s.foot.x).toBeGreaterThan(.4);expect(s.foot.x).toBeLessThan(.80);
    const blocked=s.foot.clone();walk(s,90,1,90,local);expect(blocked.distanceTo(s.foot)).toBeLessThan(.025);
    // A physical head lean into the blocker while stopped is not a motor move.
    const still=s.foot.clone();walk(s,20,0,20,local.clone().add(new Vector3(.25,0,0)));expect(s.foot.distanceTo(still)).toBeLessThan(1e-6);
  }finally{world.removeCollider(wall,true);}
  expect(walk(s,36,1,36,local)).toBeGreaterThan(1.9);
});
