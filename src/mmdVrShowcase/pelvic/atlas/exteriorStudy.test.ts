import {expect,it} from 'vitest';
import {Matrix4,Vector3} from 'three';
import {pelvicRailMatrix,rod} from '../path';
import {createPelvicSolver} from '../solver';
import {pelvicSeal} from '../geometry';
import {fitSite,readCut,vulvaHalves} from '../vulvaForm';
import {observedCut} from './exteriorStudy';

it('fits the observed folds to the same measured shaft cut as the stage, and closes them on interrupted tracking or a parked position',()=>{
  const f={world:new Matrix4(),inverse:new Matrix4(),lengthM:.09,radiusM:.024,scale:1};
  const solver=createPelvicSolver(),input={dt:1/72,blocked:false},pose=(d:number)=>{const m=pelvicRailMatrix(f,d);m.elements[12]+=.001;return m;};
  for(let i=-25;i<33;i++)solver.step(f,pose(i/1000),input);
  const contact=solver.step(f,pose(.033),input);expect(contact.outletInside).toBe(true);expect(contact.shaftLocal).toHaveLength(rod.length);
  const s={tip:contact.outletLocal.toArray(),tail:contact.shaftLocal[0].toArray(),shaft:contact.shaftLocal.map(p=>p.toArray()),
    outletInside:contact.outletInside,outletVisible:contact.outletVisible,depth:contact.depthM,aligned:true,angleDeg:0,atCervix:false,radiusM:f.radiusM,lengthM:f.lengthM};
  const actual=observedCut(s),expected={x:0,y:0,xx:0,xy:0,yx:0,yy:0};readCut(pelvicSeal(f,contact,true)!.lip,f.radiusM,expected);
  const site=vulvaHalves[1].rows[24].sites[0];
  const measured=new Vector3(),pictured=new Vector3();fitSite(site,f.radiusM,expected,measured);fitSite(site,1,actual,pictured);pictured.multiplyScalar(f.radiusM);
  expect(measured.distanceTo(pictured)).toBeLessThan(1e-8);expect(actual.xx).toBeGreaterThan(.1);
  for(const cut of [observedCut(null),observedCut(s,true),observedCut({...s,outletInside:false}),observedCut({...s,shaft:undefined})])expect(cut).toEqual({x:0,y:0,xx:0,xy:0,yx:0,yy:0});
});
