import { describe, expect, it } from 'vitest';
import { sceneryIds } from './catalog';
import { canPlaceInScenery } from './placementAreas';
import { ARBOR, ARBOR_POSTS, MEADOW_POSTS, MEADOW_SEAT } from './meadowLandmarks';
import { LAWN_KNOLLS, LAWN_TREES } from './meadowPlanting';
import { BACKLINE, WEDGES } from './stageLayouts';
import { POOL } from './LidoLayout';
import { CLASS_FIXTURES, ROOM } from './ClassroomLayout';
import { COURT_PIERS, OLD_COURT_RADIUS as COURT_RADIUS, ROUTE_FEET } from './ObservatoryLayout';
import { CHAPEL_DAIS, CHAPEL_PEWS, CHAPEL_PIERS } from './ChapelLayout';

describe('placeable ground at foot height', () => {
  it('preserves the chapel portrait and procession lanes but rejects pews, pier feet, steps and positions beyond the walls',()=>{
    for(let z=-5.26;z<7.8;z+=.15)for(const x of [-4.8,-.85,0,.85,4.8])expect(canPlaceInScenery('chapel',x,z)).toBe(true);
    for(const {x,z} of [...CHAPEL_PEWS,...CHAPEL_PIERS,CHAPEL_DAIS])expect(canPlaceInScenery('chapel',x,z)).toBe(false);
    for(const [x,z] of [[1.49,-2.4],[0,-5.52],[5.68,1.5],[2.9,9.01]])expect(canPlaceInScenery('chapel',x,z)).toBe(false);
  });
  it('lets actors pass through the opened chapel door and around the water garden, but not through its masonry or planting',()=>{
    for(let z=6;z<20;z+=.125)for(const x of [-.88,0,.88])expect(canPlaceInScenery('chapel',x,z)).toBe(true);
    for(let z=12;z<32;z+=.25)expect(canPlaceInScenery('chapel',3.25,z)).toBe(true);
    for(const [x,z] of [[1.55,9.85],[4,9],[0,24],[6.35,15],[-12.65,20],[9.7,-1],[0,33.1],[-14,18]])expect(canPlaceInScenery('chapel',x,z)).toBe(false);
    expect(canPlaceInScenery('chapel',-11.15,22)).toBe(true);
  });
  it('leaves clear space under the broken arch but excludes the feet of every pier and the floating rim',()=>{
    for(const {x,z} of COURT_PIERS)expect(canPlaceInScenery('astralCourt',x,z)).toBe(false);
    for(const z of [-5,-4.3,-2,0,3])expect(canPlaceInScenery('astralCourt',0,z)).toBe(true);
    expect(canPlaceInScenery('astralCourt',0,COURT_RADIUS-.05)).toBe(false);
  });
  it.each(sceneryIds)('has a usable origin and rejects invalid space in %s', id => {
    expect(canPlaceInScenery(id,0,0)).toBe(true);
    for(const [x,z] of [[NaN,0],[0,Infinity],[100,100]]) expect(canPlaceInScenery(id,x,z)).toBe(false);
  });
  it('connects the gate, crossing and three distant terraces with continuous shoe room, but not the sky between islands',()=>{
    const allowed=(x:number,z:number)=>canPlaceInScenery('astralCourt',x,z);
    for(let z=0;z>=-43;z-=.125)expect(allowed(.32,z)).toBe(true);
    for(let x=-26;x<=26;x+=.125)expect(allowed(x,-19.7)).toBe(true);
    for(const p of ROUTE_FEET)expect(allowed(p.x,p.z)).toBe(false);
    for(const [x,z] of [[1.65,-13],[3,-30],[10,-12],[10,-27],[0,-46.16],[-28.78,-20],[23,-12]])expect(allowed(x,z)).toBe(false);
  });
  it('leaves a continuous centre aisle and a window lane; the teaching and student furniture remains occupied', () => {
    for(let z=-4.8;z<4.7;z+=.15) for(const x of [-4.55,-1.15,0,1.15]) expect(canPlaceInScenery('classroom',x,z)).toBe(true);
    for(const f of CLASS_FIXTURES) expect(canPlaceInScenery('classroom',f.x,f.z)).toBe(false);
    expect(canPlaceInScenery('classroom',-ROOM.w/2+.06,0)).toBe(false);
    expect(canPlaceInScenery('classroom',0,-ROOM.d/2+.06)).toBe(false);
    expect(canPlaceInScenery('classroom',-.70,-ROOM.d/2+.285)).toBe(false);
  });
  it('distinguishes the pool surround, water, ladder, starting blocks and lower ground beyond the terrace', () => {
    for(const [x,z] of [[0,-12],[4.94,-6],[0,-18.87],[-4.34,-5.47],[-1.65,-19.42],[7.13,-12.6],[9,-12],[12,0]])
      expect(canPlaceInScenery('pool',x,z),`blocked ${x},${z}`).toBe(false);
    for(const [x,z] of [[0,-5.42],[6,-12],[-6,-5.71],[.2,-19.56],[9,0]])
      expect(canPlaceInScenery('pool',x,z),`deck ${x},${z}`).toBe(true);
  });
  it('uses the round simple deck and excludes the backline of the live stage', () => {
    expect(canPlaceInScenery('floor',7,0)).toBe(true);
    expect(canPlaceInScenery('floor',6,6)).toBe(false);
    for(const [x,z] of [[4.55,-3.88],[-4.55,-3.88],[0,-5.32],[5.13,-4.49],[6,0]]) expect(canPlaceInScenery('liveHouse',x,z)).toBe(false);
    expect(canPlaceInScenery('liveHouse',2,-4.65)).toBe(true);
    expect(canPlaceInScenery('liveHouse',-3.3,-3.62)).toBe(true);
  });
  it('rejects the raised parts of the meadow while preserving the grassy clearing', () => {
    for(const f of [...LAWN_TREES,...LAWN_KNOLLS]) expect(canPlaceInScenery('lawn',f.x,f.z)).toBe(false);
    for(const [x,z] of [[3,-2],[-2.5,3],[0,-3.5]]) expect(canPlaceInScenery('lawn',x,z)).toBe(true);
  });
  it('keeps the new near-field furniture and fence out of backpack footprints while leaving viewing positions open', () => {
    for(const f of ARBOR_POSTS)expect(canPlaceInScenery('lawn',f.x,f.z)).toBe(false);
    expect(canPlaceInScenery('lawn',ARBOR.x,ARBOR.z)).toBe(true);
    for(const f of Object.values(BACKLINE))expect(canPlaceInScenery('liveHouse',f.x,f.z)).toBe(false);
    for(const f of [POOL.rescue,...POOL.flagPosts])expect(canPlaceInScenery('pool',f.x,f.z)).toBe(false);
    for(const fixture of [...POOL.loungers,...POOL.parasols])expect(canPlaceInScenery('pool',fixture.x,fixture.z)).toBe(false);
    for(const fixture of WEDGES)expect(canPlaceInScenery('liveHouse',fixture.x,fixture.z)).toBe(false);
    expect(canPlaceInScenery('lawn',MEADOW_SEAT.x,MEADOW_SEAT.z)).toBe(false);
    for(let i=1;i<MEADOW_POSTS.length;i++) {const a=MEADOW_POSTS[i-1],b=MEADOW_POSTS[i];expect(canPlaceInScenery('lawn',(a.x+b.x)/2,(a.z+b.z)/2)).toBe(false);}
    expect(canPlaceInScenery('pool',3,-4.9)).toBe(true);
    expect(canPlaceInScenery('lawn',3.1,-3.5)).toBe(true);
    expect(canPlaceInScenery('liveHouse',0,2.4)).toBe(true);
  });
});
