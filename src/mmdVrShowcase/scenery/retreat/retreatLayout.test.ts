import {describe,expect,it} from 'vitest';
import {Group,Mesh,MeshBasicMaterial} from 'three';
import {createSolidColumns,type Column} from '../../movement/solidColumns';
import {createGroundMotor,groundedBody} from '../../movement/groundMotor';
import {roomEntry,roomGround} from '../../movement/roomGround';
import {canPlaceInScenery} from '../placementAreas';
import {visiblePick} from '../pickDecks';
import {SPA,SUITE,type Retreat} from './retreatLayout';
import {buildSuite} from './suite';
import {buildSpa} from './spa';

describe('retreat room routes',()=>{
  it.each(['lanternSuite','moonSpa'] as const)('can walk from the entrance to the far portrait and jump back onto real dry floor in %s',room=>{
    const parts=room==='lanternSuite'?buildSuite():buildSpa(),root=new Group(),mat=new MeshBasicMaterial();
    for(const p of parts)root.add(new Mesh(p.geometry,mat));
    const cols=createSolidColumns(),sample=(x:number,z:number,foot:number,out:Column)=>{
      out.floor=roomGround(room,x,z);out.ceiling=Infinity;out.blocked=false;
      if(Number.isFinite(out.floor))cols.sample([root],x,z,foot,out);
    };
    const e=roomEntry(room),b=groundedBody(e.x,0,e.z),motor=createGroundMotor();
    const go=(x:number,z:number)=>{
      const n=Math.ceil(Math.hypot(x-b.x,z-b.z)/.08),dx=(x-b.x)/n,dz=(z-b.z)/n;
      for(let i=0;i<n;i++)motor.advance(b,sample,dx,dz,1/30,1.69,false);
    };
    try{
      expect(motor.fits(sample,b.x,b.z,0,1.69)).toBe(true);
      const points=room==='lanternSuite'?[[-.6,.95],[2.19,.95],[3.27,-1.23]]:[[1.73,.95],[1.72,-5.96],[.65,-6.12]];
      for(const [x,z] of points){go(x,z);expect(b.x).toBeCloseTo(x);expect(b.z).toBeCloseTo(z);}
      const h=b.y;motor.advance(b,sample,0,0,1/30,1.69,true);expect(b.y).toBeGreaterThan(h+.08);
      for(let i=0;i<58;i++)motor.advance(b,sample,0,0,1/45,1.69,false);expect(b.grounded).toBe(true);expect(b.y).toBeCloseTo(h);
      if(room==='lanternSuite'){go(-1,-1.23);expect(b.x).toBeGreaterThan(1.21);expect(b.x).toBeLessThan(1.50);}
      else {go(.65,-2);expect(b.z).toBeLessThan(-5.36);expect(b.z).toBeGreaterThan(-5.60);}
    } finally {cols.invalidate();mat.dispose();for(const p of parts)p.geometry.dispose();}
  });
  it('keeps two character spots in each composition while rejecting beds, the sunken pool and blocked sightlines',()=>{
    const cast=(room:Retreat,x:number,z:number,tx:number,tz:number)=>visiblePick(room,{x,y:1.32,z},tx,0,tz);
    for(const pair of [SUITE.pair,SUITE.windowPair,SPA.dryPair,SPA.poolPair]){
      const room=pair===SUITE.pair||pair===SUITE.windowPair?'lanternSuite':'moonSpa';
      expect(Math.hypot(pair[0][0]-pair[1][0],pair[0][1]-pair[1][1])).toBeGreaterThan(1.1);
      for(const [x,z] of pair)expect(canPlaceInScenery(room,x,z)).toBe(true);
    }
    for(const b of [SUITE.bed,SUITE.sofa,SUITE.tea,...SUITE.tables,...SUITE.divider])expect(canPlaceInScenery('lanternSuite',b.x,b.z)).toBe(false);
    for(const b of [SPA.bench,SPA.basin,SPA.locker,SPA.spout,...SPA.divider])expect(canPlaceInScenery('moonSpa',b.x,b.z)).toBe(false);
    expect(cast('lanternSuite',.20,-1.23,3.28,-1.23)).toBe(false);expect(cast('lanternSuite',.20,.98,2.85,.98)).toBe(true);
    expect(cast('moonSpa',-.35,2.38,-.35,-.32)).toBe(false);expect(cast('moonSpa',1.68,2.38,1.68,-.32)).toBe(true);
    expect(cast('moonSpa',1.68,-5.83,.66,-6.14)).toBe(true);
  });
});
