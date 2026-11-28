import type { SceneryId } from '../../catalog';
import type { RoomLink } from '../../connections';
import { PACE_CLOCK, PAVILION_POSTS, POOL, POOL_ORIGIN as P, TIME_DECK, judgeStand, poolBarrierParts } from '../../LidoLayout';
import type { PickDeck, RouteExtension, RoutePoint } from '../types';
import { bodies, type Piece } from './pieces';
import { orientedMember } from './sight';
import { ARCADE_ORIGIN as A, EAST as E, WEST as W, heightAt, inside, isFlat, routeSurfaces, shell, streetEdge, westStreetDoor, type Road } from './site';
export {shell} from './site';

const rooms=['lawn','arcadeHall','pool'] as const;
const campus={x:0,z:0};
export const siteOrigin=(room:SceneryId)=>room==='pool'?P:room==='arcadeHall'?A:campus;
export const hasRoad=(room:SceneryId,road:Road)=>road==='street'?room==='lawn':room==='arcadeHall'||room==='pool';
const open=(mid:number,half:number):[number,number]=>[mid-half,mid+half];
export const campusArcadeLinks:readonly RoomLink[]=[
  {from:'lawn',to:'arcadeHall',axis:'z',direction:-1,gate:A.z+westStreetDoor.inGate,band:open(W.x,westStreetDoor.half),offset:[-A.x,-A.z],
    arrival:{key:'campusToArcade',eye:[9.10,1.65,12.65],aim:[9.10,2.48,4.5]}},
  {from:'arcadeHall',to:'pool',axis:'x',direction:-1,gate:P.x+12.55-A.x,band:open(E.z-A.z,E.half+.01),offset:[A.x-P.x,A.z-P.z],
    arrival:{key:'arcadeToPool',eye:[11.95,1.65,-19.25],aim:[5.42,1.18,-20.62]}},
  {from:'pool',to:'arcadeHall',axis:'x',direction:1,gate:13.25,band:open(E.z-P.z,E.half+.01),offset:[P.x-A.x,P.z-A.z],
    arrival:{key:'poolToArcade',eye:[P.x+13.75-A.x,1.65,E.z-A.z],aim:[-20.9,2.47,E.z-A.z-.38]}},
];

const inventory=rooms.map(room=>{
  const {x:dx,z:dz}=siteOrigin(room);
  // The full print street belongs to the legacy lawn. In the arcade only
  // the short city vestibule beyond the court and the upper viaduct exist.
  const floor=routeSurfaces.filter(s=>hasRoad(room,s.road)||(room==='arcadeHall'&&s.id==='west-turn'))
    .map(s=>room==='arcadeHall'&&s.id==='west-turn'?{...s,f:A.z+westStreetDoor.outGate+.4}:s);
  const solids=bodies.filter(s=>hasRoad(room,s.road));
  const decks:PickDeck[]=[];
  for(const s of floor.filter(isFlat)){
    // Lawn/pool already have a 72 m common ground pick plane. Split an
    // overhanging deck at that edge; coincident event surfaces can lose ups.
    let l=s.l-dx,r=s.r-dx,b=s.b-dz,f=s.f-dz;
    const add=(l:number,r:number,b:number,f:number)=>{if(r>l+1e-6&&f>b+1e-6)decks.push({x:(l+r)/2,y:s.y,z:(b+f)/2,w:r-l,d:f-b});};
    if(!s.y&&room!=='arcadeHall'){
      add(l,Math.min(-36,r),b,f);add(Math.max(36,l),r,b,f);
      l=Math.max(l,-36);r=Math.min(r,36);add(l,r,b,Math.min(-36,f));add(l,r,Math.max(36,b),f);
    }else add(l,r,b,f);
  }
  return {room,floor,solids,decks};
});
const views=new Map<SceneryId,(typeof inventory)[number]>(inventory.map(v=>[v.room,v]));
function borrowedBlock(room:SceneryId,x:number,z:number){return room==='lawn'&&x>A.x-15.23&&x<A.x+14.12&&z>A.z-6.04&&z<streetEdge-.015;}
const within=(r:{x:number;z:number;w:number;d:number},x:number,z:number)=>Math.abs(x-r.x)<=r.w/2+.0001&&Math.abs(z-r.z)<=r.d/2+.0001;
function joinFoot(room:SceneryId,x:number,y:number,z:number){
  if(room==='arcadeHall'){
    const u=x-A.x,v=z-A.z;
    if(y===0&&Math.abs(u-9.10)<W.half+.20&&v<=13&&v>=12.56)return true;
    if(y===3.4&&u>=-8.7&&u<=-7&&v>=-4.451&&v< -4.10)return true;
  }
  if(room==='pool'&&!y)return [TIME_DECK,POOL.farWalk,POOL.walks[1]].some(r=>within(r,x-P.x,z-P.z));
  return false;
}
// Clip in the solid's sheared coordinate system. The underside of a flight
// is inclined too; an AABB for the whole deck would mask the clock at its foot.
function intersects(p:Piece,from:RoutePoint,to:RoutePoint){
  let enter=0,exit=1;
  function slab(a:number,d:number,min:number,max:number){
    if(Math.abs(d)<1e-9)return a>=min&&a<=max;
    const f=(min-a)/d,g=(max-a)/d;enter=Math.max(enter,Math.min(f,g));exit=Math.min(exit,Math.max(f,g));return enter<=exit;
  }
  const x=to.x-from.x,z=to.z-from.z;
  return slab(from.x,x,p.l,p.r)&&slab(from.z,z,p.b,p.f)&&
    slab(from.y-heightAt(p,from.x,from.z),to.y-from.y-p.sx*x-p.sz*z,-p.thick,0);
}
// The lawn sees borrowed exterior walls, not a second mounted hall. Ridges
// and the dry lido aren't registered as extra actor floors in their aliases.
const proxyWalls:Piece[]=shell.map(b=>({road:'street',id:b.tag,ink:b.ink,l:A.x+b.x-b.w/2,r:A.x+b.x+b.w/2,b:A.z+b.z-b.d/2,f:A.z+b.z+b.d/2,y:b.y+b.h/2,thick:b.h,sx:0,sz:0}));
const finishSolids:Piece[]=[];
function lidoObstacle(x:number,y:number,z:number,w:number,h:number,d:number){finishSolids.push({road:'viaduct',id:'lido-furniture',ink:'',l:P.x+x-w/2,r:P.x+x+w/2,b:P.z+z-d/2,f:P.z+z+d/2,y:y+h/2,thick:h,sx:0,sz:0});}
const finishMembers=[...poolBarrierParts(),...judgeStand()].map(p=>orientedMember(p,P));
for(const {x,z,w,d} of PAVILION_POSTS)lidoObstacle(x,1.43,z,w,2.86,d);
lidoObstacle(PACE_CLOCK.x,1.83,PACE_CLOCK.z,.76,.76,.14);lidoObstacle(PACE_CLOCK.x,.70,PACE_CLOCK.z,.085,1.4,.085);lidoObstacle(PACE_CLOCK.x,.98,PACE_CLOCK.z,.89,.26,.12);
lidoObstacle(.80,1.44,-23.15,18.5,2.86,1.42);lidoObstacle(.80,3.08,-22.5,19.2,.34,3.8);
const shoes=[[0,0],[.18,0],[-.18,0],[0,.18],[0,-.18]];
export const campusArcadeExtension:RouteExtension={rooms,
  ground(room,x,z){
    const v=views.get(room);if(!v)return null;
    const o=siteOrigin(room);x+=o.x;z+=o.z;
    const s=v.floor.find(s=>inside(s,x,z,.0001));
    if(s){
      if(room==='arcadeHall'&&s.id==='gallery-neck'&&z>A.z-5.84)return null; // lower court still exists below this bridge
      return heightAt(s,x,z);
    }
    if(room==='arcadeHall'&&z>=streetEdge-.20&&z<=streetEdge&&Math.abs(x-W.x)<W.half)return 0;
    return borrowedBlock(room,x,z)?-Infinity:null;
  },
  decks(room){return views.get(room)?.decks??[];},
  resolve(room,x,z,supportY=0){
    const v=views.get(room);if(!v)return undefined;
    const o=siteOrigin(room);x+=o.x;z+=o.z;
    const s=v.floor.find(s=>inside(s,x,z,.0001));
    if(!s){
      if(borrowedBlock(room,x,z))return null;
      // A wall or lamp standing just outside the paving on the active lawn
      // still owns its footprint. Other base-room world heights delegate.
      return v.solids.some(p=>inside(p,x,z,.18)&&p.y>supportY+.015&&p.y-p.thick<supportY+1.72)?null:undefined;
    }
    if(room==='arcadeHall'&&s.id==='gallery-neck'&&supportY===0&&z>=A.z-6)return undefined;
    if(!isFlat(s)||!Number.isFinite(supportY)||Math.abs(supportY-s.y)>.002)return null;
    if(!shoes.every(([dx,dz])=>v.floor.some(q=>isFlat(q)&&Math.abs(q.y-s.y)<.002&&inside(q,x+dx,z+dz,.0001))||joinFoot(room,x+dx,s.y,z+dz)))return null;
    if(v.solids.some(p=>{
      const h=heightAt(p,x,z);return h>s.y+.015&&h-p.thick<s.y+1.72&&inside(p,x,z,.18);
    }))return null;
    return s.y;
  },
  visible(room,from,x,y,z){
    const v=views.get(room);if(!v)return true;
    const o=siteOrigin(room),a={x:from.x+o.x,y:from.y,z:from.z+o.z},b={x:x+o.x,y:y+.012,z:z+o.z};
    return !v.solids.some(p=>intersects(p,a,b))&&(room==='arcadeHall'||!proxyWalls.some(p=>intersects(p,a,b)))&&
      (room==='lawn'||!finishSolids.some(p=>intersects(p,a,b))&&!finishMembers.some(hit=>hit(a,b)));
  },
};
