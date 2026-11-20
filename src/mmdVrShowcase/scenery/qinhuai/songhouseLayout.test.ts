import {expect,it} from 'vitest';
import {canPlaceInScenery,placementHeight} from '../placementAreas';
import {visiblePick} from '../pickDecks';
import {moveInSonghouse,SCREEN_ENTRY,SHOTS,songhouseClear,STAGE_Y,GALLERY_Y,XR_ENTRY} from './songhouseLayout';

it('walks the quay, enters through the façade, climbs the stage and returns up the outside stair',()=>{
  let pos=XR_ENTRY;
  for(const [x,z,y] of [[0,6,0],[0,0,0],[0,-5,STAGE_Y],[0,6,0],[0,9,0],[-7.23,9,0],[-7.23,5.32,GALLERY_Y/2],[-7.23,-1,GALLERY_Y],[-7.23,9,0],[4.95,9,0],[4.75,14.83,0]]){
    pos=moveInSonghouse(pos.x,pos.z,x-pos.x,z-pos.z);expect(pos.x).toBeCloseTo(x);expect(pos.z).toBeCloseTo(z);expect(placementHeight('qinhuai',x,z)).toBeCloseTo(y);
  }
  for(const [eye] of [SCREEN_ENTRY,...SHOTS.map(s=>[s.eye])])expect(songhouseClear(eye[0],eye[2])).toBe(true);
});
it('keeps visitors on supported floors and off stair cheeks, counters, the apron and balcony edge',()=>{
  expect(moveInSonghouse(0,8,0,8).z).toBeLessThan(10.7);
  expect(moveInSonghouse(-7,-1,4,0).x).toBeLessThan(-5.84);
  expect(moveInSonghouse(-2,-2.8,0,-2).z).toBeGreaterThan(-3.4);
  expect(moveInSonghouse(-7,5.5,4,0).x).toBeLessThan(-5.76);
  for(const [x,z] of [[2,13.1],[-7.25,5.5],[0,-3],[3.56,-.15],[3.08,.67],[-8.18,-2.4],[-4.2,-6.8],[5.64,.4]])expect(canPlaceInScenery('qinhuai',x,z)).toBe(false);
});
it('rejects pointing through the wrong floor, façade, tea table, gallery plinth and rail',()=>{
  const ray=(from:number[],x:number,y:number,z:number)=>visiblePick('qinhuai',{x:from[0],y:from[1],z:from[2]},x,y,z);
  expect(ray([0,1.45,8],0,0,1)).toBe(true);expect(ray([4.3,1.45,6],4.3,0,3)).toBe(false);
  expect(ray([3.6,1.33,1],3.6,0,-.78)).toBe(false);expect(ray([0,1.5,-1.8],0,STAGE_Y,-4.8)).toBe(true);
  expect(ray([0,1.45,-1.8],0,0,-4.8)).toBe(false);
  expect(ray([-6.78,4.1,-1],-6.75,GALLERY_Y,-3.4)).toBe(true);
  expect(ray([-6.78,4.1,-1],-6.75,0,-3.4)).toBe(false);
  expect(ray([0,8,-5.1],0,STAGE_Y,-5.1)).toBe(false);
  expect(ray([-6.8,4.05,-1],-5.10,0,-1)).toBe(false);
});
