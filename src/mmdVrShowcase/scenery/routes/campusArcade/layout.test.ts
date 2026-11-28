import {expect,it} from 'vitest';
import {BoxGeometry,DoubleSide,Euler,Group,InstancedMesh,Matrix4,Mesh,MeshBasicMaterial,Raycaster,Vector3} from 'three';
import {createSolidColumns} from '../../../movement/solidColumns';
import {createGroundMotor,groundedBody,type ReadColumn} from '../../../movement/groundMotor';
import {blocks} from '../../arcade/arcadeLayout';
import {baseGround} from '../../arcade/arcadeTravel';
import {POOL_ORIGIN as P,POOL_SUPPORT,poolBarrierParts} from '../../LidoLayout';
import {campusArcadeExtension as ext,campusArcadeLinks as links,siteOrigin,type TimingWalkRoom} from './layout';
import {profiles} from './geometry';
import {bodies} from './pieces';
import {orientedMember} from './sight';

it('clips to rotated finish-frame members, including yaw; their enclosing boxes are not opaque',()=>{
  const p={p:[.3,1.5,2.4] as [number,number,number],s:[.10,2,.15] as [number,number,number],color:'#888',rx:.53,ry:-.74,rz:.85};
  const hit=orientedMember(p,P),g=new BoxGeometry(...p.s),mat=new MeshBasicMaterial({side:DoubleSide}),m=new Mesh(g,mat);
  m.position.fromArray(p.p).add(new Vector3(P.x,0,P.z));m.rotation.copy(new Euler(p.rx,p.ry,p.rz));m.updateMatrixWorld();
  const ray=new Raycaster(),dir=new Vector3(.27,-.09,-1).normalize();let hits=0;
  for(let i=-6;i<=6;i++)for(let j=-6;j<=6;j++){
    const a=m.position.clone().add(new Vector3(i/6-.54,j/6+.18,2)),b=a.clone().addScaledVector(dir,4);
    ray.set(a,dir);ray.far=4;const real=ray.intersectObject(m).length>0;expect(hit(a,b)).toBe(real);if(real)hits++;
  }expect(hits).toBeGreaterThan(2);expect(hits).toBeLessThan(30);g.dispose();mat.dispose();
});

it('supports both viaduct thresholds and the translated feet in their arrival rooms',()=>{
  expect(links).toHaveLength(2);
  for(const l of links){const reverse=links.find(m=>m.to===l.from&&m.from===l.to)!;
    expect(l.axis).toBe('x');expect(l.gate+l.offset[0]).not.toBeCloseTo(reverse.gate);
    for(const k of [0,1])expect(l.offset[k]+reverse.offset[k]).toBeCloseTo(0);
    for(const inset of [.20,.5,.8]){const z=l.band[0]+inset*(l.band[1]-l.band[0]);
      expect(ext.ground(l.from,l.gate,z)).toBe(0);expect(ext.ground(l.to,l.gate+l.offset[0],z+l.offset[1])).toBe(0);}
  }
});

it('places a whole foot on the gallery overlook and pool apron, with clock and rail occlusion',()=>{
  for(const [room,x,y,z,dx,dz] of [['arcadeHall',-7.84,2.05,-24.15,0,2.4],['pool',11.4,0,-19.25,1.6,0]] as const){
    expect(ext.resolve(room,x,z,y)).toBe(y);expect(ext.visible(room,{x:x+dx,y:y+1.58,z:z+dz},x,y,z)).toBe(true);
    expect(ext.resolve(room,x,z,y+.14)).toBeNull();
  }
  expect(ext.visible('arcadeHall',{x:-7.84,y:3.42,z:-23.3},-4.8,2.05,-24.65)).toBe(false);
  expect(ext.visible('pool',{x:4.77,y:2.47,z:-20.43},4.77,0,-22.4)).toBe(false);
  expect(ext.visible('pool',{x:6.22,y:1.63,z:-18.48},5.8,0,-20.42)).toBe(true);
  expect(ext.resolve('arcadeHall',-7.84,-14,0)).toBeNull(); // ramp ray cannot land at ground zero
  expect(ext.resolve('arcadeHall',0,.7,3.4)).toBeUndefined();expect(ext.resolve('arcadeHall',.65,2.83,0)).toBeUndefined();
  expect(ext.resolve('pool',0,-12.4,0)).toBeUndefined();
  expect(ext.decks('pool').filter(d=>!d.y)).toEqual([]);
  const overlook=ext.decks('arcadeHall').find(d=>d.y===2.05&&Math.abs(d.x+7.84)<d.w/2&&Math.abs(d.z+24.15)<d.d/2);
  expect(overlook).toBeDefined();
});

function motorWalk(room:TimingWalkRoom,start:readonly [number,number,number],waypoints:readonly (readonly [number,number])[]){
  const o=siteOrigin(room),material=new MeshBasicMaterial(),geo=profiles(bodies),root=new Group(),mesh=new Mesh(geo,material);mesh.position.set(-o.x,0,-o.z);root.add(mesh);
  const boxes=room==='arcadeHall'?blocks.map(p=>[p.x,p.y,p.z,p.w,p.h,p.d]):[
    ...poolBarrierParts().map(p=>[...p.p,...p.s]),...POOL_SUPPORT.map(r=>[r.x,-.125,r.z,r.w,.25,r.d])
  ];
  const box=new BoxGeometry(),walls=new InstancedMesh(box,material,boxes.length);boxes.forEach(([x,y,z,w,h,d],i)=>walls.setMatrixAt(i,new Matrix4().makeScale(w,h,d).setPosition(x,y,z)));root.add(walls);
  const solid=createSolidColumns(),motor=createGroundMotor(),b=groundedBody(...start);
  const sample:ReadColumn=(x,z,y,c)=>{c.blocked=false;c.ceiling=Infinity;
    c.floor=ext.ground(room,x,z)??(room==='arcadeHall'?baseGround(x,z):POOL_SUPPORT.some(r=>Math.abs(x-r.x)<=r.w/2&&Math.abs(z-r.z)<=r.d/2)?0:-Infinity);
    if(Number.isFinite(c.floor))solid.sample([root],x,z,y,c);
  };
  try{for(const [x,z] of waypoints){const n=Math.ceil(Math.hypot(x-b.x,z-b.z)/.08),dx=(x-b.x)/n,dz=(z-b.z)/n;
    for(let i=0;i<n;i++)motor.advance(b,sample,dx,dz,1/45,1.85,false);
    expect([b.x,b.z],`${room}: foot ${b.x}, ${b.y}, ${b.z} target ${x},${z}`).toEqual([expect.closeTo(x,4),expect.closeTo(z,4)]);
  }return b.y;}finally{solid.invalidate();geo.dispose();box.dispose();walls.dispose();material.dispose();}
}
it('walks the rendered west lane, outside stair, upper gallery, three grades and real pool fence gap, both ways',()=>{
  const arcadePath=[[9.1,11.9],[9.1,4.8],[8.3,2.9],[8.3,-5.03],[10.255,-5.03],[10.255,2.1],[10.255,5.65],[-7.84,5.65],[-7.84,-6.4],[-7.84,-24.15],[-37.85,-24.15]] as const;
  expect(motorWalk('arcadeHall',[9.1,0,14.2],arcadePath)).toBeCloseTo(0,2);
  expect(motorWalk('arcadeHall',[-37.85,0,-24.15],[...arcadePath.slice(0,-1).reverse(),[9.1,15.4]])).toBeCloseTo(0,2);
  expect(motorWalk('pool',[13.45,0,-19.25],[[7.2,-19.25],[5.8,-19.25],[5.8,-20.42],[5.8,-19.25],[14,-19.25]])).toBeCloseTo(0,2);
});
