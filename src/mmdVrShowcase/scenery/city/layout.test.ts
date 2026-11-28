import {expect,it} from 'vitest';
import {roomGround} from '../../movement/roomGround';
import {roomLinks,RoomGate} from '../connections';
import {resolvePlacementHeight,roomPickDecks,visiblePick} from '../placementAreas';
import {tourShots} from '../roomViews';
import {cityLinks} from './connections';
import {CITY_ORIGINS,cityDecks,type CityVenue} from './site';

const station='seasideTerminus';
const marks:Record<CityVenue,readonly (readonly [number,number])[]>={
  clinic:[[21.4,53.8],[8.23,53.8]],
  classroom:[[21.4,58.5],[39.97,58.5],[39.97,53.33]],
  pool:[[21.4,58.5],[1,58.5],[1,87],[-24.25,87],[-24.25,71.19]],
  arcadeHall:[[21.4,58.5],[1,58.5],[1,87],[29.10,87],[29.10,82.90]],
};
it.each(Object.keys(marks) as CityVenue[])('walks the whole paved route to %s and can point an actor onto its doorstep',room=>{
  const route=[[21.4,42.1],...marks[room]];
  for(let i=1;i<route.length;i++){
    const [a,b]=route[i-1],[c,d]=route[i],steps=Math.ceil(Math.hypot(c-a,d-b)/.17);
    for(let j=0;j<=steps;j++){
      const x=a+(c-a)*j/steps,z=b+(d-b)*j/steps;
      expect(roomGround(station,x,z),`${x},${z}`).toBe(0);
      expect(resolvePlacementHeight(station,x,z),`shoes ${x},${z}`).toBe(0);
    }
  }
  const [x,z]=route.at(-1)!;
  const from={x:x+(room==='clinic'?3:0),y:1.55,z:z+(room==='clinic'?0:2.8)};
  expect(visiblePick(station,from,x,0,z)).toBe(true);
  expect(roomPickDecks(station).some(d=>Math.abs(d.x-x)<d.w/2&&Math.abs(d.z-z)<d.d/2)).toBe(true);
});

it('has one screen arrival for each directed doorway, with original heading and a distinct reverse threshold',()=>{
  expect(cityLinks).toHaveLength(8);
  for(const room of Object.keys(marks) as CityVenue[]){
    const o=CITY_ORIGINS[room],into=cityLinks.find(l=>l.to===room)!,out=cityLinks.find(l=>l.from===room)!;
    expect(roomLinks.filter(l=>l.from===station&&l.to===room)).toEqual([into]);
    expect(roomLinks.filter(l=>l.from===room&&l.to===station)).toEqual([out]);
    expect(into.axis).toBe(room==='clinic'?'x':'z');expect(into.direction).toBe(-1);expect(out.direction).toBe(1);
    for(const link of [into,out]){
      const origin=link===into?-1:1;
      expect(link.offset[0]).toBeCloseTo(origin*o.x);expect(link.offset[1]).toBeCloseTo(origin*o.z);
      const mid=(link.band[0]+link.band[1])/2,point=(distance:number):[number,number]=>
        link.axis==='x'?[link.gate+distance*link.direction,mid]:[mid,link.gate+distance*link.direction];
      const gate=new RoomGate();
      gate.next(link.from,...point(-.08));expect(gate.next(link.from,...point(.08))).toBe(link);
      // A held forward step or an immediate small reverse step cannot bounce
      // between rooms. The actual offset position, not a spawn point, is used.
      for(const d of [.08,.16,.01,-.08]){
        const [x,z]=point(d),u=x+link.offset[0],v=z+link.offset[1];
        expect(roomGround(link.to,u,v)).toBe(0);expect(gate.next(link.to,u,v)).toBeNull();
      }
      const shot=tourShots(link.from).find(s=>s.link===link)!;
      const [ex,,ez]=shot.eye,[ax,,az]=shot.aim;
      expect(resolvePlacementHeight(link.to,ex,ez)).toBe(0);
      expect(((link.axis==='x'?ax-ex:az-ez)*link.direction)).toBeGreaterThan(0);
    }
  }
});

it('admits one walkable/pickable top per paving panel, including both sides of the arcade vestibule',()=>{
  for(const [i,a] of cityDecks.entries())for(const b of cityDecks.slice(i+1)){
    const overlap=(a.w+b.w)/2-Math.abs(a.x-b.x)>.00001&&(a.d+b.d)/2-Math.abs(a.z-b.z)>.00001;
    expect(overlap).toBe(false);
  }
  for(let z=81.60;z<84.15;z+=.10){
    expect(roomGround(station,29.1,z)).toBe(0);
    expect(resolvePlacementHeight(station,29.1,z)).toBe(0);
    expect(roomGround('arcadeHall',9.10,z-68.6)).toBe(0);
  }
  for(let z=12.7;z<15.3;z+=.05)expect(resolvePlacementHeight('arcadeHall',9.10,z)).toBe(0);
  expect(roomGround('arcadeHall',9.1,17)).toBe(-Infinity);
  expect(resolvePlacementHeight('arcadeHall',-4.2,18.3)).toBeNull();
  for(const [x,z] of [[15,48],[20.13,44.48],[28.6,47],[-30.4,51.3],[44,48],[20,68.6],[0,51]]){
    expect(roomGround(station,x,z)).toBe(-Infinity);expect(resolvePlacementHeight(station,x,z)).toBeNull();
  }
  expect(resolvePlacementHeight('pool',0,-12.4)).toBeNull();
});

it('traces from both sides of the school wall and under the open pool gate, including the high lintel',()=>{
  const visible=(x:number,y:number,z:number,tx:number,tz:number)=>visiblePick(station,{x,y,z},tx,0,tz);
  expect(visible(41.4,1.55,52.7,41.4,57.9)).toBe(false);
  expect(visible(39.97,1.55,52.7,39.97,57.9)).toBe(true);
  expect(visible(39.97,3.8,53.32,39.97,57.9)).toBe(false);
  expect(visiblePick('classroom',{x:0,y:1.55,z:4.3},-4.03,0,6.5)).toBe(false);
  expect(visiblePick('classroom',{x:-4.03,y:1.55,z:4.3},-4.03,0,6.5)).toBe(true);
  expect(visible(-24.25,1.55,69.4,-24.25,76)).toBe(true);
  expect(visible(-26,1.55,70.2,-26,76)).toBe(false);
  // The target by the pool is clear, but the oblique ray through the
  // pharmacy on the other side of the inland street is not.
  expect(resolvePlacementHeight(station,-24.25,76)).toBe(0);
  expect(visible(1,1.55,81,-24.25,76)).toBe(false);
});

it.each([
  ['clinic','cityClinicFront',14.6,53.8,-4.95,-5.6,-4.95,-6.1],
  ['classroom','citySchoolFront',39.97,55.24,0,-3.4,0,-4.21],
  ['pool','cityPoolFront',-24.25,75.6,6.18,-17.0,6.15,-18.43],
  ['arcadeHall','cityArcadeFront',29.1,83.70,0,3.9,.45,3.24],
] as const)('frames an outside actor from the %s street view and a second supported mark well inside the venue',
  (room,key,outsideX,outsideZ,insideEyeX,insideEyeZ,insideX,insideZ)=>{
    const shot=tourShots(station).find(v=>v.key===key)!;
    expect(shot.link).toBeUndefined();
    const [x,y,z]=shot.eye;
    expect(roomGround(station,x,z)).toBe(0);
    expect(resolvePlacementHeight(station,outsideX,outsideZ)).toBe(0);
    expect(visiblePick(station,{x,y,z},outsideX,0,outsideZ)).toBe(true);
    expect(roomGround(room,insideEyeX,insideEyeZ)).toBe(0);
    expect(resolvePlacementHeight(room,insideX,insideZ)).toBe(0);
    expect(visiblePick(room,{x:insideEyeX,y:1.55,z:insideEyeZ},insideX,0,insideZ)).toBe(true);
});
