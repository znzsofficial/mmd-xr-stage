import { expect,it } from 'vitest';
import { canPlaceInClinic as place, canWalkInClinic as walk, clinicPlacementVisible as visible, moveInClinic, CLINIC_SHOTS, CLINIC_VIEW, FIXTURES, DOORS } from './clinicLayout';

it('reaches each named shot and a placeable actor mark from the waiting hall via the actual opening',()=>{
  const routes = [
    [[0,.9],[-3.1,.9],[-3.12,2.34]], // consultation room
    [[0,-3.45],[3.24,-3.45],[3.24,-1.78]], // operating theatre
    [[0,-6.30],[-2.83,-6.30],[-2.83,-6.50]], // wash lobby
    [[0,2.6],[5.2,2.6]], // accessible waiting bay
  ];
  for(const path of routes){
    let pos={x:0,z:2.8};
    for(const [x,z] of path){pos=moveInClinic(pos.x,pos.z,x-pos.x,z-pos.z);expect(pos.x).toBeCloseTo(x,4);expect(pos.z).toBeCloseTo(z,4);}
    expect(place(pos.x,pos.z)).toBe(true);
  }
  for(const [x,,z] of [CLINIC_VIEW[0],...CLINIC_SHOTS.map(s=>s.eye)])expect(walk(x,z)).toBe(true);
  for(const {x,z,width} of Object.values(DOORS)){expect(walk(x,z)).toBe(true);expect(place(x,z+width/2)).toBe(false);}
  expect(place(0,0)).toBe(true);
});
it('slides along the divider but cannot jump the divider, outside wall or table in one long input frame',()=>{
  expect(moveInClinic(0,-1,-6,0).x).toBeGreaterThan(-2);
  const slide=moveInClinic(-1.6,-.85,-1,-.9);expect(slide.x).toBeGreaterThan(-2);expect(slide.z).toBeCloseTo(-1.75,4);
  expect(moveInClinic(5.83,-2.10,0,-5).z).toBeGreaterThan(-3.7);
  expect(moveInClinic(0,2.7,0,12).z).toBeLessThan(4.8);
  for(const f of Object.values(FIXTURES))expect(place(f.x,f.z)).toBe(false);
  for(const p of [[Infinity,0],[0,NaN],[8.65,0],[-3,-9]])expect(place(p[0],p[1])).toBe(false);
});
it('keeps both stalls free of placed actors; only the unlatched one has a walking entrance',()=>{
  expect(moveInClinic(-5.6,-7.69,-1.53,0).x).toBeCloseTo(-7.13,4);
  expect(place(-7.13,-7.69)).toBe(false);
  expect(moveInClinic(-5.6,-5.50,-1.53,0).x).toBeGreaterThan(-6.4);
  expect(place(-7.13,-5.50)).toBe(false);
});
it('blocks aiming through the side wall while accepting the same open room through its doorway',()=>{
  const mark={x:3.65,z:-3.45};expect(place(mark.x,mark.z)).toBe(true);
  expect(visible({x:0,y:1.6,z:.7},mark.x,mark.z)).toBe(false);
  expect(visible({x:0,y:1.6,z:-3.45},mark.x,mark.z)).toBe(true);
  expect(visible({x:5.83,y:1.55,z:-3.26},5.83,-7.25)).toBe(false);
});
