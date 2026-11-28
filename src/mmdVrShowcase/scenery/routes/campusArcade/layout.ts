import type { SceneryId } from '../../catalog';
import type { RoomLink } from '../../connections';
import { PACE_CLOCK, PAVILION_POSTS, POOL, POOL_ORIGIN as P, TIME_DECK, judgeStand, poolBarrierParts } from '../../LidoLayout';
import type { RouteExtension, RoutePoint } from '../types';
import { bodies, type Piece } from './pieces';
import { orientedMember } from './sight';
import { ARCADE_ORIGIN as A, EAST as E, heightAt, inside, isFlat, routeSurfaces, shell, westThreshold } from './site';

const rooms=['arcadeHall','pool'] as const;
export type TimingWalkRoom=typeof rooms[number];
export const siteOrigin=(room:TimingWalkRoom)=>room==='pool'?P:A;
const open=(mid:number,half:number):[number,number]=>[mid-half,mid+half];
export const campusArcadeLinks:readonly RoomLink[]=[
  {from:'arcadeHall',to:'pool',axis:'x',direction:-1,gate:P.x+12.55-A.x,band:open(E.z-A.z,E.half+.01),offset:[A.x-P.x,A.z-P.z],
    arrival:{key:'arcadeToPool',eye:[11.95,1.65,-19.25],aim:[5.42,1.18,-20.62]}},
  {from:'pool',to:'arcadeHall',axis:'x',direction:1,gate:13.25,band:open(E.z-P.z,E.half+.01),offset:[P.x-A.x,P.z-A.z],
    arrival:{key:'poolToArcade',eye:[P.x+13.75-A.x,1.65,E.z-A.z],aim:[-20.9,2.47,E.z-A.z-.38]}},
];

const inventory=rooms.map(room=>{
  const origin=siteOrigin(room);
  const floor=room==='arcadeHall'?[westThreshold,...routeSurfaces]:routeSurfaces;
  // The ground-level pool apron and coping are already inside the pool's
  // common pick plane. Only its elevated landings need additional planes.
  const decks=floor.filter(s=>isFlat(s)&&(room==='arcadeHall'||s.y!==0)).map(s=>({
    x:(s.l+s.r)/2-origin.x,y:s.y,z:(s.b+s.f)/2-origin.z,w:s.r-s.l,d:s.f-s.b,
  }));
  return {room,origin,floor,decks};
});
const views=new Map<SceneryId,(typeof inventory)[number]>(inventory.map(v=>[v.room,v]));
const within=(r:{x:number;z:number;w:number;d:number},x:number,z:number)=>Math.abs(x-r.x)<=r.w/2+.0001&&Math.abs(z-r.z)<=r.d/2+.0001;
function joinFoot(room:SceneryId,x:number,y:number,z:number){
  if(room==='arcadeHall'){
    const u=x-A.x,v=z-A.z;
    if(y===0&&x>westThreshold.l-.20&&x<westThreshold.r+.20&&z<=westThreshold.b&&z>=westThreshold.b-.44)return true;
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
// The pool sees the hall exterior; its walls occlude placement rays too.
const proxyWalls:Piece[]=shell.map(b=>({id:b.tag,ink:b.ink,l:A.x+b.x-b.w/2,r:A.x+b.x+b.w/2,b:A.z+b.z-b.d/2,f:A.z+b.z+b.d/2,y:b.y+b.h/2,thick:b.h,sx:0,sz:0}));
const finishSolids:Piece[]=[];
function lidoObstacle(x:number,y:number,z:number,w:number,h:number,d:number){finishSolids.push({id:'lido-furniture',ink:'',l:P.x+x-w/2,r:P.x+x+w/2,b:P.z+z-d/2,f:P.z+z+d/2,y:y+h/2,thick:h,sx:0,sz:0});}
const finishMembers=[...poolBarrierParts(),...judgeStand()].map(p=>orientedMember(p,P));
for(const {x,z,w,d} of PAVILION_POSTS)lidoObstacle(x,1.43,z,w,2.86,d);
lidoObstacle(PACE_CLOCK.x,1.83,PACE_CLOCK.z,.76,.76,.14);lidoObstacle(PACE_CLOCK.x,.70,PACE_CLOCK.z,.085,1.4,.085);lidoObstacle(PACE_CLOCK.x,.98,PACE_CLOCK.z,.89,.26,.12);
lidoObstacle(.80,1.44,-23.15,18.5,2.86,1.42);lidoObstacle(.80,3.08,-22.5,19.2,.34,3.8);
const shoes=[[0,0],[.18,0],[-.18,0],[0,.18],[0,-.18]];
export const campusArcadeExtension:RouteExtension={rooms,
  ground(room,x,z){
    const v=views.get(room);if(!v)return null;
    x+=v.origin.x;z+=v.origin.z;
    const s=v.floor.find(s=>inside(s,x,z,.0001));
    if(s){
      if(room==='arcadeHall'&&s.id==='gallery-neck'&&z>A.z-5.84)return null; // lower court still exists below this bridge
      return heightAt(s,x,z);
    }
    if(room==='arcadeHall'&&z>=westThreshold.b-.20&&z<=westThreshold.b&&x>westThreshold.l&&x<westThreshold.r)return 0;
    return null;
  },
  decks(room){return views.get(room)?.decks??[];},
  resolve(room,x,z,supportY=0){
    const v=views.get(room);if(!v)return undefined;
    x+=v.origin.x;z+=v.origin.z;
    const s=v.floor.find(s=>inside(s,x,z,.0001));
    if(!s){
      return bodies.some(p=>inside(p,x,z,.18)&&p.y>supportY+.015&&p.y-p.thick<supportY+1.72)?null:undefined;
    }
    if(room==='arcadeHall'&&s.id==='gallery-neck'&&supportY===0&&z>=A.z-6)return undefined;
    if(!isFlat(s)||!Number.isFinite(supportY)||Math.abs(supportY-s.y)>.002)return null;
    if(!shoes.every(([dx,dz])=>v.floor.some(q=>isFlat(q)&&Math.abs(q.y-s.y)<.002&&inside(q,x+dx,z+dz,.0001))||joinFoot(room,x+dx,s.y,z+dz)))return null;
    if(bodies.some(p=>{
      const h=heightAt(p,x,z);return h>s.y+.015&&h-p.thick<s.y+1.72&&inside(p,x,z,.18);
    }))return null;
    return s.y;
  },
  visible(room,from,x,y,z){
    const v=views.get(room);if(!v)return true;
    const o=v.origin,a={x:from.x+o.x,y:from.y,z:from.z+o.z},b={x:x+o.x,y:y+.012,z:z+o.z};
    return !bodies.some(p=>intersects(p,a,b))&&(room!=='pool'||!proxyWalls.some(p=>intersects(p,a,b)))&&
      !finishSolids.some(p=>intersects(p,a,b))&&!finishMembers.some(hit=>hit(a,b));
  },
};
