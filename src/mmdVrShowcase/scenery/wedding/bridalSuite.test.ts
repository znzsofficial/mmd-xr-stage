import {expect,it} from 'vitest';
import {Group,Mesh,MeshBasicMaterial,Vector3} from 'three';
import {createSolidColumns} from '../../movement/solidColumns';
import {makeWeddingArchitecture} from './architectureHouse';
import {makeBridalBed,makeBridalTrunk,makeWeddingCups} from './bridalFurniture';
import {BED,CUP_TABLE,TRUNK,bindDrapes,curtainTrack,type Draw} from './bridalLayout';
import {WEDDING_MARKS,WEDDING_SHOTS,weddingClear,weddingVisible,moveInWedding} from './weddingLayout';

it('walks through both built doorways at standing height into the bay, to the wine table, and back',()=>{
  const root=new Group(),mat=new MeshBasicMaterial(),columns=createSolidColumns();
  for(const {geometry,foliage} of makeWeddingArchitecture()){
    if(foliage){geometry.dispose();continue;}
    root.add(new Mesh(geometry,mat));
  }
  for(const [anchor,piece] of [[BED,makeBridalBed()],[TRUNK,makeBridalTrunk()],[CUP_TABLE,makeWeddingCups()]] as const){
    for(const g of Object.values(piece))if(g){const mesh=new Mesh(g,mat);mesh.position.set(anchor.x,0,anchor.z);root.add(mesh);}
  }
  let x=4.68,z=-4.90;
  const cup=WEDDING_SHOTS.find(s=>s.key==='weddingCups')!.eye;
  const through=[[8.8,-4.90],[11.60,-5.20],[BED.x,-5.36],[BED.x,-7.10],[BED.x,-5.36],[cup[0],cup[2]]];
  try{
    for(const [toX,toZ] of [...through,...through.slice().reverse(),[4.68,-4.90]]){
      const dx=toX-x,dz=toZ-z,n=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.09));
      for(let i=1;i<=n;i++){
        const px=x+dx*i/n,pz=z+dz*i/n;
        expect(weddingClear(px,pz),`layout at ${px},${pz}`).toBe(true);
        const c={floor:0,ceiling:Infinity,blocked:false};columns.sample([root],px,pz,0,c);
        expect(c.blocked||c.floor>.06||c.ceiling-c.floor<1.83,`built clearance at ${px},${pz}: ${JSON.stringify(c)}`).toBe(false);
      }x=toX;z=toZ;
    }
  }finally{columns.invalidate();root.children.forEach(m=>(m as Mesh).geometry.dispose());mat.dispose();}
});

it('each actual curtain track independently stops walking and the ground ray; openings follow the drawn width',()=>{
  const far=WEDDING_MARKS.bridalBay,from={x:far.x,y:1.36,z:-4.98},z=curtainTrack('silk');
  const draw:Draw={silk:0,gauze:0},end=bindDrapes(draw);
  try{
    for(const k of ['silk','gauze'] as const){
      draw[k]=1;expect(weddingVisible(from,far.x,far.z)).toBe(false);
      expect(weddingClear(far.x,far.z,true)).toBe(true);
      expect(moveInWedding(from.x,from.z,0,-2.2).z).toBeGreaterThan(curtainTrack(k));
      draw[k]=.46;expect(weddingVisible(from,far.x,far.z)).toBe(true);
      expect(weddingClear(far.x+.87,curtainTrack(k))).toBe(false);expect(weddingClear(far.x,curtainTrack(k))).toBe(true);
      draw[k]=0;expect(weddingVisible(from,far.x,far.z)).toBe(true);
      expect(moveInWedding(from.x,from.z,0,far.z-from.z).z).toBeCloseTo(far.z);
      // Never leave an actor across the curtain's future sweep.
      expect(weddingClear(far.x,z,true)).toBe(false);
    }
    draw.silk=draw.gauze=1;
  }finally{end();}
  expect(weddingVisible(from,far.x,far.z)).toBe(true);
});

it('keeps the near and far actor marks off furniture, and rejects the same ground when aimed through plaster',()=>{
  const near=WEDDING_MARKS.bridalNear,far=WEDDING_MARKS.bridalBay;
  expect(weddingVisible({x:8.75,y:1.58,z:-4.90},near.x,near.z)).toBe(true);
  expect(weddingVisible({x:8.75,y:1.58,z:-7.25},near.x,near.z)).toBe(false);
  const door=WEDDING_SHOTS.find(s=>s.key==='weddingBridalDoor')!.eye;
  expect(weddingVisible(new Vector3(...door),near.x,near.z)).toBe(true);
  for(const a of [near,far])expect(weddingClear(a.x,a.z,true)).toBe(true);
  for(const a of [BED,CUP_TABLE,TRUNK])expect(weddingClear(a.x,a.z,true)).toBe(false);
  const eye=WEDDING_SHOTS.find(s=>s.key==='weddingBridal')!.eye;
  expect(weddingVisible(new Vector3(...eye),far.x,far.z)).toBe(true);
});
