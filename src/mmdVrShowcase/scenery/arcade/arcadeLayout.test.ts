import {expect,it} from 'vitest';
import {Group,InstancedMesh,BoxGeometry,MeshBasicMaterial,Matrix4} from 'three';
import {blocks,baseGround,arcadePassage,lowerPad,upperPad,UPPER,opening,frontLip,cladding,upperFrontZ,arcadeSight,arcadePlace} from './arcadeLayout';
import {createSolidColumns} from '../../movement/solidColumns';
import {createGroundMotor,groundedBody,type ReadColumn} from '../../movement/groundMotor';
import {roomPickDecks,visiblePick} from '../pickDecks';
import {canPlaceInScenery,placementHeight} from '../placementAreas';

const room='arcadeHall';
it('puts the lower doorway wall directly under the front edge of the east–west upper walk',()=>{
  const lowerWall=blocks.find(b=>b.tag==='wall'&&b.z>0&&Math.abs(b.x)<b.w/2&&b.y<UPPER)!;
  expect(lowerWall.z+cladding).toBeCloseTo(frontLip,6);
  expect(frontLip-upperFrontZ-cladding).toBeCloseTo(2,6);
  for(let x=-8.28;x<9.8;x+=.10)expect(arcadePlace(x,UPPER,frontLip-.88),String(x)).toBe(true);
  for(const x of [-2.35,2.35])expect(arcadeSight({x,y:1.45,z:frontLip+1.5},x,0,upperFrontZ+.35)).toBe(true);
  expect(arcadeSight({x:0,y:1.45,z:frontLip+1.5},0,0,upperFrontZ+.35)).toBe(false);
  expect(arcadeSight({x:0,y:1.45,z:2.9},0,0,frontLip-.65)).toBe(true);
});
it('has two independently addressable feet, with different occluders, at the same XZ',()=>{
  for(const y of [0,UPPER]){
    expect(roomPickDecks(room).some(r=>Math.abs(r.y-y)<.001&&Math.abs(r.x-.65)<r.w/2&&Math.abs(r.z-2.83)<r.d/2)).toBe(true);
    expect(canPlaceInScenery(room,.65,2.83,y)).toBe(true);expect(placementHeight(room,.65,2.83,y)).toBe(y);
    expect(visiblePick(room,{x:.65,y:y+1.4,z:3.48},.65,y,2.83)).toBe(true);
  }
  expect(canPlaceInScenery(room,.65,2.83,.9)).toBe(false);
  expect(canPlaceInScenery(room,2.24,1.94,0)).toBe(false);expect(canPlaceInScenery(room,2.24,1.94,UPPER)).toBe(true);
  expect(canPlaceInScenery(room,.1,.1,UPPER)).toBe(false);expect(canPlaceInScenery(room,.1,.1,0)).toBe(true);
  expect(visiblePick(room,{x:.65,y:5,z:2.83},.65,0,2.83)).toBe(false);
  expect(visiblePick(room,{x:.65,y:4,z:1},.65,0,3.54)).toBe(false);
  expect(visiblePick(room,{x:.65,y:4,z:.7},.65,0,.7)).toBe(true);
  for(const y of [0,UPPER])expect(visiblePick(room,{x:0,y:y+.92,z:.7},0,y,-3.2)).toBe(false);
});

it('passes through the aperture, keeps a marginal foot supported, then falls only after leaving the lip',()=>{
  const root=new Group(),mesh=new InstancedMesh(new BoxGeometry(),new MeshBasicMaterial(),blocks.length);
  blocks.forEach((b,i)=>mesh.setMatrixAt(i,new Matrix4().makeScale(b.w,b.h,b.d).setPosition(b.x,b.y,b.z)));root.add(mesh);
  const solids=createSolidColumns(),motor=createGroundMotor(),sample:ReadColumn=(x,z,foot,c)=>{Object.assign(c,{floor:baseGround(x,z),ceiling:Infinity,blocked:false});solids.sample([root],x,z,foot,c);};
  const fits=(x:number,y:number,z:number)=>motor.fits(sample,x,z,y,1.75);
  expect(arcadePassage(lowerPad,fits)).toEqual(upperPad);expect(arcadePassage(upperPad,fits)).toEqual(lowerPad);
  expect(arcadePassage({...lowerPad,x:3},fits)).toBeNull();
  expect(arcadePassage(lowerPad,(x,y,z)=>fits(x,y,z)&&y<2.1)).toBeNull();
  const body=groundedBody(upperPad.x,UPPER,opening.front-.05);
  for(let i=0;i<40;i++)motor.advance(body,sample,.025,0,1/60,1.75,false);expect(body.y).toBeCloseTo(UPPER);
  for(let i=0;i<100;i++)motor.advance(body,sample,0,i<16?-.035:0,1/60,1.75,false);expect(body.y).toBeCloseTo(0);
  solids.invalidate();mesh.geometry.dispose();(mesh.material as MeshBasicMaterial).dispose();mesh.dispose();
});
