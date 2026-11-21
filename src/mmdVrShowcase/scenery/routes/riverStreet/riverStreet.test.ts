import {expect,it} from 'vitest';
import {Group,Mesh,MeshStandardMaterial,PlaneGeometry,Raycaster,Vector3} from 'three';
import {roomGround} from '../../../movement/roomGround';
import {createGroundMotor,groundedBody} from '../../../movement/groundMotor';
import {createSolidColumns,type Column} from '../../../movement/solidColumns';
import {resolvePlacementHeight,roomPickDecks,visiblePick} from '../../placementAreas';
import {makeWeddingArchitecture} from '../../wedding/architectureHouse';
import {riverStreetExtension as street,riverStreetLinks as links} from './layout';
import {bridgeMark,gateX,laneZ,qinOffset,quayMark} from './plan';
import {makeRiverStreet} from './Street';

it('walks both room approaches with a standing column, in particular over the old lane edge and both ramp joints',()=>{
  const material=new MeshStandardMaterial();
  for(const day of [true,false]){
    const room=day?'weddingCourt':'qinhuai',root=new Group(),streetGroup=new Group(),geos=Object.values(makeRiverStreet(day));
    root.add(streetGroup);if(!day)streetGroup.position.set(qinOffset.x,0,qinOffset.z);
    for(const geometry of geos)streetGroup.add(new Mesh(geometry,material));
    // The old west-lane house occupied the bridge approach. Detect the
    // geometry, not merely whether the new support rule returns a number.
    if(day)for(const p of makeWeddingArchitecture())if(!p.foliage){root.add(new Mesh(p.geometry,material));geos.push(p.geometry);}else p.geometry.dispose();
    const path=day?[[.65,10.15],[.3,11.4],[-5.8,11.4],[-10.4,laneZ],[-17,laneZ],[gateX-.78,laneZ]]:
      [[.2,9.1],[4.8,7.65],[7.5,7.65],[11.6,7.65],[gateX+qinOffset.x+.78,7.65]];
    const solids=createSolidColumns(),motor=createGroundMotor(),body=groundedBody(path[0][0],0,path[0][1]);
    const sample=(x:number,z:number,y:number,c:Column)=>{c.floor=roomGround(room,x,z);c.blocked=false;c.ceiling=Infinity;solids.sample([root],x,z,y,c);};
    for(const [x,z] of [...path.slice(1),...path.slice(0,-1).reverse()]){
      const sx=body.x,sz=body.z,n=Math.ceil(Math.hypot(x-sx,z-sz)/.072);
      for(let i=0;i<n;i++)motor.advance(body,sample,(x-sx)/n,(z-sz)/n,.03,1.73,false);
      expect(body.x,`${room} stalled before ${x},${z}`).toBeCloseTo(x,4);expect(body.z).toBeCloseTo(z,4);
      expect(body.y).toBeCloseTo(roomGround(room,x,z),1);
    }
    solids.invalidate();geos.forEach(g=>g.dispose());
  }
  material.dispose();
});

it('overlaps translated walking support across the full width of each ground-level seam',()=>{
  for(const l of links){const mid=(l.band[0]+l.band[1])/2;
    for(const dz of [-1.30,0,1.30])for(const u of [-.43,0,.43]){
      expect(street.ground(l.from,l.gate+u,mid+dz)).toBe(0);
      expect(street.ground(l.to,l.gate+u+l.offset[0],mid+dz+l.offset[1])).toBe(0);
    }
    expect(resolvePlacementHeight(l.from,l.gate,mid,0)).toBeNull();
    const [x,y,z]=l.arrival.eye;expect(roomGround(l.to,x,z)).toBe(0);expect(resolvePlacementHeight(l.to,x,z,0)).toBe(0);expect(y).toBeGreaterThan(1.4);
  }
  expect(street.resolve('weddingCourt',0,-4.8,0)).toBeUndefined();
  expect(street.ground('qinhuai',0,-5.7)).toBeNull();
});

it('the first actual pick-plane hit accepts both dry portrait points but rejects water, the wrong height, slopes and shop furniture',()=>{
  for(const day of [true,false]){
    const room=day?'weddingCourt':'qinhuai',p=day?bridgeMark:{x:quayMark.x+qinOffset.x,y:0,z:quayMark.z+qinOffset.z};
    const [eyeX,eyeY,eyeZ]=links[day?1:0].arrival.eye,from=new Vector3(eyeX,eyeY,eyeZ);
    const material=new MeshStandardMaterial();
    const planes=roomPickDecks(room).map(r=>{const m=new Mesh(new PlaneGeometry(r.w,r.d),material);m.rotation.x=-Math.PI/2;m.position.set(r.x,r.y+.012,r.z);m.userData.y=r.y;m.updateMatrixWorld();return m;});
    const hit=new Raycaster(from,new Vector3(p.x,p.y+.012,p.z).sub(from).normalize()).intersectObjects(planes)[0];
    expect(hit.object.userData.y).toBe(p.y);
    expect(resolvePlacementHeight(room,hit.point.x,hit.point.z,p.y)).toBe(p.y);
    expect(visiblePick(room,from,hit.point.x,p.y,hit.point.z)).toBe(true);
    planes.forEach(m=>m.geometry.dispose());material.dispose();
  }
  for(const [room,x,y,z] of [['weddingCourt',-17,0,10.9],['weddingCourt',-17,0,13.4],['weddingCourt',-14,.252,10.45],
    ['weddingCourt',-10.9,0,8.60],['qinhuai',11.6,0,10.8],['qinhuai',13.92,0,4.22],['qinhuai',7.41,0,9.91]] as const){
    expect(resolvePlacementHeight(room,x,z,y)).toBeNull();
  }
});

it('the actual east rail has an opening, and sight accounts for bridge rail, posts, shop, lintel and raised masonry',()=>{
  const q=(x:number,y:number,z:number)=>({x,y,z});
  expect(visiblePick('qinhuai',q(6.36,1.48,7.7),11.6,0,8.10)).toBe(true);
  expect(visiblePick('qinhuai',q(7.1,.48,10.12),11.6,0,8.10)).toBe(false);
  expect(visiblePick('qinhuai',q(13.92,1.1,3.89),13.92,0,5.4)).toBe(false);
  // Through a newel, through the rail between newels, then through its open
  // interval and finally above the coping. The rail is not an opaque wall.
  expect(visiblePick('weddingCourt',q(-17.666,.99,12.48),-17.666,.42,10.90)).toBe(false);
  expect(visiblePick('weddingCourt',q(-17,1.37,12.48),-17,.42,10.90)).toBe(false);
  expect(visiblePick('weddingCourt',q(-17,.99,12.48),-17,.42,10.90)).toBe(true);
  expect(visiblePick('weddingCourt',q(-17,2.65,12.48),-17,.42,10.90)).toBe(true);
  expect(visiblePick('weddingCourt',q(-17,.2,11.1),-17,.42,10.90)).toBe(false);
  expect(visiblePick('weddingCourt',q(gateX-2.05,3.9,laneZ),-17,.42,10.9)).toBe(false);
});
