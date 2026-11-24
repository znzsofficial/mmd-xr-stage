import {expect,it} from 'vitest';
import {canPlaceInScenery,resolvePlacementHeight,visiblePick} from '../placementAreas';
import {BED,BED_STEP,DOOR_X,DOOR_Z,DRESSER,DRESSING_STOOL,moveInSonghouse,PRIVATE_SPOTS,SCREEN_ENTRY,SHOTS,songhouseClear,songhouseHeight,songhouseSightline,STAGE_Y,GALLERY_Y,XR_ENTRY} from './songhouseLayout';
import {chamberLeaves,folio,leafXZ,screenBody} from './chamberFolio';

it('walks the quay, enters through the façade, climbs the stage and returns up the outside stair',()=>{
  let pos=XR_ENTRY;
  for(const [x,z,y] of [[0,6,0],[0,0,0],[0,-5,STAGE_Y],[0,6,0],[0,9,0],[-7.23,9,0],[-7.23,5.32,GALLERY_Y/2],[-7.23,-1,GALLERY_Y],[-7.23,9,0],[4.95,9,0],[4.75,14.83,0]]){
    pos=moveInSonghouse(pos.x,pos.z,x-pos.x,z-pos.z);expect(pos.x).toBeCloseTo(x);expect(pos.z).toBeCloseTo(z);expect(songhouseHeight(x,z)).toBeCloseTo(y);
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
it('keeps the wrapped post out of the pier slot and out of a grazing placement ray',()=>{
  expect(canPlaceInScenery('qinhuai',4.23,12.18)).toBe(false);
  expect(canPlaceInScenery('qinhuai',4.8,12.18)).toBe(true);
  expect(canPlaceInScenery('qinhuai',4.04,-6.70)).toBe(false);
  expect(visiblePick('qinhuai',{x:3.97,y:.64,z:12.48},3.97,0,11.57)).toBe(false);
});

it('reaches both sides of the private chamber via the original stairs and listening gallery, and can walk back',()=>{
  let p=XR_ENTRY;
  for(const [x,z] of [[0,9],[-7.25,9],[-7.25,2],[-7.25,-4],[DOOR_X,DOOR_Z],...PRIVATE_SPOTS,[DOOR_X,-9],[DOOR_X,-6],[DOOR_X,9],[0,9]]){
    p=moveInSonghouse(p.x,p.z,x-p.x,z-p.z);expect(p.x).toBeCloseTo(x);expect(p.z).toBeCloseTo(z);
  }
  for(const [x,z] of PRIVATE_SPOTS){expect(canPlaceInScenery('qinhuai',x,z)).toBe(true);expect(resolvePlacementHeight('qinhuai',x,z)).toBe(GALLERY_Y);}
  for(const {x,z} of [BED,BED_STEP,DRESSER,DRESSING_STOOL])expect(canPlaceInScenery('qinhuai',x,z)).toBe(false);
  expect(moveInSonghouse(-6.36,-7.15,0,-1.5).z).toBeGreaterThan(DOOR_Z);
});

it('admits a ray through the open leaves, not through the jamb, bed, roof or lower plane',()=>{
  const ray=(ox:number,oy:number,oz:number,x:number,z:number,y=GALLERY_Y)=>visiblePick('qinhuai',{x:ox,y:oy,z:oz},x,y,z);
  expect(ray(-7.28,4.03,-6.24,...PRIVATE_SPOTS[0])).toBe(true);
  expect(ray(-8.31,4.03,-6.78,...PRIVATE_SPOTS[1])).toBe(false);
  for(const [x,z] of PRIVATE_SPOTS){expect(ray(-7.40,4.05,-8.59,x,z)).toBe(true);expect(ray(x,4.05,z,x,z,0)).toBe(false);}
  expect(ray(BED.x,4.02,-11.44,BED.x,-14.01)).toBe(false);
  expect(ray(-9.21,4.08,-13.33,-11.39,-13.53)).toBe(false);
  expect(ray(-10.13,7.2,-10.77,...PRIVATE_SPOTS[1])).toBe(false);
});

it('reads the front of every folded silk leaf from the doorway and cannot walk, place, or point through it',()=>{
  for(const l of chamberLeaves){
    const pt=(n:number,y:number)=>{const [x,z]=leafXZ(l,0,n);return {x,y:GALLERY_Y+y,z};};
    expect(songhouseSightline({x:DOOR_X,y:GALLERY_Y+1.62,z:DOOR_Z-.26},pt(.030,1.19))).toBe(true);
    expect(songhouseClear(l.x,l.z)).toBe(false);expect(canPlaceInScenery('qinhuai',l.x,l.z)).toBe(false);
    expect(songhouseSightline(pt(.14,1.3),pt(-.14,1.28))).toBe(false);
    expect(songhouseSightline(pt(.10,screenBody.top+.06),pt(-.10,screenBody.top+.06))).toBe(true);
    expect(songhouseSightline(pt(.10,.08),pt(-.10,.08))).toBe(true); // between the feet
  }
});

it('picks the open illustrated pages over the desk, but not through the cabinet, chamber wall or the back of the book',()=>{
  const to={x:DRESSER.x+folio.offsetX,y:GALLERY_Y+folio.height+.002,z:DRESSER.z+folio.offsetZ};
  const [x,y,z]=SHOTS.find(s=>s.key==='qinhuaiAlbum')!.eye;
  expect(songhouseSightline({x,y,z},to)).toBe(true);
  expect(songhouseSightline({...to,y:to.y-.33,z:to.z+.24},to)).toBe(false);
  expect(songhouseSightline({x:-8.02,y:4.04,z:-6.30},to)).toBe(false);
  expect(songhouseSightline({...to,y:to.y-.031,z:to.z-.020},to)).toBe(false);
});
