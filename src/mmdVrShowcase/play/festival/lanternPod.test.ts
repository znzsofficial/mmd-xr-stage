import { Box3, DoubleSide, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three';
import { expect, it } from 'vitest';
import { homeWorld, sampleStageGravity } from '../../movement/gravityField';
import type { SceneryId } from '../../scenery/catalog';
import type { GripFrame } from '../propView';
import { createLanternDisplay } from './lanternDisplay';
import { createLanternFlight, lanternGrip, lanternOutlet, PETALS, POD_LIMIT, SCHOOL_SIZE } from './lanternFlight';
import { lanternHandpiece } from './lanternPaper';

const frame=():GripFrame=>({at:new Vector3(0,1.3,0),dir:new Vector3(0,0,-1),usable:true,dt:1/60,action:'start'});
function advance(step:(room:SceneryId,f:GripFrame)=>void,room:SceneryId,f:GripFrame,seconds:number){
  for(let i=0;i<Math.round(seconds/f.dt);i++)step(room,f);
}
// Bound the actual transformed paper, not the instances' origins. All six
// closed petals share one hinge; a non-animated shell would otherwise pass.
function bounds(m:InstancedMesh,first=0,count=m.count){
  const box=new Box3(),matrix=new Matrix4(),p=new Vector3(),attr=m.geometry.getAttribute('position');
  for(let i=first;i<first+count;i++){
    m.getMatrixAt(i,matrix);
    for(let v=0;v<attr.count;v++)box.expandByPoint(p.fromBufferAttribute(attr,v).applyMatrix4(matrix));
  }
  return box;
}

it('a single stationary squeeze carries a bud beyond the hand, opens its paper and unfolds five swimming lanterns',()=>{
  const f=frame(),flight=createLanternFlight(sampleStageGravity),show=createLanternDisplay(),room='floor';
  const draw=()=>show.draw(flight.pods),size=(m:InstancedMesh)=>bounds(m).getSize(new Vector3());
  try{
    flight.step(room,f);draw();expect(show.petals.count).toBe(PETALS);expect(show.bells.visible).toBe(false);
    f.action='off';advance(flight.step,room,f,.72);draw();
    const tight=size(show.petals),coasted=bounds(show.petals).getCenter(new Vector3());
    expect(coasted.z).toBeLessThan(-.54);expect(coasted.z).toBeGreaterThan(-.65);
    expect(tight.y).toBeGreaterThan(.09);expect(show.bells.count).toBe(0);
    advance(flight.step,room,f,.58);draw();expect(show.bells.count).toBe(1);
    const foldedLength=size(show.tassels).y;
    advance(flight.step,room,f,.47);draw();const open=size(show.petals);
    expect(open.x).toBeGreaterThan(tight.x*1.75);expect(open.y).toBeLessThan(tight.y*.65);
    expect(show.bells.count).toBe(SCHOOL_SIZE);expect(show.tassels.count).toBe(SCHOOL_SIZE);
    expect(bounds(show.tassels,0,1).getSize(new Vector3()).y).toBeGreaterThan(5*foldedLength);
    const first=bounds(show.bells).getCenter(new Vector3());advance(flight.step,room,f,1.65);draw();
    expect(show.petals.visible).toBe(false);const school=bounds(show.bells);
    expect(school.getCenter(new Vector3()).y-first.y).toBeGreaterThan(.36);
    expect(school.getSize(new Vector3()).x).toBeGreaterThan(.38);
    advance(flight.step,room,f,2);draw();expect(show.bells.count).toBe(0);expect(show.tassels.visible).toBe(false);
  }finally{show.dispose();}
});

it('copies the wrist ray once and resamples each pod and jelly at its own point on the side and underside',()=>{
  const f=frame(),flight=createLanternFlight(sampleStageGravity),room='glassPlanet';
  const right=new Vector3(1,0,0),below=new Vector3(0,-1,0);
  f.at.copy(homeWorld.centre).addScaledVector(right,homeWorld.radius+1.3);const start=f.at.clone();
  flight.step(room,f);
  f.at.copy(homeWorld.centre).addScaledVector(below,homeWorld.radius+1.3);f.dir.set(1,0,0);
  const second=f.at.clone();flight.step(room,f);
  f.at.set(100,150,100);f.dir.set(0,1,0);f.action='held';advance(flight.step,room,f,.75);
  const [a,b]=flight.pods;
  expect(a.point.z-start.z).toBeLessThan(-.56);expect(b.point.x-second.x).toBeGreaterThan(.56);
  expect(a.point.x-start.x).toBeGreaterThan(.11);expect(b.point.y-second.y).toBeLessThan(-.11);
  advance(flight.step,room,f,1.1);const r=a.school.map(j=>j.point.clone()),s=b.school.map(j=>j.point.clone());
  advance(flight.step,room,f,1.2);
  for(let i=0;i<SCHOOL_SIZE;i++){
    const ja=a.school[i],jb=b.school[i];expect(ja.owner).toBe(homeWorld);expect(jb.owner).toBe(homeWorld);
    expect(ja.point.x-r[i].x).toBeGreaterThan(.17);expect(jb.point.y-s[i].y).toBeLessThan(-.17);
    // Different jelly positions produce different normals on the same curved surface.
    expect(ja.point.clone().sub(homeWorld.centre).normalize().dot(ja.up)).toBeGreaterThan(.99999);
    expect(jb.point.clone().sub(homeWorld.centre).normalize().dot(jb.up)).toBeGreaterThan(.99999);
  }
  expect(a.school[1].up.distanceTo(a.school[2].up)).toBeGreaterThan(.01);
});

it('passes back the owner returned for each individual traveller, even with overlapping schools',()=>{
  const seen=new Set<Vector3>(),flight=createLanternFlight<Vector3>((_,point,previous,out)=>{
    if(seen.has(point))expect(previous).toBe(point);
    seen.add(point);out.set(0,-1,0);return point;
  });
  const f=frame();flight.step('pool',f);f.dir.set(1,0,0);flight.step('pool',f);f.action='held';
  advance(flight.step,'pool',f,1.9);expect(seen.size).toBe(2*(1+SCHOOL_SIZE));
});

it('drops over-capacity and interrupted presses without a deferred bloom; a new mount starts empty',()=>{
  const flight=createLanternFlight(sampleStageGravity),show=createLanternDisplay(),f=frame();
  const check=(p:number,b:number)=>{show.draw(flight.pods);expect(show.petals.count).toBe(p);expect(show.bells.count).toBe(b);expect(show.tassels.count).toBe(b);};
  try{
    for(let i=0;i<POD_LIMIT+7;i++)flight.step('floor',f);
    f.action='held';advance(flight.step,'floor',f,1.8);check(POD_LIMIT*PETALS,POD_LIMIT*SCHOOL_SIZE);
    advance(flight.step,'floor',f,5.5);check(0,0);
    f.action='start';flight.step('floor',f);check(PETALS,0);
    f.usable=false;flight.step('floor',f);check(0,0);
    f.usable=true;f.action='held';advance(flight.step,'floor',f,1.8);check(0,0);
    f.action='start';flight.step('floor',f);flight.step('pool',f);check(0,0);
    f.action='off';advance(flight.step,'pool',f,2);check(0,0);
    f.action='start';flight.step('pool',f);check(PETALS,0);flight.clear();check(0,0);
    const next=createLanternFlight(sampleStageGravity);f.action='held';advance(next.step,'pool',f,3);
    show.draw(next.pods);expect(show.petals.visible||show.bells.visible||show.tassels.visible).toBe(false);
  }finally{show.dispose();}
});

it('places the wrist grip inside the raked bamboo handle and the outlet at the front paper hem',()=>{
  const lantern=new Mesh(lanternHandpiece(),new MeshBasicMaterial({side:DoubleSide}));
  try{
    const axis=new Vector3(0,1,0).applyAxisAngle(new Vector3(1,0,0),-lanternGrip.pitch);
    for(const y of [-.017,0,.017]){
      const middle=new Vector3(...lanternGrip.point).addScaledVector(axis,y);
      for(const sign of [-1,1]){
        const x=new Vector3(sign,0,0),from=middle.clone().addScaledVector(x,.025);
        const hit=new Raycaster(from,x.negate()).intersectObject(lantern)[0];
        expect(hit.point.distanceTo(middle)).toBeCloseTo(.009,3);
      }
    }
    const front=new Vector3(...lanternOutlet.position),ray=new Vector3(...lanternOutlet.direction);
    expect(new Raycaster(front,ray).intersectObject(lantern)).toHaveLength(0);
    const hit=new Raycaster(front.clone().add(new Vector3(0,.002,0)),ray.negate()).intersectObject(lantern)[0];
    expect(hit.distance).toBeLessThan(.009);
  }finally{lantern.geometry.dispose();lantern.material.dispose();}
});
