// The railway ends at a stone apron. Two flights below the front of its
// seawall join a lower landing that floods; performers stay on the dry quay.
type Point={x:number;y:number;z:number};
export type Slab={x:number;z:number;w:number;d:number;y:number};
export const platform:Slab={x:-.5,z:-3,w:7,d:22,y:0};
export const quay:Slab={x:10,z:-12,w:14,d:4,y:0};
export const landing:Slab={x:8,z:-17,w:15,d:2,y:-.48};
export const stairs:Slab[]=[1.8,14.1].flatMap(x=>Array.from({length:4},(_,i)=>({x,z:-14.25-i*.5,w:2.05,d:.5,y:-(i+1)*.12})));
export const floors=[platform,quay,...stairs,landing];
const within=(s:Slab,x:number,z:number,pad=0)=>Math.abs(x-s.x)<=s.w*.5-pad&&Math.abs(z-s.z)<=s.d*.5-pad;
export const shoreGround=(x:number,z:number)=>floors.find(s=>within(s,x,z))?.y??-Infinity;
type Block={x:number;z:number;w:number;d:number;bottom:number;top:number};
export const booth={x:1.84,z:1.45,w:1.85,d:4.7,bottom:0,top:2.62};
export const bench={x:1.97,z:-3.62,w:.66,d:2.72,bottom:0,top:.87};
export const sign={x:-2.0,z:-8.85,w:2.15,d:.16,bottom:0,top:2.32};
export const gauge={x:6.8,z:-13.45,w:.42,d:.3,bottom:0,top:1.22};
export const lantern={x:15.9,z:-11.78,w:1.02,d:1.02,bottom:0,top:4.6};
export const posts=[2.68,-3.25].flatMap(x=>[-5.75,-1.25,3.25].map(z=>({x,z,w:.14,d:.15,bottom:0,top:2.93})));
const shelter={x:-.3,z:-1.0,w:6.5,d:11.4,bottom:2.88,top:3.55};
const furniture=[booth,bench,sign,gauge,lantern,...posts];
export const railRuns=[[-3.82,-14, .65,-14],[2.95,-14,12.96,-14],[15.23,-14,16.86,-14],[16.86,-14,16.86,-10.13],[3.1,-10.13,14.9,-10.13],[2.87,-9.92,2.87,-6.95]] as const;
const rails=railRuns.map(([x,z,a,b])=>({x:(x+a)/2,z:(z+b)/2,w:Math.max(.06,Math.abs(a-x)),d:Math.max(.06,Math.abs(b-z)),bottom:0,top:.91}));
const footprints=[...furniture,...rails];
export const shorePlace=(x:number,z:number)=>(within(platform,x,z,.28)||within(quay,x,z,.28)) && !footprints.some(b=>Math.abs(x-b.x)<b.w/2+.25&&Math.abs(z-b.z)<b.d/2+.25);
const occ=[...footprints,shelter,...floors.map(s=>({...s,bottom:-1.52,top:s.y-.035}))];
function cut(a:Point,b:Point,o:Block){let lo=0,hi=1;
  const axis=(p:number,q:number,l:number,h:number)=>{const d=q-p;if(Math.abs(d)<1e-7)return p>=l&&p<=h;const i=(l-p)/d,j=(h-p)/d;lo=Math.max(lo,Math.min(i,j));hi=Math.min(hi,Math.max(i,j));return lo<=hi;};
  return axis(a.x,b.x,o.x-o.w/2,o.x+o.w/2)&&axis(a.z,b.z,o.z-o.d/2,o.z+o.d/2)&&axis(a.y,b.y,o.bottom,o.top);}
export const shoreSight=(a:Point,x:number,y:number,z:number,gaugeFace=false)=>!occ.some(b=>(!gaugeFace||b!==gauge)&&cut(a,{x,y,z},b));
export const shoreView={entry:[[-2.69,1.58,2.85],[1.58,1.19,-8.45]],shots:[
  {key:'shorePlatform',eye:[-.63,1.51,-4.9],aim:[-1.45,1.36,-9.05]},
  {key:'shoreWaterline',eye:[2.1,1.04,-17.1],aim:[14.5,1.38,-13]},
  {key:'shoreReturn',eye:[14.32,1.55,-12.46],aim:[-1.12,1.28,-7.25]},
  {key:'shoreSounder',eye:[6.22,1.49,-11.32],aim:[6.8,1.02,-13.45]},
]} as const;
