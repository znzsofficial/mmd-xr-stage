import {expect,it,onTestFinished} from 'vitest';
import {BoxGeometry,Group,InstancedMesh,Mesh,MeshBasicMaterial,Object3D,Raycaster,Vector3,type BufferGeometry} from 'three';
import {createGroundMotor,groundedBody,type ReadColumn} from '../../movement/groundMotor';
import {createSolidColumns} from '../../movement/solidColumns';
import {roomGround} from '../../movement/roomGround';
import {campusPassageParts,schoolExterior} from '../CampusLayout';
import {schoolBrickWalkGeometry} from '../SchoolBrickWalk';
import {arcadeParts,distantLido,POOL_WATER_Y} from '../LidoLayout';
import {poolFurnishings} from '../PoolTerrace';
import type {Part} from '../SceneryBatch';
import {gardenEntranceParts} from '../clinic/GardenEntrance';
import {RoomGate} from '../connections';
import {lidoTimingView} from '../routes/campusArcade/Street';
import {resolvePlacementHeight,visiblePick} from '../placementAreas';
import {shell} from '../routes/campusArcade/site';
import {parkArchitecture} from '../terminus/parkArchitecture';
import {inlandEmbankment} from '../terminus/parkGroundArt';
import {CITY_ORIGINS,type CityVenue} from './site';
import {buildStreetGround} from './streetGround';

const station='seasideTerminus';
type XZ=readonly [number,number];
const down=new Vector3(0,-1,0);

function fixture(){
  const root=new Group(),box=new BoxGeometry(),material=new MeshBasicMaterial(),columns=createSolidColumns();
  const surfaces:BufferGeometry[]=[],batches:InstancedMesh[]=[];
  onTestFinished(()=>{
    columns.invalidate();
    for(const geometry of surfaces)geometry.dispose();
    for(const mesh of batches)mesh.dispose();
    box.dispose();material.dispose();
  });
  function surface(g:BufferGeometry,x=0,z=0){
    const mesh=new Mesh(g,material);mesh.position.set(x,0,z);root.add(mesh);surfaces.push(g);return mesh;
  }
  function batch(parts:Part[],x=0,z=0){
    const m=new InstancedMesh(box,material,parts.length),pose=new Object3D();
    for(const [i,p] of parts.entries()){
      pose.position.set(...p.p);pose.scale.set(...p.s);pose.rotation.set(p.rx??0,p.ry??0,p.rz??0);pose.updateMatrix();m.setMatrixAt(i,pose.matrix);
    }
    m.position.set(x,0,z);root.add(m);batches.push(m);return m;
  }
  function topHits(x:number,z:number){root.updateMatrixWorld(true);return new Raycaster(new Vector3(x,.75,z),down).intersectObjects(root.children).map(h=>h.point.y);}
  return {root,columns,surface,batch,topHits};
}

it('keeps the park shop backs and rail terrace out of the clinic, and the next skyline behind the sports shops',()=>{
  const f=fixture(),park=parkArchitecture(),buildings=f.surface(park.solid);park.prints.dispose();
  for(const x of [-.97,5.13]){
    const ray=new Raycaster(new Vector3(x,1.55,46),new Vector3(0,0,-1));
    expect(ray.intersectObject(buildings)[0].point.z).toBeLessThan(41.5); // clear of the clinic eaves at 41.835
  }
  for(const x of [-12.13,14.32,36.56]){
    const ray=new Raycaster(new Vector3(x,1.55,93.1),new Vector3(0,0,1));
    expect(ray.intersectObject(buildings)[0].point.z).toBeGreaterThan(103);
  }
  const embankment=f.surface(inlandEmbankment());
  expect(new Raycaster(new Vector3(-8.54,2,44.82),down).intersectObject(embankment)).toHaveLength(0);
});

it('shows one slab at the ticket deck and timing walk joins, and water below the coping in the city',()=>{
  const street=fixture(),pool=fixture(),p=CITY_ORIGINS.pool,g=buildStreetGround(station);
  street.surface(g.paving);street.surface(g.earth);
  street.batch([...distantLido(),...arcadeParts(),...lidoTimingView()],p.x,p.z);
  pool.batch(poolFurnishings().blocks);
  for(const [x,z] of [[6.42,7.18],[6.03,12.015],[6.25,-5.732],[6.63,-19.04],[4.39,-19.80]]){
    expect(street.topHits(p.x+x,p.z+z)).toEqual([expect.closeTo(0,5)]);
    expect(pool.topHits(x,z).filter(y=>y>-.1)).toEqual([expect.closeTo(0,5)]);
  }
  const water=street.topHits(p.x+.84,p.z-12.61);expect(water).toEqual([expect.closeTo(POOL_WATER_Y,5)]);
  // At the ticket threshold a ceramic runner used to overlap the cross-joint
  // by 6 cm with the exact same top face, in both the city and pool room.
  const x=6.15+1.37,z=9.26;
  for(const hits of [street.topHits(p.x+x,p.z+z),pool.topHits(x,z)])expect(hits.filter(y=>y>.01)).toEqual([expect.closeTo(.019,5)]);
});

const routes:Record<CityVenue,readonly XZ[]>={
  clinic:[[14.8,53.8],[10.4,53.8],[10.4,52.04],[9.7,52.04],[9.3,53.82],[8.12,53.82]],
  classroom:[[33.04,59.49],[35.25,57.68],[36.80,56.29],[38.78,55.54],[39.97,54.64],[39.97,53.19]],
  pool:[[-24.22,80.4],[-24.22,75.70],[-24.22,71.12]],
  arcadeHall:[[29.12,86.8],[29.12,84.28],[29.12,82.65]],
};

it.each(Object.keys(routes) as CityVenue[])('walks the finished %s approach both ways through its doorway',venue=>{
  const f=fixture(),o=CITY_ORIGINS[venue],g=buildStreetGround(station);
  f.surface(g.paving);f.surface(g.earth);
  if(venue==='classroom'){
    f.surface(schoolBrickWalkGeometry(),o.x,o.z);f.batch([...campusPassageParts(),...schoolExterior()],o.x,o.z);
    expect(f.topHits(36.81,56.294)).toEqual([expect.closeTo(.012,5)]);
  }else if(venue==='clinic'){
    const parts=gardenEntranceParts(true);f.batch(parts.blocks,o.x,o.z);
    parts.herbs.dispose();parts.signs.dispose();
    expect(f.topHits(10.4,52.04)).toContainEqual(expect.closeTo(0,5));
    // A high ray just clips the green lintel trim before it reaches the wall.
    const from=new Vector3(8,3.02,53.81),to=new Vector3(10.28,.018,53.81);
    const ray=new Raycaster(from,to.clone().sub(from).normalize(),0,from.distanceTo(to));
    expect(ray.intersectObjects(f.root.children)[0].point.x).toBeCloseTo(8.45);
    expect(visiblePick(station,from,to.x,0,to.z)).toBe(false);
  }else if(venue==='pool'){
    f.batch([...arcadeParts(),...distantLido()],o.x,o.z);
  }else{
    f.batch(shell.map(b=>({p:[b.x,b.y,b.z],s:[b.w,b.h,b.d],color:b.ink})),o.x,o.z);
    for(const [room,offset] of [[station,{x:0,z:0}],[venue,o]] as const){
      const sight=(x:number,y:number,z:number)=>visiblePick(room,{x:x-offset.x,y,z:z-offset.z},29.10-offset.x,0,82-offset.z);
      expect(sight(23.77,1.56,86.42)).toBe(false); // through left jamb
      expect(sight(29.12,3.95,83.91)).toBe(false); // through the street lintel
      expect(sight(29.12,1.60,83.91)).toBe(true);
    }
  }
  const route=routes[venue],motor=createGroundMotor(),gate=new RoomGate(),body=groundedBody(route[0][0],0,route[0][1]);
  let room:typeof station|CityVenue=station;const entered:string[]=[];
  const sample:ReadColumn=(x,z,y,c)=>{
    c.floor=room===station?roomGround(station,x,z):roomGround(room,x-o.x,z-o.z);c.ceiling=Infinity;c.blocked=false;
    if(Number.isFinite(c.floor))f.columns.sample([f.root],x,z,y,c);
  };
  for(const [x,z] of [...route,...route.slice(0,-1).reverse()]){
    const n=Math.max(1,Math.ceil(Math.hypot(x-body.x,z-body.z)/.058)),dx=(x-body.x)/n,dz=(z-body.z)/n;
    for(let i=0;i<n;i++){
      motor.advance(body,sample,dx,dz,1/45,1.76,false);
      const inside:boolean=room!==station,u=body.x-(inside?o.x:0),v=body.z-(inside?o.z:0);
      expect(resolvePlacementHeight(room,u,v)).toBe(0);
      const link=gate.next(room,u,v);
      if(link){expect(link.to).toBe(inside?station:venue);room=inside?station:venue;entered.push(room);}
    }
    expect(Math.hypot(body.x-x,body.z-z),`${venue} stops before ${x},${z}`).toBeLessThan(.001);
    motor.advance(body,sample,0,0,.1,1.76,false); // settle off the 19 mm ceramic runner
    expect(body.grounded).toBe(true);expect(Math.abs(body.y)).toBeLessThan(.025);
  }
  expect(entered).toEqual([venue,station]);
  if(venue==='arcadeHall'){
    expect(motor.fits(sample,29.1,83.4,0,2.70)).toBe(false);
    expect(motor.fits(sample,29.1,83.4,0,2.52)).toBe(true);
  }
});

it('retains the sunken arcade lounge below street grade on both sides of its scene change',()=>{
  const o=CITY_ORIGINS.arcadeHall;
  for(const room of [station,'arcadeHall'] as const){
    const f=fixture(),g=buildStreetGround(room);f.surface(g.earth);f.surface(g.paving);
    const ray=new Raycaster(new Vector3(o.x-10.73,-.42,o.z+12),new Vector3(0,0,1),0,2);
    const hit=ray.intersectObjects(f.root.children);expect(hit).toHaveLength(1);expect(hit[0].point.z).toBeCloseTo(o.z+13);
  }
});
