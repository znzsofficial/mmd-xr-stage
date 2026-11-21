import type {SceneryId} from '../../catalog';
import type {RoomLink} from '../../connections';
import type {RouteExtension} from '../types';
import {alley,apron,bridge,bridgeY,floorPieces,gateCheeks,gateHead,gatePosts,gateX,landingHead,landingPosts,laneEnd,laneZ,qinOffset,quay,quayEnd,railPosts,railSpans,shadeCloths,span,storefrontSolids,type StreetRect,type StreetBox} from './plan';

const {x:dx,z:dz}=qinOffset;
const half=1.58; // inner face of the two gate cheeks / post bases
export const riverStreetLinks:readonly RoomLink[]=[
  {from:'weddingCourt',to:'qinhuai',axis:'x',direction:-1,gate:gateX-.24,band:[laneZ-half,laneZ+half],offset:[dx,dz],
    arrival:{key:'weddingToRiver',eye:[gateX+dx-1.55,1.59,laneZ+dz+.14],aim:[3.00,1.02,5.55]}},
  {from:'qinhuai',to:'weddingCourt',axis:'x',direction:1,gate:gateX+dx+.24,band:[laneZ+dz-half,laneZ+dz+half],offset:[-dx,-dz],
    arrival:{key:'riverToWedding',eye:[gateX+1.30,1.59,laneZ-.14],aim:[-7.70,1.13,10.47]}},
];
type Point={x:number;y:number;z:number};
const includes=(r:StreetRect,x:number,z:number)=>Math.abs(x-r.x)<=r.w/2+1e-6&&Math.abs(z-r.z)<=r.d/2+1e-6;
const near=(r:StreetRect,x:number,z:number,pad:number)=>Math.max(0,Math.abs(x-r.x)-r.w/2)**2+Math.max(0,Math.abs(z-r.z)-r.d/2)**2<=pad*pad;
const bodies=[...gatePosts,...gateCheeks,...landingPosts,...storefrontSolids,...railPosts,...shadeCloths];
// Extend support over the two old decks' edge padding without taking over
// either old room. These short strips only belong to the clear openings.
function owns(room:SceneryId,x:number,z:number){
  if(room==='weddingCourt')return x<laneEnd&&x>=quayEnd?z>=3.7&&z<17:
    x>=laneEnd&&x<laneEnd+.34&&Math.abs(z-laneZ)<alley.d/2-.30;
  if(room==='qinhuai')return x>quayEnd&&x<=laneEnd?z>=3.7&&z<17:
    x<=quayEnd&&(x>quayEnd-.34&&Math.abs(z-laneZ)<quay.d/2-.30||landingPosts.some(p=>near(p,x,z,.28)));
  return false;
}
const pastOverlap=(room:SceneryId,x:number)=>room==='weddingCourt'?x<gateX-2.6:x>gateX+2.6;
function floor(room:SceneryId,x:number,z:number){
  return floorPieces.some(r=>includes(r,x,z))||
    (room==='weddingCourt'&&x>=laneEnd&&x<laneEnd+.8&&Math.abs(z-laneZ)<alley.d/2)||
    (room==='qinhuai'&&x<=quayEnd&&x>quayEnd-.8&&Math.abs(z-laneZ)<quay.d/2);
}
function clear(room:SceneryId,x:number,z:number,placing:boolean){
  const pad=placing?.28:.18;
  if(pastOverlap(room,x)||!floor(room,x,z)||!floor(room,x-pad,z)||!floor(room,x+pad,z)||!floor(room,x,z-pad)||!floor(room,x,z+pad))return false;
  if(placing&&(Math.abs(x-gateX)<1.13||x>bridge.west-.28&&x<bridge.east+.28&&!(x>=bridge.crownWest+.28&&x<=bridge.crownEast-.28)))return false;
  if(bodies.some(b=>near(b,x,z,pad)))return false;
  return !railSpans.some(r=>x>=r.a-pad&&x<=r.b+pad&&Math.abs(z-r.z)<pad+.075);
}

// Clip the finite 3-D ray to actual rails, their posts and the raised deck.
// A pitched interval becomes an axis-aligned slab after subtracting slope*x.
function hit(p:Point,q:Point,r:StreetBox,slope=0){
  let lo=0,hi=1;
  function slab(a:number,b:number,min:number,max:number){
    const d=b-a;if(Math.abs(d)<1e-8)return a>=min&&a<=max;
    const t=(min-a)/d,u=(max-a)/d;lo=Math.max(lo,Math.min(t,u));hi=Math.min(hi,Math.max(t,u));return lo<=hi;
  }
  return slab(p.x,q.x,r.x-r.w/2,r.x+r.w/2)&&slab(p.z,q.z,r.z-r.d/2,r.z+r.d/2)&&
    slab(p.y-(p.x-r.x)*slope,q.y-(q.x-r.x)*slope,r.bottom,r.top);
}
const pitched=(a:number,b:number)=>({h:bridgeY((a+b)/2),slope:(bridgeY(b)-bridgeY(a))/(b-a)});
const sight=[...bodies,gateHead,landingHead].map(r=>({r,slope:0}));
for(const {a,b,z} of railSpans){
  const {slope,h}=pitched(a,b);
  for(const [bottom,top] of [[.20,.31],[.675,.775]])sight.push({r:{x:(a+b)/2,z,w:b-a,d:.13,bottom:h+bottom,top:h+top},slope});
}
for(const [a,b] of [[bridge.west,bridge.crownWest],[bridge.crownWest,bridge.crownEast],[bridge.crownEast,bridge.east]]){
  const {h,slope}=pitched(a,b);sight.push({r:{...span,x:(a+b)/2,w:b-a,bottom:h-.205,top:h},slope});
}
const levelDeck=[{x:-17,z:laneZ,w:bridge.crownEast-bridge.crownWest,d:span.d,y:bridge.y}];
export const riverStreetExtension:RouteExtension={
  rooms:['weddingCourt','qinhuai'],
  decks:room=>room==='weddingCourt'?levelDeck:[], // all other dry land is inside the common 72m pick plane
  ground(room,x,z){if(room==='qinhuai'){x-=dx;z-=dz;}return owns(room,x,z)?(clear(room,x,z,false)?bridgeY(x):-Infinity):null;},
  resolve(room,x,z,y){if(room==='qinhuai'){x-=dx;z-=dz;}if(!owns(room,x,z))return undefined;
    const h=bridgeY(x);return (y===undefined||Math.abs(y-h)<.021)&&clear(room,x,z,true)?h:null;},
  visible(room,from,x,y,z){
    if(room!=='weddingCourt'&&room!=='qinhuai')return true;
    const ox=room==='qinhuai'?dx:0,oz=room==='qinhuai'?dz:0;
    const a={x:from.x-ox,y:from.y,z:from.z-oz},b={x:x-ox,y:y+.012,z:z-oz};
    if(owns(room,b.x,b.z)&&(!clear(room,b.x,b.z,true)||Math.abs(bridgeY(b.x)-y)>.021||a.y<=b.y))return false;
    if(Math.min(a.x,b.x)>laneEnd||Math.max(a.x,b.x)<quayEnd||Math.max(a.z,b.z)<apron.z-apron.d/2-2)return true;
    return !sight.some(({r,slope})=>hit(a,b,r,slope));
  },
};
